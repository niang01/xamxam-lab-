import { z } from "zod";
import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { forecastFor, profileOf, requireDrone, stateOf } from "@/server/drones";
import { assessFlight } from "@/lib/drone";

type Ctx = { params: Promise<{ id: string }> };
const q = z.object({ lat: z.coerce.number().min(-90).max(90).optional(), lon: z.coerce.number().min(-180).max(180).optional(), alt: z.coerce.number().min(1).max(500).default(30), source: z.enum(["open-meteo", "meteomatics"]).default("open-meteo") });

/** Prévision horaire (48 h) et évaluation heure par heure selon le profil du drone. Toujours une PRÉVISION. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDrone(await uuidParam(ctx), u, false);
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const st = await stateOf(d.id);
  const lat = p.lat ?? st?.home_lat ?? null, lon = p.lon ?? st?.home_lon ?? null;
  if (lat == null || lon == null) throw new ApiFailure(409, "Point de vol inconnu : indiquer lat/lon ou attendre la télémétrie GPS", "drone.err.noHome");
  const profile = await profileOf(d.id);
  let f;
  try { f = await forecastFor(lat, lon, p.source); } catch (e) { throw new ApiFailure(502, e instanceof Error ? e.message : String(e), "drone.err.weather"); }
  return ok({ forecast: { ...f, hours: undefined }, profile_complete: !!profile, alt_m: p.alt,
    hours: f.hours.map((h) => ({ ...h, assessment: profile ? assessFlight(profile, h, p.alt) : null })),
    warning: "Prévision de modèle pour une maille de plusieurs kilomètres : ce n'est pas une mesure sur le lieu de vol. Observer les conditions sur place avant tout vol." });
});
