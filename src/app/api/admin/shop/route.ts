import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

/** Administration de la boutique : vendeurs (vérification), commandes, articles en rayon. */
export const GET = endpoint(async (req) => {
  await mustBeAdmin(req);
  return ok({
    vendors: await sql("SELECT v.*, u.email FROM shop_vendors v JOIN users u ON u.id=v.user_id ORDER BY v.created_at DESC"),
    orders: await sql("SELECT o.id, o.status, o.total_xof, o.has_unpriced, o.created_at, b.email AS buyer, s.email AS seller FROM shop_orders o LEFT JOIN users b ON b.id=o.buyer_id LEFT JOIN users s ON s.id=o.seller_id ORDER BY o.created_at DESC LIMIT 300"),
    listings: Number((await sql<{ n: number }>("SELECT COUNT(*)::int n FROM market_listings WHERE shop_section IS NOT NULL AND status='published'"))[0].n),
  });
});

export const POST = endpoint(async (req) => {
  const a = await mustBeAdmin(req);
  const b = await readInput(req, z.object({ vendor_id: z.string().uuid(), verified: z.boolean() }));
  await sql("UPDATE shop_vendors SET verified=$2, verified_by=$3, verified_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE user_id=$1", [b.vendor_id, b.verified, a.id]);
  await audit(a.id, "human", "shop.vendor.verify", { kind: "user", id: b.vendor_id }, { verified: b.verified });
  return ok({ ok: true });
});
