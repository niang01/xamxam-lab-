import { z } from "zod";
import { ok, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { powerClimatology } from "@/server/integrations/geo";

const p = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), params: z.string().regex(/^[A-Z0-9_,]+$/).max(200).default("ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN") });

export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const s = p.parse(Object.fromEntries(new URL(req.url).searchParams));
  try { return ok(await powerClimatology(s.lat, s.lon, s.params.split(","))); }
  catch (e) { throw new ApiFailure(502, e instanceof Error ? e.message : String(e)); }
});
