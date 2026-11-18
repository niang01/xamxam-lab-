/** XAM-XAM MARKETPLACE — accès aux données et contrôles d'accès (les règles pures sont dans src/lib/market.ts). */
import { sql, sqlOne } from "./db";
import { ApiFailure, type User } from "./api";
import type { InquiryStatus, ListingStatus } from "@/lib/market";

export interface ListingRow {
  id: string; seller_id: string; title: string; description: string; category: string; condition: string;
  price_xof: number | null; quantity: number | null; location: string | null; delivery: string[]; specs: { name: string; value: string }[];
  component_id: string | null; project_id: string | null; status: ListingStatus; moderation: "visible" | "hidden"; moderation_note: string | null;
  sponsored: boolean; created_at: string; updated_at: string;
}

export interface InquiryRow { id: string; listing_id: string; buyer_id: string; seller_id: string; status: InquiryStatus; quantity: number | null; title: string }

/**
 * Colonnes publiques d'une annonce + vendeur (nom, ancienneté, annonces actives et vendues) + favori du lecteur.
 * `viewer` : paramètre SQL de l'utilisateur courant (ex. "$5"). BIGINT converti en nombre.
 */
export const listingSelect = (viewer: string) => `SELECT EXISTS (SELECT 1 FROM market_favorites fv WHERE fv.listing_id=l.id AND fv.user_id=${viewer}) AS favorite, l.id, l.seller_id, l.title, l.description, l.category, l.condition, l.price_xof::float8 AS price_xof, l.quantity, l.location,
    l.delivery, l.specs, l.component_id, l.project_id, l.status, l.moderation, l.moderation_note, l.sponsored, l.created_at, l.updated_at,
    s.display_name AS seller_name, s.created_at AS seller_since,
    (SELECT COUNT(*)::int FROM market_listings x WHERE x.seller_id=l.seller_id AND x.status IN ('published','reserved') AND x.moderation='visible') AS seller_active,
    (SELECT COUNT(*)::int FROM market_listings x WHERE x.seller_id=l.seller_id AND x.status='sold') AS seller_sold,
    c.name AS component_name
  FROM market_listings l JOIN users s ON s.id=l.seller_id LEFT JOIN components c ON c.id=l.component_id`;

/** Annonce lisible par `user` : publique, ou propre au vendeur, ou administrateur. Sinon 404 (pas de fuite d'existence). */
export async function readableListing(id: string, user: User): Promise<ListingRow & Record<string, unknown>> {
  const l = await sqlOne<ListingRow & Record<string, unknown>>(`${listingSelect("$2")} WHERE l.id=$1`, [id, user.id]);
  const visible = l && (l.seller_id === user.id || user.is_admin || (l.moderation === "visible" && ["published", "reserved", "sold"].includes(l.status)));
  if (!l || !visible) throw new ApiFailure(404, "Annonce introuvable", "err.notFound");
  return l;
}

export async function ownListing(id: string, user: User): Promise<ListingRow> {
  const l = await sqlOne<ListingRow>("SELECT *, price_xof::float8 AS price_xof FROM market_listings WHERE id=$1", [id]);
  if (!l || (l.seller_id !== user.id && !user.is_admin)) throw new ApiFailure(404, "Annonce introuvable", "err.notFound");
  if (l.seller_id !== user.id) throw new ApiFailure(403, "Seul le vendeur peut modifier son annonce", "err.forbidden");
  return l;
}

/** Demande accessible aux deux seules parties (acheteur, vendeur). */
export async function inquiryFor(id: string, user: User): Promise<InquiryRow & { role: "buyer" | "seller" }> {
  const r = await sqlOne<InquiryRow>(`SELECT i.id, i.listing_id, i.buyer_id, l.seller_id, i.status, i.quantity, l.title
    FROM market_inquiries i JOIN market_listings l ON l.id=i.listing_id WHERE i.id=$1`, [id]);
  if (!r || (r.buyer_id !== user.id && r.seller_id !== user.id)) throw new ApiFailure(404, "Demande introuvable", "err.notFound");
  return { ...r, role: r.buyer_id === user.id ? "buyer" : "seller" };
}

export async function marketCounts(userId: string) {
  return (await sql<{ listings: number; open_received: number; open_sent: number }>(`SELECT
      (SELECT COUNT(*)::int FROM market_listings WHERE seller_id=$1 AND status IN ('draft','published','reserved')) AS listings,
      (SELECT COUNT(*)::int FROM market_inquiries i JOIN market_listings l ON l.id=i.listing_id WHERE l.seller_id=$1 AND i.status='open') AS open_received,
      (SELECT COUNT(*)::int FROM market_inquiries WHERE buyer_id=$1 AND status='open') AS open_sent`, [userId]))[0];
}
