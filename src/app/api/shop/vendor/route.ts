import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql, sqlOne } from "@/server/db";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ vendor: await sqlOne("SELECT * FROM shop_vendors WHERE user_id=$1", [u.id]),
    listings: await sql("SELECT id, title, price_xof, quantity, status, shop_section, datasheet_url FROM market_listings WHERE seller_id=$1 ORDER BY created_at DESC", [u.id]) });
});

/** Profil vendeur (la vérification est faite par un administrateur ; toute modification la retire). */
export const PUT = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ business_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).nullable().default(null), address: z.string().trim().max(300).nullable().default(null), description: z.string().trim().max(2000).nullable().default(null) }));
  await sql(`INSERT INTO shop_vendors(user_id, business_name, phone, address, description) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id) DO UPDATE SET business_name=$2, phone=$3, address=$4, description=$5, verified=false, verified_by=NULL, verified_at=NULL`, [u.id, b.business_name, b.phone, b.address, b.description]);
  return ok({ ok: true });
});
