import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";

/** « Mon parcours » : cours suivis et progression, devoirs à rendre, notes, certificats ; côté formateur : remises à corriger. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const courses = await sql(`SELECT c.id, c.title, c.domain, c.level, jsonb_array_length(c.lessons) AS lessons, jsonb_array_length(e.lessons_done) AS done, e.best_score, c.pass_mark,
      (SELECT id FROM certificates x WHERE x.course_id=c.id AND x.user_id=$1) AS certificate_id
    FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 ORDER BY e.created_at DESC`, [u.id]);
  const todo = await sql(`SELECT a.id, a.title, a.kind, a.due_at, a.course_id, c.title AS course FROM course_assignments a JOIN courses c ON c.id=a.course_id JOIN enrollments e ON e.course_id=a.course_id AND e.user_id=$1
    WHERE NOT EXISTS (SELECT 1 FROM assignment_submissions s WHERE s.assignment_id=a.id AND s.user_id=$1) ORDER BY a.due_at NULLS LAST`, [u.id]);
  const grades = await sql(`SELECT a.title, a.kind, a.max_points, s.grade, s.feedback, s.graded_at, c.title AS course FROM assignment_submissions s JOIN course_assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id WHERE s.user_id=$1 ORDER BY s.submitted_at DESC`, [u.id]);
  const toGrade = await sql(`SELECT a.id, a.title, a.course_id, c.title AS course, COUNT(s.id)::int AS pending FROM course_assignments a JOIN courses c ON c.id=a.course_id JOIN assignment_submissions s ON s.assignment_id=a.id AND s.grade IS NULL
    WHERE c.author_id=$1 GROUP BY a.id, c.title ORDER BY a.created_at`, [u.id]);
  const exercises = await sql(`SELECT COUNT(*)::int AS tries, COUNT(*) FILTER (WHERE correct)::int AS correct FROM exercise_attempts WHERE user_id=$1`, [u.id]);
  return ok({ courses, todo, grades, toGrade, exercises: exercises[0] });
});
