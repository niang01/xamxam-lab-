import crypto from "node:crypto";
import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure, throttle } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { runCompute } from "@/server/compute";
import { powerHourlyYear } from "@/server/integrations/geo";

const TEMP_MODELS = ["open_rack_glass_glass", "close_mount_glass_glass", "open_rack_glass_polymer", "insulated_back_glass_polymer"] as const;
const schema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), year: z.number().int().min(2001).max(new Date().getUTCFullYear() - 1),
  tilt: z.number().min(0).max(90), azimuth: z.number().min(0).max(360),
  pdc0_kw: z.number().positive().max(100000), gamma_pdc_pct: z.number().min(-1).max(0), losses_pct: z.number().min(0).max(50),
  inverter_eff: z.number().min(0.5).max(1), dc_ac_ratio: z.number().min(0.5).max(2), temp_model: z.enum(TEMP_MODELS),
});

/**
 * Simulation photovoltaïque HORAIRE (pvlib) sur une année réelle de données NASA POWER (modélisées, régionales).
 * Tous les paramètres de conception sont fournis par l'utilisateur (aucune valeur par défaut).
 */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "pv-hourly", 10);
  const b = await readInput(req, schema);
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  let weather;
  try { weather = await powerHourlyYear(b.lat, b.lon, b.year); } catch (e) { throw new ApiFailure(502, e instanceof Error ? e.message : String(e)); }
  const t0 = Date.now();
  const { url, fetched_at, ...w } = weather;
  const input = { ...b, ...w };
  delete (input as { project_id?: unknown }).project_id;
  const result = await runCompute<Record<string, unknown>>("pv_hourly", input);
  const versions = await runCompute<Record<string, string>>("versions", {});
  const label = `PV horaire ${b.year} — ${b.pdc0_kw} kWc, inclinaison ${b.tilt}°, azimut ${b.azimuth}°`;
  const desc = JSON.stringify({ ...b, weather: { source: "NASA POWER hourly (RE, UTC)", url, fetched_at } });
  const row = (await sql<{ id: string }>(`INSERT INTO simulations(project_id, user_id, engine, engine_version, kind, analysis, input, input_hash, status, result, duration_ms)
    VALUES ($1,$2,'pvlib',$3,'numerical_solver',$4,$5,$6,'done',$7,$8) RETURNING id`,
    [b.project_id ?? null, u.id, `pvlib ${versions.pvlib}`, label, desc, crypto.createHash("sha256").update(desc).digest("hex"), JSON.stringify({ pv: result }), Date.now() - t0]))[0];
  return ok({ id: row.id, nature: "simulation", engine: `pvlib ${versions.pvlib}`, weather: { source: "NASA POWER (horaire, donnée modélisée régionale)", url, fetched_at }, result });
});
