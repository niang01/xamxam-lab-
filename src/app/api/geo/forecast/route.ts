import { z } from "zod";
import { ok, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { MeteomaticsNotConfigured, meteomaticsForecast } from "@/server/integrations/geo";

const p = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), days: z.coerce.number().int().min(1).max(10).default(7) });

export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const s = p.parse(Object.fromEntries(new URL(req.url).searchParams));
  try { return ok(await meteomaticsForecast(s.lat, s.lon, s.days)); }
  catch (e) {
    if (e instanceof MeteomaticsNotConfigured) throw new ApiFailure(503, e.message, "geo.err.meteomaticsMissing");
    throw new ApiFailure(502, e instanceof Error ? e.message : String(e), "geo.err.upstream");
  }
});
