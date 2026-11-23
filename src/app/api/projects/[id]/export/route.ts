import { endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { requireProject } from "@/server/access";
import { projectReportData } from "@/server/projects";
import { projectReportMarkdown, projectSlidesMarkdown } from "@/server/ai/analysis";

type Ctx = { params: Promise<{ id: string }> };

/** Export du rapport final (Markdown) ou du support de présentation (Markdown à diapositives « --- »). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "viewer");
  const format = new URL(req.url).searchParams.get("format") === "slides" ? "slides" : "md";
  const data = await projectReportData(id);
  const body = format === "slides" ? projectSlidesMarkdown(data) : projectReportMarkdown(data);
  const safe = data.project.title.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "projet";
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${safe}-${format === "slides" ? "presentation" : "rapport"}.md"`, "Cache-Control": "no-store" } });
});
