import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { profileOf, requireDrone, stateOf } from "@/server/drones";
import { droneProfile } from "@/lib/drone";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDrone(await uuidParam(ctx), u, false);
  const commands = await sql("SELECT id, action, params, status, proposed_by, created_at, confirmed_at, ack_at, ack_payload FROM device_commands WHERE device_id=$1 ORDER BY created_at DESC LIMIT 30", [d.id]);
  const missions = await sql("SELECT id, name, waypoints, check_result, weather, status, simulated_on, created_at FROM drone_missions WHERE device_id=$1 OR simulated_on=$1 ORDER BY created_at DESC LIMIT 30", [d.id]);
  return ok({ device: d, profile: await profileOf(d.id), state: await stateOf(d.id), commands, missions, now: new Date().toISOString() });
});

/** Profil constructeur / exploitation (limites). */
export const PUT = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDrone(await uuidParam(ctx), u, true);
  const p = await readInput(req, droneProfile);
  await sql(`INSERT INTO drone_profiles(device_id, profile, updated_by) VALUES ($1,$2,$3)
    ON CONFLICT (device_id) DO UPDATE SET profile=EXCLUDED.profile, updated_by=EXCLUDED.updated_by, updated_at=now()`, [d.id, JSON.stringify(p), u.id]);
  await audit(u.id, "human", "drone.profile", { kind: "device", id: d.id }, p);
  return ok({ ok: true });
});
