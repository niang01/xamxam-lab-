import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { mustAccess, mustAuthor, readUpload } from "@/server/fad";
import { notify } from "@/server/settings";

type Ctx = { params: Promise<{ aid: string }> };
type A = { id: string; course_id: string; title: string; due_at: string | null };
const load = async (aid: string) => { const a = await sqlOne<A>("SELECT id, course_id, title, due_at FROM course_assignments WHERE id=$1", [aid]); if (!a) throw new ApiFailure(404, "Devoir introuvable", "err.notFound"); return a; };

/** Formateur : toutes les remises (sans les fichiers). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const a = await load(await uuidParam(ctx, "aid"));
  await mustAuthor(a.course_id, u);
  return ok({ items: await sql("SELECT s.id, s.user_id, u.display_name, s.text, s.file_name, s.submitted_at, s.late, s.grade, s.feedback FROM assignment_submissions s JOIN users u ON u.id=s.user_id WHERE s.assignment_id=$1 ORDER BY s.submitted_at", [a.id]) });
});

/** Apprenant inscrit : remise (texte et/ou fichier) ; une remise par devoir, remplaçable tant qu'elle n'est pas notée. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const a = await load(await uuidParam(ctx, "aid"));
  const r = await mustAccess(a.course_id, u);
  if (!r.enrolled) throw new ApiFailure(403, "Seuls les apprenants inscrits remettent un devoir", "fad.err.enroll");
  const prev = await sqlOne<{ grade: number | null }>("SELECT grade FROM assignment_submissions WHERE assignment_id=$1 AND user_id=$2", [a.id, u.id]);
  if (prev && prev.grade != null) throw new ApiFailure(409, "Devoir déjà corrigé : nouvelle remise impossible", "fad.err.graded");
  const form = await req.formData().catch(() => null);
  const text = String(form?.get("text") ?? "").trim().slice(0, 50000) || null;
  const file = await readUpload(form?.get("file") ?? null);
  if (!text && !file) throw new ApiFailure(400, "Réponse écrite ou fichier requis", "err.invalid");
  const late = !!a.due_at && Date.now() > new Date(a.due_at).getTime();
  await sql(`INSERT INTO assignment_submissions(assignment_id, user_id, text, file_name, file_mime, file_data, late) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (assignment_id, user_id) DO UPDATE SET text=$3, file_name=$4, file_mime=$5, file_data=$6, late=$7, submitted_at=now()`,
    [a.id, u.id, text, file?.name ?? null, file?.mime ?? null, file ? Buffer.from(file.bytes) : null, late]);
  const author = await sqlOne<{ author_id: string }>("SELECT author_id FROM courses WHERE id=$1", [a.course_id]);
  if (author?.author_id) await notify(author.author_id, "course", "Nouvelle remise", `${u.display_name} a remis « ${a.title} »${late ? " (en retard)" : ""}.`, `/academy/${a.course_id}`);
  return ok({ ok: true, late }, 201);
});
