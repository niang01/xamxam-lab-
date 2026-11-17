/**
 * IoT Gateway : ingestion des mesures, cycle de vie des commandes, évaluation des automatisations.
 * - Une commande n'est « acknowledged » (exécutée) que sur accusé explicite de l'appareil.
 * - Une proposition (IA, automatisation) attend une confirmation humaine, sauf préautorisation écrite (niveau 5).
 * - Une commande confirmée non récupérée dans le délai expire : elle n'est jamais exécutée en retard.
 * - Les mesures simulées ne déclenchent jamais d'action réelle.
 */
import { sql, sqlOne } from "./db";
import { ApiFailure, type User } from "./api";
import { audit } from "./audit";
import { notify, getSetting } from "./settings";
import { commandBlockers, confirmBlockers, PICKUP_WINDOW_S, PROPOSAL_WINDOW_S, STOP_ACTIONS } from "@/lib/commands";
import { automationSpec, evaluate } from "@/lib/automation";
import { can } from "@/lib/profiles";
import type { DeviceRow } from "./access";
import { sha256 } from "./security/crypto";

export interface Reading { metric: string; value: number; unit?: string | null; ts?: string | null }

export async function deviceByToken(token: string | null): Promise<DeviceRow | null> {
  if (!token) return null;
  return sqlOne<DeviceRow>("SELECT * FROM devices WHERE token_hash=$1 AND status='active'", [sha256(token)]);
}

/** Expire les propositions et commandes non récupérées dont l'échéance est passée. */
export async function expireCommands() {
  await sql("UPDATE device_commands SET status='expired' WHERE status IN ('proposed','confirmed') AND expires_at < now()");
}

export async function ingest(d: DeviceRow, readings: Reading[], source: "device" | "web_serial" | "simulator") {
  const quality = source === "simulator" ? "simulated" : "valid";
  const now = Date.now();
  let accepted = 0;
  const rejected: string[] = [];
  for (const r of readings) {
    const ts = r.ts ? new Date(r.ts) : new Date();
    if (!Number.isFinite(ts.getTime()) || ts.getTime() > now + 5 * 60000) { rejected.push(`${r.metric} : horodatage invalide ou dans le futur`); continue; }
    if (!Number.isFinite(r.value)) { rejected.push(`${r.metric} : valeur non numérique`); continue; }
    await sql("INSERT INTO measurements(device_id, metric, ts, value, unit, quality, source) VALUES ($1,$2,$3,$4,$5,$6,$7)", [d.id, r.metric, ts.toISOString(), r.value, r.unit ?? null, quality, source]);
    accepted++;
  }
  if (source !== "simulator") await sql("UPDATE devices SET last_seen=now() WHERE id=$1", [d.id]);
  if (accepted && quality === "valid") await evaluateAutomations(d.id);
  return { accepted, rejected, quality };
}

interface CommandRow { id: string; device_id: string; action: string; status: string; duration_s: number | null; proposed_by: string; expires_at: string }

export async function proposeCommand(d: DeviceRow, action: string, durationS: number | null, by: "ai" | "user" | "automation", proposer: string | null, reason: string | null, rcSession: string | null = null) {
  if (!(await getSetting("devices_enabled", true)) && !STOP_ACTIONS.has(action)) throw new ApiFailure(423, "Commandes d'équipements suspendues depuis le Command Center", "cmd.suspended");
  const blockers = commandBlockers(d, action, durationS);
  if (blockers.length) throw new ApiFailure(409, `Commande refusée : ${blockers.join(" ; ")}`, "cmd.blocked", blockers);
  const c = (await sql<CommandRow>(`INSERT INTO device_commands(device_id, action, duration_s, proposed_by, proposer_id, reason, status, expires_at, rc_session_id)
    VALUES ($1,$2,$3,$4,$5,$6,'proposed', now() + ($7 || ' seconds')::interval, $8) RETURNING *`, [d.id, action, durationS, by, proposer, reason, String(PROPOSAL_WINDOW_S), rcSession]))[0];
  await audit(proposer, by === "ai" ? "ai" : by === "automation" ? "system" : "human", "command.propose", { kind: "device_command", id: c.id }, { device: d.id, action, duration_s: durationS, reason });
  if (by !== "user") await notify(d.owner_id, "command.proposed", `Commande proposée : ${action} — ${d.name}`, reason, "/remote");
  return c;
}

