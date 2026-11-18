import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";

/** Mes demandes : envoyées (acheteur) et reçues (vendeur), avec le dernier message. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const items = await sql(`SELECT i.id, i.status, i.quantity, i.created_at, i.updated_at, l.id AS listing_id, l.title, l.price_xof::float8 AS price_xof, l.status AS listing_status,
      CASE WHEN i.buyer_id=$1 THEN 'buyer' ELSE 'seller' END AS role,
      CASE WHEN i.buyer_id=$1 THEN s.display_name ELSE b.display_name END AS counterpart,
      (SELECT m.body FROM market_messages m WHERE m.inquiry_id=i.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT MAX(m.created_at) FROM market_messages m WHERE m.inquiry_id=i.id) AS last_at
    FROM market_inquiries i JOIN market_listings l ON l.id=i.listing_id JOIN users b ON b.id=i.buyer_id JOIN users s ON s.id=l.seller_id
    WHERE i.buyer_id=$1 OR l.seller_id=$1 ORDER BY last_at DESC NULLS LAST LIMIT 200`, [u.id]);
  return ok({ items });
});
