import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql, sqlOne } from "@/server/db";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const unread = (await sqlOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL", [u.id]))?.n ?? 0;
  if (new URL(req.url).searchParams.get("count")) return ok({ unread });
  const items = await sql("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200", [u.id]);
  return ok({ unread, items });
});

/** Marquer comme lu (toutes ou une). */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ id: z.string().uuid().optional() }));
  if (b.id) await sql("UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2", [b.id, u.id]);
  else await sql("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL", [u.id]);
  return ok({ ok: true });
});
