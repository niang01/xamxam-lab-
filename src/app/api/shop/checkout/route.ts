import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { checkout } from "@/server/shop";
import { paymentStatus } from "@/server/payments";

/** Passage de commande : une commande par vendeur, paiement « à convenir » (aucun encaissement). */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, `checkout-${u.id}`, 20, 60 * 60_000);
  const b = await readInput(req, z.object({ delivery_method: z.enum(["pickup", "shipping", "digital", "onsite"]), delivery_address: z.string().trim().max(300).nullable().default(null), phone: z.string().trim().max(30).nullable().default(null), note: z.string().trim().max(1000).nullable().default(null) }));
  return ok({ orders: await checkout(u, b), payment: paymentStatus() }, 201);
});