export async function confirmCommand(commandId: string, u: User | null, preauthorizedBy: string | null = null) {
  await expireCommands();
  const c = await sqlOne<CommandRow>("SELECT * FROM device_commands WHERE id=$1", [commandId]);
  if (!c) throw new ApiFailure(404, "Commande introuvable", "err.notFound");
  if (c.status !== "proposed") throw new ApiFailure(409, `Commande non confirmable (état : ${c.status})`, "cmd.state");
  const d = (await sqlOne<DeviceRow>("SELECT * FROM devices WHERE id=$1", [c.device_id]))!;
  if (u) {
    if (d.owner_id !== u.id && !u.is_admin) {
      const r = d.project_id ? await sqlOne<{ role: string }>("SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2", [d.project_id, u.id]) : null;
      if (!r || !["owner", "editor"].includes(r.role)) throw new ApiFailure(403, "Droits insuffisants sur cet appareil", "err.forbidden");
    }
    const bl = confirmBlockers(d, c.action, { clearances: u.clearances, canConfirm: can(u.profile_kind, u.is_admin, "confirm_commands") });
    if (bl.length) throw new ApiFailure(403, `Confirmation refusée : ${bl.join(" ; ")}`, "cmd.confirmBlocked", bl);
  }
  // Revérifier les limites au moment de la confirmation (elles ont pu changer).
  const blockers = commandBlockers(d, c.action, c.duration_s);
  if (blockers.length) throw new ApiFailure(409, `Commande refusée : ${blockers.join(" ; ")}`, "cmd.blocked", blockers);
  await sql(`UPDATE device_commands SET status='confirmed', confirmed_by=$2, confirmed_at=now(), preauthorized_by=$3, expires_at=now() + ($4 || ' seconds')::interval WHERE id=$1`,
    [c.id, u?.id ?? null, preauthorizedBy, String(PICKUP_WINDOW_S)]);
  await audit(u?.id ?? preauthorizedBy, u ? "human" : "system", "command.confirm", { kind: "device_command", id: c.id }, { preauthorized: !!preauthorizedBy });
}

/** Arrêt d'urgence logiciel : annule toute commande en attente et envoie « estop » en priorité. Le matériel garde son arrêt câblé. */
export async function emergencyStop(d: DeviceRow, u: User, rcSession: string | null) {
  await sql("UPDATE device_commands SET status='cancelled' WHERE device_id=$1 AND status IN ('proposed','confirmed')", [d.id]);
  const c = (await sql<{ id: string }>(`INSERT INTO device_commands(device_id, action, proposed_by, proposer_id, reason, status, confirmed_by, confirmed_at, expires_at, rc_session_id)
    VALUES ($1,'estop','estop',$2,'Arrêt d''urgence','confirmed',$2,now(), now() + interval '1 hour', $3) RETURNING id`, [d.id, u.id, rcSession]))[0];
  await audit(u.id, "human", "command.estop", { kind: "device", id: d.id }, { command: c.id });
  return c.id;
}

/** Récupération par l'appareil : commandes confirmées non expirées (priorité à l'arrêt d'urgence), marquées « envoyées ». */
export async function pickup(d: DeviceRow) {
  await expireCommands();
  const rows = await sql<{ id: string; action: string; duration_s: number | null; params: unknown }>(`UPDATE device_commands SET status='sent', sent_at=now()
    WHERE device_id=$1 AND status='confirmed' AND expires_at > now() RETURNING id, action, duration_s, params`, [d.id]);
  await sql("UPDATE devices SET last_seen=now() WHERE id=$1", [d.id]);
  return rows.sort((a, b) => (a.action === "estop" ? -1 : b.action === "estop" ? 1 : 0));
}

