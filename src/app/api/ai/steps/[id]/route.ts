import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { approveStep } from "@/server/ai/core";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ approve: z.boolean() }));
  try { return ok(await approveStep(id, u, b.approve)); }
  catch (e) { throw new ApiFailure(409, e instanceof Error ? e.message : String(e), "ai.stepState"); }
});
