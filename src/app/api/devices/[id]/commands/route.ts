import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { requireDevice } from "@/server/access";
import { confirmCommand, proposeCommand } from "@/server/iot";
import { sql } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** Commande initiée par une personne : proposée puis, si demandé et autorisé, confirmée par cette même personne. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, true);
  const b = await readInput(req, z.object({ action: z.string().regex(/^[a-z0-9_]{1,30}$/), duration_s: z.number().int().positive().nullable().optional(), reason: z.string().max(300).nullable().optional(), confirm: z.boolean().default(false), rc_session_id: z.string().uuid().nullable().optional() }));
  const c = await proposeCommand(d, b.action, b.duration_s ?? null, "user", u.id, b.reason ?? null, b.rc_session_id ?? null);
  if (b.confirm) await confirmCommand(c.id, u);
  if (b.rc_session_id) await sql("INSERT INTO rc_events(session_id, kind, payload, actor_id) VALUES ($1,'command',$2,$3)", [b.rc_session_id, JSON.stringify({ command: c.id, action: b.action, duration_s: b.duration_s ?? null }), u.id]);
  return ok({ id: c.id, status: b.confirm ? "confirmed" : "proposed" }, 201);
});
