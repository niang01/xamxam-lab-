import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ peer: z.string().uuid() }));
  await sql("DELETE FROM rtc_peers WHERE id=$1 AND project_id=$2 AND user_id=$3", [b.peer, id, u.id]);
  await sql("DELETE FROM rtc_signals WHERE to_peer=$1 OR from_peer=$1", [b.peer]);
  return ok({ ok: true });
});
