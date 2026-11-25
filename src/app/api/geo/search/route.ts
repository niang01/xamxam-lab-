import { z } from "zod";
import { ok, endpoint, mustBeSignedIn, ApiFailure, throttle } from "@/server/api";
import { searchPlaces } from "@/server/integrations/geo";

const p = z.object({ q: z.string().trim().min(2).max(80), lang: z.enum(["fr", "en"]).default("fr") });

/** Recherche de lieux avec autocomplétion (pays, région, ville) pour les logiciels de dimensionnement. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  void u; throttle(req, "geo-search", 60);
  const s = p.parse(Object.fromEntries(new URL(req.url).searchParams));
  try { return ok({ items: await searchPlaces(s.q, s.lang), source: "Open-Meteo Geocoding (GeoNames)" }); }
  catch (e) { throw new ApiFailure(502, e instanceof Error ? e.message : String(e)); }
});
