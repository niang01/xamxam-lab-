import { endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { softwareByKey } from "@/lib/studies";
import { studyMarkdown, studySheets } from "@/lib/studies/report";
import { toDocx, toPdf, toXlsx } from "@/lib/docs/export";
import { myStudy } from "@/server/studies";

type Ctx = { params: Promise<{ id: string }> };
const TYPES = { md: "text/markdown; charset=utf-8", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" } as const;

/** Rapport de dimensionnement : Markdown, Word, Excel, PDF. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await myStudy(await uuidParam(ctx), u);
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  if (!(format in TYPES)) throw new ApiFailure(400, "Format inconnu", "err.invalid");
  const sw = softwareByKey(s.software)!;
  const md = studyMarkdown(sw, s.title, s.inputs, s.result);
  const body: Uint8Array | string = format === "docx" ? toDocx(s.title, md, studySheets(sw, s.inputs, s.result).map((x) => x.rows)) : format === "pdf" ? toPdf(s.title, md) : format === "xlsx" ? toXlsx(studySheets(sw, s.inputs, s.result)) : md;
  const safe = s.title.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(0, 80) || "etude";
  return new Response(body as BodyInit, { headers: { "content-type": TYPES[format as keyof typeof TYPES], "content-disposition": `attachment; filename="${safe}.${format}"` } });
});
