import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";
import { ownListing, readableListing } from "@/server/market";
import { canMoveListing, isIntangible, listingPatch, type Category } from "@/lib/market";

type Ctx = { params: Promise<{ id: string }> };

/** Détail d'une annonce : pour le vendeur, les demandes reçues ; pour un acheteur, sa demande en cours. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const listing = await readableListing(await uuidParam(ctx), u);
  const isSeller = listing.seller_id === u.id;
  const inquiries = isSeller
    ? await sql(`SELECT i.id, i.status, i.quantity, i.created_at, b.display_name AS buyer_name,
        (SELECT m.body FROM market_messages m WHERE m.inquiry_id=i.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
        FROM market_inquiries i JOIN users b ON b.id=i.buyer_id WHERE i.listing_id=$1 ORDER BY i.created_at DESC`, [listing.id])
    : await sql("SELECT id, status, quantity, created_at FROM market_inquiries WHERE listing_id=$1 AND buyer_id=$2 ORDER BY created_at DESC", [listing.id, u.id]);
  const reported = !!(await sqlOne("SELECT 1 FROM market_reports WHERE listing_id=$1 AND reporter_id=$2 AND status='open'", [listing.id, u.id]));
  return ok({ listing, isSeller, inquiries, reported });
});

export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const current = await ownListing(await uuidParam(ctx), u);
  const b = await readInput(req, listingPatch);
  if (b.status && !canMoveListing(current.status, b.status)) throw new ApiFailure(409, `Passage « ${current.status} » → « ${b.status} » non permis`, "market.err.transition");
  if (current.status === "sold" || current.status === "withdrawn") throw new ApiFailure(409, "Annonce close : créez une nouvelle annonce", "market.err.closed");
  const condition = b.condition ?? current.condition;
  if (isIntangible(current.category as Category) !== (condition === "na")) throw new ApiFailure(400, "État incohérent avec la catégorie", "err.invalid");
  const fields: [string, unknown][] = [];
  for (const k of ["title", "description", "condition", "price_xof", "quantity", "location", "status"] as const) if (b[k] !== undefined) fields.push([k, b[k]]);
  if (b.delivery) fields.push(["delivery", JSON.stringify(b.delivery)]);
  if (b.specs) fields.push(["specs", JSON.stringify(b.specs)]);
  if (!fields.length) return ok({ ok: true });
  await sql(`UPDATE market_listings SET ${fields.map(([k], i) => `${k}=$${i + 2}`).join(", ")}, updated_at=now() WHERE id=$1`, [current.id, ...fields.map(([, v]) => v)]);
  if (b.status && b.status !== current.status) {
    await audit(u.id, "human", "market.listing.status", { kind: "market_listing", id: current.id }, { from: current.status, to: b.status });
    // Annonce retirée ou vendue : les demandes encore ouvertes sont closes et les acheteurs prévenus.
    if (b.status === "sold" || b.status === "withdrawn") {
      const closed = await sql<{ buyer_id: string; id: string }>("UPDATE market_inquiries SET status='closed', updated_at=now() WHERE listing_id=$1 AND status IN ('open','accepted') RETURNING buyer_id, id", [current.id]);
      for (const c of closed) await notify(c.buyer_id, "market.closed", `Annonce « ${current.title} » ${b.status === "sold" ? "vendue" : "retirée"}`, "Votre demande a été close.", `/marketplace?demande=${c.id}`);
    }
  }
  return ok({ ok: true });
});

/** Suppression : uniquement sans demande reçue (sinon, retirer l'annonce pour garder l'historique des échanges). */
export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const l = await ownListing(await uuidParam(ctx), u);
  if (await sqlOne("SELECT 1 FROM market_inquiries WHERE listing_id=$1", [l.id])) throw new ApiFailure(409, "Des demandes existent : retirez l'annonce au lieu de la supprimer", "market.err.hasInquiries");
  await sql("DELETE FROM market_listings WHERE id=$1", [l.id]);
  await audit(u.id, "human", "market.listing.delete", { kind: "market_listing", id: l.id });
  return ok({ ok: true });
});
