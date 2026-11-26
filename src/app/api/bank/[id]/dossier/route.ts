import { endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { bankById } from "@/lib/bank";
import { dossierMarkdown } from "@/lib/bank/dossier";
import { toDocx, toPdf } from "@/lib/docs/export";

type Ctx = { params: Promise<{ id: string }> };
const TYPES = { md: "text/markdown; charset=utf-8", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf" } as const;

/** Dossier complet (35 rubriques) d'un projet de la banque : Markdown, Word, PDF. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  await mustBeSignedIn(req);
  const p = bankById((await ctx.params).id);
  if (!p) throw new ApiFailure(404, "Projet de la banque introuvable", "err.notFound");
  const f = new URL(req.url).searchParams.get("format") ?? "md";
  if (!(f in TYPES)) throw new ApiFailure(400, "Format inconnu", "err.invalid");
  const md = dossierMarkdown(p);
  const body: Uint8Array | string = f === "docx" ? toDocx(p.title, md) : f === "pdf" ? toPdf(p.title, md) : md;
  return new Response(body as BodyInit, { headers: { "content-type": TYPES[f as keyof typeof TYPES], "content-disposition": `attachment; filename="dossier-${p.id}.${f}"` } });
});
