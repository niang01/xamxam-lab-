import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { grade, makeExercise, TEMPLATES } from "@/lib/exercises";

/** Catalogue des modèles, un énoncé (sans corrigé) ou ma progression. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  const template = sp.get("template");
  if (template) {
    const ex = makeExercise(template, Number(sp.get("variant") ?? 1));
    if (!ex) throw new ApiFailure(404, "Exercice introuvable", "err.notFound");
    const { answer, steps, ...statement } = ex;
    void steps;
    return ok({ ...statement, unit: answer.unit, label: answer.label });
  }
  const progress = await sql<{ template: string; tries: number; correct: number }>("SELECT template, COUNT(*)::int AS tries, COUNT(*) FILTER (WHERE correct)::int AS correct FROM exercise_attempts WHERE user_id=$1 GROUP BY template", [u.id]);
  return ok({ templates: TEMPLATES.map((t) => ({ key: t.key, title: t.title, filiere: t.filiere, level: t.level, method: t.method })), progress });
});

/** Correction d'une réponse : verdict, valeur attendue, étapes de résolution. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ template: z.string().max(40), variant: z.number().int().min(1).max(100000), answer: z.number().finite() }));
  const ex = makeExercise(b.template, b.variant);
  if (!ex) throw new ApiFailure(404, "Exercice introuvable", "err.notFound");
  const g = grade(ex, b.answer);
  await sql("INSERT INTO exercise_attempts(user_id, exercise_id, template, given, correct) VALUES ($1,$2,$3,$4,$5)", [u.id, ex.id, ex.template, b.answer, g.correct]);
  return ok({ ...g, expected: ex.answer, steps: ex.steps, method: ex.method });
});
