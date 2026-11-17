import { ok, endpoint, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** Portfolio public : seulement si le titulaire l'a activé ; seuls les projets publics et les certificats figurent. */
export const GET = endpoint<Ctx>(async (_req, ctx) => {
  const id = await uuidParam(ctx);
  const u = await sqlOne<{ id: string; display_name: string; profile_kind: string; country: string | null; bio: string | null; skills: string[] }>("SELECT id, display_name, profile_kind, country, bio, skills FROM users WHERE id=$1 AND public_profile AND status='active'", [id]);
  if (!u) throw new ApiFailure(404, "Portfolio non public ou introuvable", "err.notFound");
  const projects = await sql("SELECT id, title, description, kind, updated_at FROM projects WHERE owner_id=$1 AND visibility='public' ORDER BY updated_at DESC", [id]);
  const certificates = await sql("SELECT c.id, k.title, c.score, c.issued_at FROM certificates c JOIN courses k ON k.id=c.course_id WHERE c.user_id=$1 ORDER BY c.issued_at DESC", [id]);
  const startups = await sql("SELECT id, title FROM eco_items WHERE owner_id=$1 AND kind='startup' AND status='published'", [id]);
  return ok({ user: u, projects, certificates, startups });
});
