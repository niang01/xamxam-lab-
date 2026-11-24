import { endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { reportMarkdown } from "@/server/docs/process";
import { toDocx, toPdf, toXlsx } from "@/lib/docs/export";
import { myDocument } from "@/server/docs/store";

type Ctx = { params: Promise<{ id: string }> };
const TYPES = { md: "text/markdown; charset=utf-8", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" } as const;

/** Export du rapport : Markdown, Word, Excel (résultats + tableaux extraits) ou PDF. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await myDocument(await uuidParam(ctx), u.id);
  const f = (new URL(req.url).searchParams.get("format") ?? "md") as keyof typeof TYPES;
  const format = f in TYPES ? f : "md";
  const md = reportMarkdown(d.filename, d.report, d.tables);
  const base = `rapport-${d.filename.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[^\w-]+/g, "-").slice(0, 50)}`;
  let body: Uint8Array | string = md;
  if (format === "docx") body = toDocx(`Rapport d'analyse — ${d.filename}`, md, d.tables.slice(0, 10));
  if (format === "pdf") body = toPdf(`Rapport d'analyse — ${d.filename}`, md);
  if (format === "xlsx") {
    const results = [["Exercice", "Grandeur", "Valeur", "Unité", "Nature"]];
    d.report.exercises.forEach((e) => {
      for (const q of e.extracted) results.push([e.title, q.symbol, String(q.value), q.unit, "extrait du document"]);
      for (const o of Object.values(e.result?.outputs ?? {})) results.push([e.title, o.label, String(o.value), o.unit, "calculé"]);
      for (const m of e.missing) results.push([e.title, m, "", "", "manquant"]);
    });
    body = toXlsx([{ name: "Résultats", rows: results }, ...d.tables.slice(0, 20).map((rows, i) => ({ name: `Tableau ${i + 1}`, rows }))]);
  }
  return new Response(body as BodyInit, { headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename="${base}.${format}"`, "Cache-Control": "no-store" } });
});
