import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { mustAuthor } from "@/server/fad";
import { notify } from "@/server/settings";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ sid: string }> };
type S = { id: string; user_id: string; file_name: string | null; file_mime: string | null; file_data: Uint8Array | null; course_id: string; max_points: number; title: string };
const load = async (sid: string) => {
  const s = await sqlOne<S>("SELECT s.id, s.user_id, s.file_name, s.file_mime, s.file_data, a.course_id, a.max_points, a.title FROM assignment_submissions s JOIN course_assignments a ON a.id=s.assignment_id WHERE s.id=$1", [sid]);
  if (!s) throw new ApiFailure(404, "Remise introuvable", "err.notFound"); return s;
};

/** Fichier remis : l'apprenant lui-même ou le formateur. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await load(await uuidParam(ctx, "sid"));
  if (s.user_id !== u.id) await mustAuthor(s.course_id, u);
  if (!s.file_data) throw new ApiFailure(404, "Aucun fichier remis", "err.notFound");
  return new Response(new Uint8Array(s.file_data) as BodyInit, { headers: { "Content-Type": s.file_mime ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${encodeURIComponent(s.file_name ?? "remise")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
});

/** Correction par le formateur : note (≤ barème) et appréciation ; l'apprenant est notifié. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await load(await uuidParam(ctx, "sid"));
  await mustAuthor(s.course_id, u);
  const b = await readInput(req, z.object({ grade: z.number().min(0), feedback: z.string().trim().max(5000).nullable().default(null) }));
  if (b.grade > Number(s.max_points)) throw new ApiFailure(400, `Note supérieure au barème (${s.max_points})`, "err.invalid");
  await sql("UPDATE assignment_submissions SET grade=$2, feedback=$3, graded_by=$4, graded_at=now() WHERE id=$1", [s.id, b.grade, b.feedback, u.id]);
  await notify(s.user_id, "course", "Devoir corrigé", `« ${s.title} » : ${b.grade} / ${s.max_points}`, `/academy/${s.course_id}`);
  await audit(u.id, "human", "fad.grade", { kind: "submission", id: s.id }, { grade: b.grade });
  return ok({ ok: true });
});
