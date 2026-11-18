/** Centre de commande des drones : profils, état MAVLink, conditions de vol, missions et commandes contrôlées. */
import { sql, sqlOne } from "./db";
import { ApiFailure, type User } from "./api";
import { audit } from "./audit";
import { proposeCommand, confirmCommand } from "./iot";
import { requireDevice, type DeviceRow } from "./access";
import { meteomaticsFlight, openMeteoFlight, type FlightForecast } from "./integrations/flightweather";
import { assessFlight, checkMission, droneCommandBlockers, droneProfile, DRONE_ACTIONS, type Assessment, type DroneAction, type DroneProfile, type Waypoint } from "@/lib/drone";

export const DRONE_CAPABILITIES = { commands: DRONE_ACTIONS.map((action) => ({ action, max_duration_s: null, requires_duration: false })) };

export async function requireDrone(id: string, u: User, write: boolean): Promise<DeviceRow> {
  const d = await requireDevice(id, u, write);
  if (d.hardware !== "drone" || d.protocol !== "mavlink") throw new ApiFailure(400, "Cet appareil n'est pas un drone MAVLink", "drone.err.notDrone");
  return d;
}

export async function profileOf(deviceId: string): Promise<DroneProfile | null> {
  const r = await sqlOne<{ profile: unknown }>("SELECT profile FROM drone_profiles WHERE device_id=$1", [deviceId]);
  return r ? droneProfile.parse(r.profile) : null;
}

export async function stateOf(deviceId: string) {
  return sqlOne<{ state: Record<string, unknown>; home_lat: number | null; home_lon: number | null; updated_at: string }>("SELECT state, home_lat, home_lon, updated_at FROM drone_state WHERE device_id=$1", [deviceId]);
}

export async function saveState(d: DeviceRow, state: Record<string, unknown>) {
  const home = state.home as { lat?: number; lon?: number } | null | undefined;
  await sql(`INSERT INTO drone_state(device_id, state, home_lat, home_lon, updated_at) VALUES ($1,$2,$3,$4,now())
    ON CONFLICT (device_id) DO UPDATE SET state=EXCLUDED.state, home_lat=COALESCE(EXCLUDED.home_lat, drone_state.home_lat), home_lon=COALESCE(EXCLUDED.home_lon, drone_state.home_lon), updated_at=now()`,
    [d.id, JSON.stringify(state), home?.lat ?? null, home?.lon ?? null]);
  await sql("UPDATE devices SET last_seen=now() WHERE id=$1", [d.id]);
}

export async function forecastFor(lat: number, lon: number, source: "open-meteo" | "meteomatics"): Promise<FlightForecast> {
  return source === "meteomatics" ? meteomaticsFlight(lat, lon) : openMeteoFlight(lat, lon);
}

/** Évaluation de l'heure courante (prévision) au point donné ; null si la prévision est indisponible (raison fournie). */
export async function currentAssessment(p: DroneProfile, lat: number, lon: number, altM: number): Promise<{ assessment: Assessment | null; error: string | null; forecast: FlightForecast | null }> {
  try {
    const f = await openMeteoFlight(lat, lon, 3);
    const now = new Date().toISOString().slice(0, 13);
    const h = f.hours.find((x) => x.time.slice(0, 13) === now) ?? f.hours[0];
    return { assessment: assessFlight(p, h, altM), error: null, forecast: f };
  } catch (e) { return { assessment: null, error: e instanceof Error ? e.message : String(e), forecast: null }; }
}

const FLIGHT_ACTIONS = new Set<DroneAction>(["takeoff", "goto", "mission_start"]);

/**
 * Proposition (et confirmation éventuelle) d'une commande drone. Vol RÉEL : profil complet, conditions de vol non
 * défavorables et vérifiables, mission simulée au préalable sur un drone virtuel. Les arrêts (rtl, land, hold, estop)
 * ne sont jamais bloqués.
 */