export async function acknowledge(d: DeviceRow, commandId: string, ok: boolean, payload: Record<string, unknown>) {
  const c = await sqlOne<CommandRow>("SELECT * FROM device_commands WHERE id=$1 AND device_id=$2", [commandId, d.id]);
  if (!c) throw new ApiFailure(404, "Commande introuvable", "err.notFound");
  if (c.status !== "sent") throw new ApiFailure(409, `Accusé inattendu (état : ${c.status})`, "cmd.state");
  await sql("UPDATE device_commands SET status=$2, ack_at=now(), ack_payload=$3 WHERE id=$1", [c.id, ok ? "acknowledged" : "failed", JSON.stringify({ ok, ...payload })]);
  await audit(null, "device", ok ? "command.ack" : "command.fail", { kind: "device_command", id: c.id }, { device: d.id, payload });
  if (!ok) await notify(d.owner_id, "command.failed", `Échec signalé par ${d.name} : ${c.action}`, JSON.stringify(payload).slice(0, 200), "/remote");
}

/** Évalue les scénarios actifs déclenchés par cet appareil (déterministe ; aucune décision prise par l'IA). */
export async function evaluateAutomations(deviceId: string) {
  if (!(await getSetting("automations_enabled", true))) return;
  const autos = await sql<{ id: string; owner_id: string; name: string; spec: unknown; preauthorized: boolean; preauthorized_by: string | null; last_fired_at: string | null }>(
    "SELECT * FROM automations WHERE enabled=true AND spec->'trigger'->>'device_id'=$1", [deviceId]);
  for (const a of autos) {
    const parsed = automationSpec.safeParse(a.spec);
    if (!parsed.success) continue;
    const s = parsed.data;
    const latest = await sqlOne<{ ts: string; value: number; quality: string }>("SELECT ts, value, quality FROM measurements WHERE device_id=$1 AND metric=$2 ORDER BY ts DESC LIMIT 1", [deviceId, s.trigger.metric]);
    const runsToday = (await sqlOne<{ n: number }>("SELECT COUNT(*)::int n FROM automation_runs WHERE automation_id=$1 AND outcome<>'skipped' AND created_at > date_trunc('day', now())", [a.id]))?.n ?? 0;
    const ev = evaluate(s, latest ? { ts: new Date(latest.ts).toISOString(), value: latest.value, quality: latest.quality } : null, a.last_fired_at ? new Date(a.last_fired_at).toISOString() : null, runsToday);
    if (!ev.fire) continue;
    await sql("UPDATE automations SET last_fired_at=now() WHERE id=$1", [a.id]);
    let outcome = "notified"; let commandId: string | null = null;
    try {
      if (s.action.kind === "command") {
        const target = await sqlOne<DeviceRow>("SELECT * FROM devices WHERE id=$1 AND owner_id=$2", [s.action.device_id, a.owner_id]);
        if (!target) throw new Error("appareil cible introuvable");
        const c = await proposeCommand(target, s.action.action, s.action.duration_s, "automation", a.owner_id, `Scénario « ${a.name} » : ${s.trigger.metric} = ${ev.reading.value} ${s.condition.op} ${s.condition.threshold}`);
        commandId = c.id;
        if (a.preauthorized && a.preauthorized_by) { await confirmCommand(c.id, null, a.preauthorized_by); outcome = "command_preauthorized"; }
        else outcome = "command_proposed";
      }
    } catch (e) { outcome = `error: ${e instanceof Error ? e.message : String(e)}`; }
    await sql("INSERT INTO automation_runs(automation_id, trigger, outcome, command_id) VALUES ($1,$2,$3,$4)", [a.id, JSON.stringify({ metric: s.trigger.metric, value: ev.reading.value, ts: ev.reading.ts }), outcome, commandId]);
    await notify(a.owner_id, "automation.fired", `Scénario « ${a.name} » déclenché`, `${s.trigger.metric} = ${ev.reading.value} (${s.condition.op} ${s.condition.threshold}) → ${outcome}`, "/automation");
    await audit(a.owner_id, "system", "automation.fire", { kind: "automation", id: a.id }, { outcome, value: ev.reading.value });
  }
}
