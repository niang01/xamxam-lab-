import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { grade, makeExam } from "@/lib/exercises";

/** Épreuve d'entraînement générée (énoncés sans corrigés). */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  const seed = Math.max(1, Math.min(1_000_000, Number(sp.get("seed") ?? Date.now() % 1_000_000) || 1));
  const n = Math.max(1, Math.min(10, Number(sp.get("n") ?? 5) || 5));
  const exam = makeExam(seed, n, sp.get("filiere") ?? undefined);
  return ok({ seed, n, filiere: sp.get("filiere"), questions: exam.map(({ answer, steps, ...q }) => { void steps; return { ...q, unit: answer.unit, label: answer.label }; }) });
});

/** Correction de l'épreuve : note sur 20 (barème égal), corrigés détaillés. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ seed: z.number().int().min(1).max(1_000_000), n: z.number().int().min(1).max(10), filiere: z.string().max(40).nullable().optional(), answers: z.array(z.number().finite().nullable()).max(10) }));
  const exam = makeExam(b.seed, b.n, b.filiere ?? undefined);
  const examId = `exam-${b.seed}-${b.n}-${b.filiere ?? "all"}`;
  const results = [];
  for (const [i, ex] of exam.entries()) {
    const given = b.answers[i];
    const g = given == null ? { correct: false, deviationPct: null } : grade(ex, given);
    await sql("INSERT INTO exercise_attempts(user_id, exercise_id, template, given, correct, exam_id) VALUES ($1,$2,$3,$4,$5,$6)", [u.id, ex.id, ex.template, given ?? null, g.correct, examId]);
    results.push({ id: ex.id, given, ...g, expected: ex.answer, steps: ex.steps });
  }
  const score = exam.length ? Math.round((results.filter((r) => r.correct).length / exam.length) * 20 * 100) / 100 : 0;
  return ok({ score, outOf: 20, results });
});