export async function proposeDroneCommand(u: User, d: DeviceRow, action: DroneAction, params: Record<string, unknown>, reason: string | null, confirm: boolean) {
  const profile = await profileOf(d.id);
  const st = await stateOf(d.id);
  const home = st?.home_lat != null && st?.home_lon != null ? { lat: st.home_lat, lon: st.home_lon } : null;
  const blockers = droneCommandBlockers(profile, home, action, params);
  let finalParams = params;
  if (action === "mission_start") {
    const m = await sqlOne<{ id: string; device_id: string; owner_id: string; waypoints: Waypoint[]; status: string; check_result: { ok: boolean } }>("SELECT id, device_id, owner_id, waypoints, status, check_result FROM drone_missions WHERE id=$1", [params.mission_id]);
    if (!m || (m.owner_id !== u.id && !u.is_admin)) blockers.push("mission introuvable");
    else {
      if (!m.check_result.ok) blockers.push("mission non validée (plafond, géorepérage ou autonomie)");
      if (d.environment === "real" && m.status !== "simulated" && m.status !== "flown") blockers.push("mission non simulée : la jouer d'abord sur un drone virtuel (SITL)");
      finalParams = { mission_id: m.id, waypoints: m.waypoints };
    }
  }
  if (d.environment === "real" && FLIGHT_ACTIONS.has(action)) {
    if (!profile) blockers.push("profil constructeur du drone non renseigné");
    else if (!home) blockers.push("position de départ inconnue (aucune télémétrie GPS récente)");
    else {
      const alt = Number((params as { alt_m?: number }).alt_m ?? 30);
      const { assessment, error } = await currentAssessment(profile, home.lat, home.lon, alt);
      if (!assessment) blockers.push(`conditions de vol non vérifiables (${error})`);
      else if (assessment.verdict === "defavorable") blockers.push(`conditions défavorables (prévision) : ${assessment.reasons.join(" ; ")}`);
      else if (assessment.verdict === "donnees_insuffisantes") blockers.push(`données insuffisantes : ${assessment.missing.join(", ")}`);
    }
  }
  if (blockers.length) {
    await audit(u.id, "human", "drone.command.refused", { kind: "device", id: d.id }, { action, blockers });
    throw new ApiFailure(409, `Commande refusée : ${blockers.join(" ; ")}`, "drone.err.blocked", blockers);
  }
  const c = await proposeCommand(d, action, null, "user", u.id, reason, null, finalParams);
  if (confirm) await confirmCommand(c.id, u);
  return { id: c.id, status: confirm ? "confirmed" : "proposed" };
}

export async function createMission(u: User, d: DeviceRow, name: string, wps: Waypoint[], home: { lat: number; lon: number } | null) {
  const profile = await profileOf(d.id);
  if (!profile) throw new ApiFailure(409, "Renseigner d'abord le profil constructeur du drone", "drone.err.noProfile");
  const st = await stateOf(d.id);
  const h = home ?? (st?.home_lat != null ? { lat: st.home_lat, lon: st.home_lon! } : null);
  if (!h) throw new ApiFailure(409, "Point de départ inconnu : le saisir ou attendre la télémétrie GPS", "drone.err.noHome");
  const check = checkMission(profile, h, wps);
  const maxAlt = Math.max(...wps.map((w) => w.alt_m));
  const weather = await currentAssessment(profile, h.lat, h.lon, maxAlt);
  const m = (await sql<{ id: string }>(`INSERT INTO drone_missions(device_id, owner_id, name, home_lat, home_lon, waypoints, check_result, weather, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [d.id, u.id, name, h.lat, h.lon, JSON.stringify(wps), JSON.stringify(check),
    JSON.stringify({ assessment: weather.assessment, error: weather.error, source: weather.forecast?.source ?? null, at: new Date().toISOString() }), check.ok ? "validated" : "draft"]))[0];
  await audit(u.id, "human", "drone.mission.create", { kind: "drone_mission", id: m.id }, { device: d.id, ok: check.ok });
  return { id: m.id, check, weather };
}

/** Accusé d'une mission jouée avec succès : sur drone virtuel → « simulée » ; sur drone réel → « effectuée ». */
export async function onMissionAck(d: DeviceRow, params: { mission_id?: string }, ok: boolean) {
  if (!ok || !params.mission_id) return;
  if (d.environment === "virtual") await sql("UPDATE drone_missions SET status='simulated', simulated_on=$2, updated_at=now() WHERE id=$1 AND status IN ('validated','simulated')", [params.mission_id, d.id]);
  else await sql("UPDATE drone_missions SET status='flown', updated_at=now() WHERE id=$1", [params.mission_id]);
}
