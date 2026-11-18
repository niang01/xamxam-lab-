import { ok, endpoint, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";

/** Modération : signalements ouverts et récents, annonces masquées. */
export const GET = endpoint(async (req) => {
  await mustBeAdmin(req);
  const reports = await sql(`SELECT r.id, r.reason, r.details, r.status, r.created_at, r.handled_at, l.id AS listing_id, l.title, l.moderation, l.status AS listing_status,
      s.display_name AS seller, p.display_name AS reporter
    FROM market_reports r JOIN market_listings l ON l.id=r.listing_id JOIN users s ON s.id=l.seller_id JOIN users p ON p.id=r.reporter_id
    ORDER BY (r.status='open') DESC, r.created_at DESC LIMIT 200`);
  const hidden = await sql(`SELECT l.id, l.title, l.moderation_note, l.updated_at, s.display_name AS seller FROM market_listings l JOIN users s ON s.id=l.seller_id
    WHERE l.moderation='hidden' ORDER BY l.updated_at DESC LIMIT 200`);
  return ok({ reports, hidden });
});
