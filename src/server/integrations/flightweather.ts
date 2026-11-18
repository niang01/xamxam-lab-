/**
 * Prévisions météo pour les conditions de vol (PRÉDICTIONS de modèles, maille de quelques km — jamais une mesure sur
 * le lieu de vol) :
 *  - Open-Meteo (par défaut) : sans clé (quota gratuit par adresse IP, usage non commercial) ou avec OPEN_METEO_API_KEY
 *    (offre commerciale, hôte customer-api.open-meteo.com) ;
 *  - Meteomatics : avec le compte de XAM-XAM LAB (METEOMATICS_USERNAME / METEOMATICS_PASSWORD).
 * Chaque appel est journalisé (geo_requests) ; en cas d'échec, une erreur explicite — aucune valeur de remplacement.
 */
import { sql } from "../db";
import { env } from "../env";
import { outboundFetch } from "../outbound";
import type { WeatherHour } from "@/lib/drone";

export interface FlightForecast { source: string; nature: "prediction"; model: string; fetched_at: string; latitude: number; longitude: number; elevation_m: number | null; hours: WeatherHour[]; url: string }

const HOURLY = ["temperature_2m", "precipitation", "precipitation_probability", "weather_code", "cloud_cover", "visibility",
  "wind_speed_10m", "wind_speed_80m", "wind_speed_120m", "wind_direction_10m", "wind_gusts_10m", "is_day"] as const;

async function logReq(source: string, url: string, ok: boolean, status: number | null, error: string | null, count: number | null) {
  await sql("INSERT INTO geo_requests(source, url, ok, http_status, error, record_count) VALUES ($1,$2,$3,$4,$5,$6)", [source, url.replace(/apikey=[^&]+/, "apikey=***"), ok, status, error, count]);
}

export function openMeteoUrl(lat: number, lon: number, hours: number): string {
  const key = process.env.OPEN_METEO_API_KEY;
  const base = key ? "https://customer-api.open-meteo.com/v1/forecast" : `${process.env.OPEN_METEO_BASE_URL ?? "https://api.open-meteo.com"}/v1/forecast`;
  const q = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4), hourly: HOURLY.join(","), wind_speed_unit: "ms", timezone: "UTC", forecast_hours: String(hours) });
  if (key) q.set("apikey", key);
  return `${base}?${q}`;
}

type OMResponse = { latitude: number; longitude: number; elevation?: number; hourly?: Record<string, (number | string | null)[]>; error?: boolean; reason?: string };

/** Conversion de la réponse Open-Meteo (tableaux parallèles par variable) en heures typées ; variable absente → null. */
export function parseOpenMeteo(b: OMResponse): WeatherHour[] {
  const h = b.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error("Réponse Open-Meteo inattendue (pas de série horaire)");
  const num = (k: string, i: number) => { const v = h[k]?.[i]; return typeof v === "number" ? v : null; };
  return (h.time as string[]).map((time, i) => ({
    time, wind_10m_ms: num("wind_speed_10m", i), wind_80m_ms: num("wind_speed_80m", i), wind_120m_ms: num("wind_speed_120m", i),
    wind_dir_deg: num("wind_direction_10m", i), gust_10m_ms: num("wind_gusts_10m", i), precip_mm: num("precipitation", i),
    precip_prob_pct: num("precipitation_probability", i), visibility_m: num("visibility", i), cloud_cover_pct: num("cloud_cover", i),
    temperature_c: num("temperature_2m", i), is_day: num("is_day", i) == null ? null : num("is_day", i) === 1, weather_code: num("weather_code", i),
  }));
}

