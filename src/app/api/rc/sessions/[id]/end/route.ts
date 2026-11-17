import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const s = await sqlOne<{ pilot_id: string; status: string }>("SELECT pilot_id, status FROM rc_sessions WHERE id=$1", [id]);
  if (!s || s.pilot_id !== u.id) throw new ApiFailure(404, "Session introuvable", "err.notFound");
  await sql("UPDATE rc_sessions SET status='ended', ended_at=now() WHERE id=$1 AND status='active'", [id]);
  await sql("INSERT INTO rc_events(session_id, kind, actor_id) VALUES ($1,'end',$2)", [id, u.id]);
  await audit(u.id, "human", "rc.end", { kind: "rc_session", id });
  return ok({ ok: true });
});
