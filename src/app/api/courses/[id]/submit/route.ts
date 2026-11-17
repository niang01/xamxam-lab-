import crypto from "node:crypto";
import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { grade, loadCourse } from "@/server/courses";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Correction côté serveur ; certificat délivré au premier score ≥ seuil (empreinte vérifiable publiquement). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const c = await loadCourse(await uuidParam(ctx), u);
  if (!c.quiz.length) throw new ApiFailure(400, "Ce cours n'a pas d'évaluation", "err.invalid");
  const b = await readInput(req, z.object({ answers: z.array(z.number().int().min(0).nullable()).length(c.quiz.length) }));
  const score = grade(c.quiz, b.answers);
  await sql(`INSERT INTO enrollments(course_id, user_id, best_score, attempts) VALUES ($1,$2,$3,1) ON CONFLICT (course_id, user_id)
    DO UPDATE SET best_score=GREATEST(COALESCE(enrollments.best_score,0), EXCLUDED.best_score), attempts=enrollments.attempts+1`, [c.id, u.id, score]);
  let certificate: { id: string } | null = null;
  if (score >= c.pass_mark && !(await sqlOne("SELECT 1 FROM certificates WHERE course_id=$1 AND user_id=$2", [c.id, u.id]))) {
    const issued = new Date().toISOString();
    const digest = crypto.createHash("sha256").update(JSON.stringify([c.id, u.id, score, issued])).digest("hex");
    certificate = (await sql<{ id: string }>("INSERT INTO certificates(course_id, user_id, score, digest, issued_at) VALUES ($1,$2,$3,$4,$5) RETURNING id", [c.id, u.id, score, digest, issued]))[0];
    await audit(u.id, "system", "certificate.issue", { kind: "certificate", id: certificate.id }, { course: c.id, score });
  }
  return ok({ score, pass_mark: c.pass_mark, passed: score >= c.pass_mark, correct: c.quiz.map((x, i) => b.answers[i] === x.answer), certificate });
});
