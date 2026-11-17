import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireDevice } from "@/server/access";
import { emergencyStop } from "@/server/iot";

type Ctx = { params: Promise<{ id: string }> };

/** Arrêt d'urgence logiciel : toujours disponible, sans confirmation. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, false);
  const b = await readInput(req, z.object({ rc_session_id: z.string().uuid().nullable().optional() }));
  const id = await emergencyStop(d, u, b.rc_session_id ?? null);
  if (b.rc_session_id) {
    await sql("UPDATE rc_sessions SET status='estopped', ended_at=now() WHERE id=$1 AND status='active'", [b.rc_session_id]);
    await sql("INSERT INTO rc_events(session_id, kind, payload, actor_id) VALUES ($1,'estop',$2,$3)", [b.rc_session_id, JSON.stringify({ command: id }), u.id]);
  }
  return ok({ id });
});