export async function openMeteoFlight(lat: number, lon: number, hours = 48, fetchImpl: typeof fetch = outboundFetch): Promise<FlightForecast> {
  const url = openMeteoUrl(lat, lon, hours);
  let status: number | null = null;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" } });
    status = r.status;
    const b = await r.json() as OMResponse;
    if (!r.ok || b.error) throw new Error(`Open-Meteo : ${b.reason ?? `HTTP ${r.status}`}`);
    const out = parseOpenMeteo(b);
    await logReq("open_meteo", url, true, status, null, out.length);
    return { source: process.env.OPEN_METEO_API_KEY ? "Open-Meteo (offre commerciale)" : "Open-Meteo", nature: "prediction", model: "best_match (meilleurs modèles disponibles pour la zone)", fetched_at: new Date().toISOString(), latitude: b.latitude, longitude: b.longitude, elevation_m: b.elevation ?? null, hours: out, url: url.replace(/apikey=[^&]+/, "apikey=***") };
  } catch (e) {
    const m = e instanceof Error ? (e.name === "TimeoutError" ? "Open-Meteo : délai dépassé" : e.message) : String(e);
    await logReq("open_meteo", url, false, status, m, null);
    throw new Error(m);
  }
}

/** Meteomatics : mêmes grandeurs, compte requis. Le code météo WMO n'est pas fourni par cette source (null). */
export async function meteomaticsFlight(lat: number, lon: number, hours = 48, fetchImpl: typeof fetch = outboundFetch): Promise<FlightForecast> {
  if (!env.meteomaticsUser || !env.meteomaticsPassword) throw new Error("Meteomatics non configuré (METEOMATICS_USERNAME / METEOMATICS_PASSWORD)");
  const start = new Date(); start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + (hours - 1) * 3600_000);
  const params = "wind_speed_10m:ms,wind_speed_100m:ms,wind_dir_10m:d,wind_gusts_10m_1h:ms,precip_1h:mm,t_2m:C,visibility:m,is_day:idx,total_cloud_cover:p";
  const url = `https://api.meteomatics.com/${start.toISOString().slice(0, 19)}Z--${end.toISOString().slice(0, 19)}Z:PT1H/${params}/${lat.toFixed(4)},${lon.toFixed(4)}/json`;
  let status: number | null = null;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(30000), headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${env.meteomaticsUser}:${env.meteomaticsPassword}`).toString("base64")}` } });
    status = r.status;
    if (r.status === 401 || r.status === 403) throw new Error("Meteomatics : identifiants refusés");
    if (!r.ok) throw new Error(`Meteomatics : HTTP ${r.status}`);
    const b = await r.json() as { data?: { parameter: string; coordinates: { dates: { date: string; value: number }[] }[] }[] };
    const series = new Map<string, Map<string, number>>();
    for (const p of b.data ?? []) series.set(p.parameter, new Map((p.coordinates[0]?.dates ?? []).map((d) => [d.date, d.value])));
    const times = [...(series.get("wind_speed_10m:ms")?.keys() ?? [])];
    if (!times.length) throw new Error("Réponse Meteomatics inattendue");
    const v = (k: string, t: string) => { const x = series.get(k)?.get(t); return typeof x === "number" && x > -666 ? x : null; };
    const hoursOut: WeatherHour[] = times.map((t) => ({
      time: t.slice(0, 16), wind_10m_ms: v("wind_speed_10m:ms", t), wind_80m_ms: null, wind_120m_ms: v("wind_speed_100m:ms", t), wind_dir_deg: v("wind_dir_10m:d", t),
      gust_10m_ms: v("wind_gusts_10m_1h:ms", t), precip_mm: v("precip_1h:mm", t), precip_prob_pct: null, visibility_m: v("visibility:m", t),
      cloud_cover_pct: v("total_cloud_cover:p", t), temperature_c: v("t_2m:C", t), is_day: v("is_day:idx", t) == null ? null : v("is_day:idx", t) === 1, weather_code: null,
    }));
    await logReq("meteomatics", url, true, status, null, hoursOut.length);
    return { source: "Meteomatics", nature: "prediction", model: "mix", fetched_at: new Date().toISOString(), latitude: lat, longitude: lon, elevation_m: null, hours: hoursOut, url };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    await logReq("meteomatics", url, false, status, m, null);
    throw new Error(m);
  }
}
