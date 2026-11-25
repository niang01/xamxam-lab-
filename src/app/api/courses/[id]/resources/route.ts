import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { mustAccess, mustAuthor, readUpload } from "@/server/fad";

type Ctx = { params: Promise<{ id: string }> };
/** Ressources du cours (sans les données binaires). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await mustAccess(id, u);
  return ok({ items: await sql("SELECT id, lesson_index, kind, title, url, file_name, mime, size_bytes, created_at FROM course_resources WHERE course_id=$1 ORDER BY created_at", [id]) });
});

/** Ajout par le formateur : fichier (multipart « file ») ou lien vidéo https (« url »). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await mustAuthor(id, u);
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiFailure(400, "Formulaire attendu", "err.invalid");
  const title = String(form.get("title") ?? "").trim().slice(0, 160);
  if (title.length < 2) throw new ApiFailure(400, "Titre requis", "err.invalid");
  const li = form.get("lesson_index"); const lessonIndex = li === null || li === "" ? null : Number(li);
  const url = String(form.get("url") ?? "").trim();
  const file = await readUpload(form.get("file"));
  if (!file && !url) throw new ApiFailure(400, "Fichier ou lien vidéo requis", "err.invalid");
  if (url && !/^https:\/\/[^\s]+$/.test(url)) throw new ApiFailure(400, "Lien https requis", "err.invalid");
  const r = (await sql<{ id: string }>(`INSERT INTO course_resources(course_id, lesson_index, kind, title, url, file_name, mime, size_bytes, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [id, Number.isInteger(lessonIndex) ? lessonIndex : null, file ? "file" : "video_link", title, file ? null : url, file?.name ?? null, file?.mime ?? null, file?.bytes.length ?? null, file ? Buffer.from(file.bytes) : null]))[0];
  return ok({ id: r.id }, 201);
});
