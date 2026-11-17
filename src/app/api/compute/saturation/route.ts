import { z } from "zod";
import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { FLUIDS, runCompute } from "@/server/compute";

export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const fluid = z.enum(FLUIDS).parse(new URL(req.url).searchParams.get("fluid"));
  return ok(await runCompute("thermo_saturation", { fluid }, 60000));
});
