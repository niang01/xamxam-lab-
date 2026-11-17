import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { requireProject } from "@/server/access";
import { requireSchematic } from "@/server/schematics";
import { analysisSchema, graphSchema } from "@/server/schemas";
import { simulateGraph } from "@/server/simulate";

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "simulate", 60);
  const b = await readInput(req, z.object({ graph: graphSchema, analysis: analysisSchema, project_id: z.string().uuid().nullable().optional(), schematic_id: z.string().uuid().nullable().optional(), title: z.string().max(80).optional() }));
  let projectId = b.project_id ?? null;
  if (b.schematic_id) { const s = await requireSchematic(b.schematic_id, u, false); projectId = projectId ?? s.project_id; }
  if (projectId) await requireProject(projectId, u, "editor");
  const r = await simulateGraph(b.graph, b.analysis, { userId: u.id, projectId, schematicId: b.schematic_id ?? null, by: "human", title: b.title });
  return ok(r, r.ok ? 200 : 422);
});
