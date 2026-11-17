import { sqlOne } from "./db";
import { ApiFailure, type User } from "./api";

export interface CourseRow { id: string; author_id: string; title: string; domain: string; level: string; lang: string; summary: string | null; lessons: { title: string; body: string }[]; quiz: { q: string; choices: string[]; answer: number }[]; pass_mark: number; lab_link: string | null; published: boolean }

export async function loadCourse(id: string, u: User): Promise<CourseRow> {
  const c = await sqlOne<CourseRow>("SELECT * FROM courses WHERE id=$1", [id]);
  if (!c || (!c.published && c.author_id !== u.id && !u.is_admin)) throw new ApiFailure(404, "Cours introuvable", "err.notFound");
  return c;
}

/** Correction déterministe d'un QCM : pourcentage de bonnes réponses (arrondi). */
export function grade(quiz: { answer: number }[], answers: (number | null)[]): number {
  if (!quiz.length) return 0;
  const ok = quiz.filter((x, i) => answers[i] === x.answer).length;
  return Math.round((100 * ok) / quiz.length);
}
