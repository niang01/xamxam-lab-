import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { transition } from "@/server/shop";

type Ctx = { params: Promise<{ id: string }> };
/** Changement d'état d'une commande (vendeur : confirmer, refuser, expédier, livrer ; acheteur : annuler, réception). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ status: z.enum(["confirmed", "shipped", "delivered", "cancelled", "refused", "return_requested", "returned", "return_refused"]), note: z.string().trim().max(500).nullable().default(null) }));
  await transition(u, id, b.status, b.note);
  return ok({ ok: true });
});
