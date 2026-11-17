import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { pythonBin, runCompute } from "@/server/compute";

/** Disponibilité réelle du moteur Python (versions de pvlib et CoolProp). */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  try { return ok({ available: true, python: pythonBin(), versions: await runCompute<Record<string, string | null>>("versions", {}, 30000) }); }
  catch (e) { return ok({ available: false, python: pythonBin(), error: e instanceof Error ? e.message : String(e) }); }
});
