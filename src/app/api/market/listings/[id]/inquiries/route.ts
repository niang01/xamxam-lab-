import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure, throttle } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { notify } from "@/server/settings";
import { audit } from "@/server/audit";
import { readableListing } from "@/server/market";
import { inquiryRefusal } from "@/lib/market";

type Ctx = { params: Promise<{ id: string }> };

const REFUSALS: Record<string, [number, string, string]> = {
  own: [409, "Vous ne pouvez pas faire de demande sur votre propre annonce", "market.err.own"],
  unavailable: [409, "Annonce non disponible", "market.err.unavailable"],
  quantity: [400, "Quantité supérieure à la quantité disponible", "market.err.quantity"],
};

/** Demande d'un acheteur, avec un premier message au vendeur. Aucun engagement de paiement n'est pris par la plateforme. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "market-inquiry", 30, 60 * 60_000);
  const listing = await readableListing(await uuidParam(ctx), u);
  const b = await readInput(req, z.object({ message: z.string().trim().min(1).max(4000), quantity: z.number().int().positive().max(1_000_000).nullable().default(null) }));
  const refusal = inquiryRefusal(listing, u.id, b.quantity);
  if (refusal) { const [s, m, k] = REFUSALS[refusal]; throw new ApiFailure(s, m, k); }
  if (await sqlOne("SELECT 1 FROM market_inquiries WHERE listing_id=$1 AND buyer_id=$2 AND status IN ('open','accepted')", [listing.id, u.id])) {
    throw new ApiFailure(409, "Une demande est déjà en cours sur cette annonce", "market.err.duplicate");
  }
  const inq = (await sql<{ id: string }>("INSERT INTO market_inquiries(listing_id, buyer_id, quantity) VALUES ($1,$2,$3) RETURNING id", [listing.id, u.id, b.quantity]))[0];
  await sql("INSERT INTO market_messages(inquiry_id, author_id, body) VALUES ($1,$2,$3)", [inq.id, u.id, b.message]);
  await notify(listing.seller_id, "market.inquiry", `Nouvelle demande : ${listing.title}`, `${u.display_name} : ${b.message.slice(0, 140)}`, `/marketplace?demande=${inq.id}`);
  await audit(u.id, "human", "market.inquiry.create", { kind: "market_inquiry", id: inq.id }, { listing: listing.id });
  return ok({ id: inq.id }, 201);
});
