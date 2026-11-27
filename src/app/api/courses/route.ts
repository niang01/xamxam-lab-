import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { courseSchema } from "@/server/schemas";
import { can } from "@/lib/profiles";
import { audit } from "@/server/audit";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const items = await sql(`SELECT c.id, c.title, c.domain, c.level, c.lang, c.summary, c.published, c.author_id, COALESCE(u.display_name, 'XAM-XAM LAB') AS author, (c.builtin_key IS NOT NULL) AS builtin, jsonb_array_length(c.lessons) AS lessons_n, jsonb_array_length(c.quiz) AS quiz_n,
      e.best_score, (SELECT COUNT(*)::int FROM enrollments x WHERE x.course_id=c.id) AS learners
    FROM courses c LEFT JOIN users u ON u.id=c.author_id LEFT JOIN enrollments e ON e.course_id=c.id AND e.user_id=$1
    WHERE c.published OR c.author_id=$1 ORDER BY (c.builtin_key IS NULL), c.created_at DESC`, [u.id]);
  return ok({ items });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  if (!can(u.profile_kind, u.is_admin, "create_courses")) throw new ApiFailure(403, "Profil non autorisé à créer des cours", "err.capability");
  const b = await readInput(req, courseSchema);
  const c = (await sql<{ id: string }>(`INSERT INTO courses(author_id, title, domain, level, lang, summary, lessons, quiz, pass_mark, lab_link, published) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [u.id, b.title, b.domain, b.level, b.lang, b.summary ?? null, JSON.stringify(b.lessons), JSON.stringify(b.quiz), b.pass_mark, b.lab_link ?? null, b.published]))[0];
  await audit(u.id, "human", "course.create", { kind: "course", id: c.id });
  return ok({ id: c.id }, 201);
});
