import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { mustAccess, mustAuthor } from "@/server/fad";

type Ctx = { params: Promise<{ rid: string }> };
/** Téléchargement d'un document de cours (inscrits et formateur). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const r = await sqlOne<{ course_id: string; file_name: string; mime: string; data: Uint8Array | null }>("SELECT course_id, file_name, mime, data FROM course_resources WHERE id=$1", [await uuidParam(ctx, "rid")]);
  if (!r?.data) throw new ApiFailure(404, "Ressource introuvable", "err.notFound");
  await mustAccess(r.course_id, u);
  return new Response(new Uint8Array(r.data) as BodyInit, { headers: { "Content-Type": r.mime, "Content-Disposition": `attachment; filename="${encodeURIComponent(r.file_name)}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
});
export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const rid = await uuidParam(ctx, "rid");
  const r = await sqlOne<{ course_id: string }>("SELECT course_id FROM course_resources WHERE id=$1", [rid]);
  if (!r) throw new ApiFailure(404, "Ressource introuvable", "err.notFound");
  await mustAuthor(r.course_id, u);
  await sql("DELETE FROM course_resources WHERE id=$1", [rid]);
  return ok({ ok: true });
});
