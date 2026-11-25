import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };
const MAX = 600 * 1024;
/** Image d'article (PNG, JPEG, WebP ; 600 Ko max ; 6 par article), servie par la plateforme (CSP sans tiers). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const l = await sqlOne<{ seller_id: string }>("SELECT seller_id FROM market_listings WHERE id=$1", [id]);
  if (!l || l.seller_id !== u.id) throw new ApiFailure(404, "Annonce introuvable", "err.notFound");
  const form = await req.formData().catch(() => null);
  const f = form?.get("image");
  if (!(f instanceof File)) throw new ApiFailure(400, "Image manquante", "err.invalid");
  const b = new Uint8Array(await f.arrayBuffer());
  if (b.length > MAX) throw new ApiFailure(413, "Image trop lourde (600 Ko maximum)", "shop.err.image");
  const mime = b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x52 && b[8] === 0x57 ? "image/webp" : null;
  if (!mime) throw new ApiFailure(400, "Format d'image non accepté (PNG, JPEG, WebP)", "shop.err.image");
  if (Number((await sqlOne<{ n: number }>("SELECT COUNT(*)::int n FROM listing_images WHERE listing_id=$1", [id]))!.n) >= 6) throw new ApiFailure(409, "6 images au maximum", "shop.err.image");
  const r = (await sql<{ id: string }>("INSERT INTO listing_images(listing_id, mime, data) VALUES ($1,$2,$3) RETURNING id", [id, mime, Buffer.from(b)]))[0];
  return ok({ id: r.id }, 201);
});
