import { createHash } from "node:crypto";
import { ok, endpoint, mustBeSignedIn, throttle, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { audit } from "@/server/audit";
import { extract, ExtractError, MAX_BYTES, SUPPORTED_EXTENSIONS } from "@/server/docs/extract";
import { analyseText } from "@/server/docs/process";

/** Mes documents (sans le texte complet). */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ formats: SUPPORTED_EXTENSIONS, max_mb: MAX_BYTES / 1048576, items: await sql(`SELECT id, filename, kind, size_bytes, pages, ocr, project_id, created_at,
    COALESCE(jsonb_array_length(report->'exercises'), 0) AS exercises FROM documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200`, [u.id]) });
});

/** Dépôt (multipart/form-data : file, instructions?, project_id?) → extraction → analyse → rapport enregistré. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, `documents-${u.id}`, 30, 60 * 60_000);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 1024 * 1024) throw new ApiFailure(413, `Fichier trop volumineux (maximum ${MAX_BYTES / 1048576} Mo)`, "doc.tooBig");
  let form: FormData;
  try { form = await req.formData(); } catch { throw new ApiFailure(400, "Envoi de fichier invalide (formulaire multipart attendu)", "err.invalid"); }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiFailure(400, "Aucun fichier reçu", "doc.noFile");
  const instructions = String(form.get("instructions") ?? "").slice(0, 2000) || null;
  const projectId = String(form.get("project_id") ?? "") || null;
  if (projectId) await requireProject(projectId, u, "editor");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.replace(/[\\/]/g, "_").slice(0, 200) || "document";
  let x;
  try { x = await extract(name, bytes); }
  catch (e) { if (e instanceof ExtractError || e instanceof Error) throw new ApiFailure(422, e.message, "doc.extract"); throw e; }
  const text = x.text.slice(0, 2_000_000);
  if (!text.trim()) throw new ApiFailure(422, x.ocr ? "Aucun texte reconnu (image illisible ou sans texte)" : "Aucun texte lisible dans ce document", "doc.empty");
  const report = analyseText(text, x.tables, x.warnings);
  const row = (await sql<{ id: string }>(`INSERT INTO documents(user_id, project_id, filename, kind, size_bytes, sha256, pages, ocr, extracted_text, tables, report, instructions)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [u.id, projectId, name, x.kind, bytes.length, createHash("sha256").update(bytes).digest("hex"), x.pages, x.ocr, text, JSON.stringify(x.tables.slice(0, 50)), JSON.stringify(report), instructions]))[0];
  await audit(u.id, "human", "document.analyse", { kind: "document", id: row.id }, { kind: x.kind, size: bytes.length, ocr: x.ocr });
  return ok({ id: row.id, kind: x.kind, pages: x.pages, ocr: x.ocr, chars: text.length, tables: x.tables.length, exercises: report.exercises.length }, 201);
});
