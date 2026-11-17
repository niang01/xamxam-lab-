import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { loadCourse } from "@/server/courses";

type Ctx = { params: Promise<{ id: string }> };

/** Suivi des apprenants (auteur du cours). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const c = await loadCourse(await uuidParam(ctx), u);
  if (c.author_id !== u.id && !u.is_admin) throw new ApiFailure(403, "Réservé à l'auteur", "err.forbidden");
  return ok({ items: await sql("SELECT u.display_name, e.lessons_done, e.best_score, e.attempts, e.created_at FROM enrollments e JOIN users u ON u.id=e.user_id WHERE e.course_id=$1 ORDER BY e.best_score DESC NULLS LAST", [c.id]) });
});
