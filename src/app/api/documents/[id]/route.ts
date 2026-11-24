import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { myDocument } from "@/server/docs/store";
import { analyseText, reportMarkdown } from "@/server/docs/process";

type Ctx = { params: Promise<{ id: string }> };


export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await myDocument(await uuidParam(ctx), u.id);
  return ok({ ...d, markdown: reportMarkdown(d.filename, d.report, d.tables) });
});

/** Ré-analyse après correction du texte extrait par l'utilisateur (ex. erreur d'OCR). */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await myDocument(await uuidParam(ctx), u.id);
  const b = await req.json().catch(() => null) as { text?: unknown } | null;
  if (!b || typeof b.text !== "string" || !b.text.trim() || b.text.length > 2_000_000) throw new ApiFailure(400, "Texte corrigé invalide", "err.invalid");
  const report = analyseText(b.text, d.tables, [...d.report.warnings.filter((w) => !/corrigé/.test(w)), "Texte corrigé par l'utilisateur avant analyse."]);
  await sql("UPDATE documents SET extracted_text=$2, report=$3 WHERE id=$1", [d.id, b.text, JSON.stringify(report)]);
  return ok({ ok: true, exercises: report.exercises.length });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await myDocument(await uuidParam(ctx), u.id);
  await sql("DELETE FROM documents WHERE id=$1", [d.id]);
  return ok({ ok: true });
});
