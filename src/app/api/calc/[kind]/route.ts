import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { runCalc } from "@/server/calc";
import { requireProject } from "@/server/access";

type Ctx = { params: Promise<{ kind: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const { kind } = await ctx.params;
  const b = await readInput(req, z.object({ project_id: z.string().uuid().nullable().optional(), input: z.unknown() }));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  return ok(await runCalc(kind, b.input, { userId: u.id, projectId: b.project_id ?? null, by: "human" }));
});
