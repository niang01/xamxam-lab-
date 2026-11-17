import { z } from "zod";
import { ok, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { powerDaily } from "@/server/integrations/geo";

const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const p = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), start: d, end: d, params: z.string().regex(/^[A-Z0-9_,]+$/).max(200) });

export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const s = p.parse(Object.fromEntries(new URL(req.url).searchParams));
  if ((Date.parse(s.end) - Date.parse(s.start)) / 86400000 > 3660) throw new ApiFailure(400, "Période limitée à 10 ans", "err.invalid");
  try { return ok(await powerDaily(s.lat, s.lon, s.start, s.end, s.params.split(","))); }
  catch (e) { throw new ApiFailure(502, e instanceof Error ? e.message : String(e)); }
});
