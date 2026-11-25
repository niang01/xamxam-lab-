import { endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sqlOne } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };
export const GET = endpoint<Ctx>(async (req, ctx) => {
  await mustBeSignedIn(req);
  const img = await sqlOne<{ mime: string; data: Uint8Array }>("SELECT mime, data FROM listing_images WHERE id=$1", [await uuidParam(ctx)]);
  if (!img) throw new ApiFailure(404, "Image introuvable", "err.notFound");
  return new Response(new Uint8Array(img.data) as BodyInit, { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
});
