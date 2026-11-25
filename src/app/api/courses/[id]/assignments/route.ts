import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { mustAccess, mustAuthor } from "@/server/fad";

type Ctx = { params: Promise<{ id: string }> };
/** Devoirs, TD, TP, examens du cours ; l'apprenant voit sa propre remise et sa note. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const r = await mustAccess(id, u);
  const items = await sql(`SELECT a.*, s.id AS submission_id, s.submitted_at, s.late, s.grade, s.feedback, s.file_name,
      (SELECT COUNT(*)::int FROM assignment_submissions x WHERE x.assignment_id=a.id) AS submissions,
      (SELECT COUNT(*)::int FROM assignment_submissions x WHERE x.assignment_id=a.id AND x.grade IS NULL) AS to_grade
    FROM course_assignments a LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.user_id=$2 WHERE a.course_id=$1 ORDER BY a.due_at NULLS LAST, a.created_at`, [id, u.id]);
  return ok({ author: r.author, items });
});

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await mustAuthor(id, u);
  const b = await readInput(req, z.object({ kind: z.enum(["devoir", "td", "tp", "examen"]), title: z.string().trim().min(2).max(160), instructions: z.string().trim().min(5).max(20000), due_at: z.string().datetime({ offset: true }).nullable().default(null), max_points: z.number().positive().max(1000).default(20) }));
  const a = (await sql<{ id: string }>("INSERT INTO course_assignments(course_id, kind, title, instructions, due_at, max_points) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [id, b.kind, b.title, b.instructions, b.due_at, b.max_points]))[0];
  return ok({ id: a.id }, 201);
});
