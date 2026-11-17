import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireDevice } from "@/server/access";
import { expireCommands } from "@/server/iot";

type Ctx = { params: Promise<{ id: string }> };

/** Détail : journal, commandes de la session et télémétrie récente (mesures datées). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const s = await sqlOne<{ device_id: string }>("SELECT s.*, u.display_name AS pilot_name FROM rc_sessions s JOIN users u ON u.id=s.pilot_id WHERE s.id=$1", [id]);
  if (!s) throw new ApiFailure(404, "Session introuvable", "err.notFound");
  const device = await requireDevice(s.device_id, u, false);
  await expireCommands();
  const events = await sql("SELECT e.kind, e.payload, e.ts, u.display_name AS actor FROM rc_events e LEFT JOIN users u ON u.id=e.actor_id WHERE session_id=$1 ORDER BY ts DESC LIMIT 200", [id]);
  const commands = await sql("SELECT id, action, duration_s, status, proposed_by, created_at, ack_payload FROM device_commands WHERE device_id=$1 ORDER BY created_at DESC LIMIT 30", [s.device_id]);
  const telemetry = await sql("SELECT DISTINCT ON (metric) metric, value, unit, ts, quality FROM measurements WHERE device_id=$1 ORDER BY metric, ts DESC", [s.device_id]);
  return ok({ session: s, device, events, commands, telemetry, now: new Date().toISOString() });
});
