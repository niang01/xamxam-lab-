import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { courseSchema } from "@/server/schemas";
import { loadCourse } from "@/server/courses";

type Ctx = { params: Promise<{ id: string }> };

/** Les bonnes réponses du quiz ne sont transmises qu'à l'auteur. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const c = await loadCourse(await uuidParam(ctx), u);
  const author = c.author_id === u.id;
  const enrollment = await sqlOne("SELECT lessons_done, best_score, attempts FROM enrollments WHERE course_id=$1 AND user_id=$2", [c.id, u.id]);
  const certificate = await sqlOne("SELECT id, score, issued_at FROM certificates WHERE course_id=$1 AND user_id=$2", [c.id, u.id]);
  return ok({ ...c, quiz: author ? c.quiz : c.quiz.map((x) => ({ q: x.q, choices: x.choices })), is_author: author, enrollment, certificate });
});

export const PUT = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const c = await loadCourse(await uuidParam(ctx), u);
  if (c.author_id !== u.id) throw new ApiFailure(403, "Seul l'auteur modifie le cours", "err.forbidden");
  const b = await readInput(req, courseSchema);
  await sql(`UPDATE courses SET title=$2, domain=$3, level=$4, lang=$5, summary=$6, lessons=$7, quiz=$8, pass_mark=$9, lab_link=$10, published=$11 WHERE id=$1`,
    [c.id, b.title, b.domain, b.level, b.lang, b.summary ?? null, JSON.stringify(b.lessons), JSON.stringify(b.quiz), b.pass_mark, b.lab_link ?? null, b.published]);
  return ok({ ok: true });
});
