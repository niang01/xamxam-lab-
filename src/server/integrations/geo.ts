/**
 * Earth & Space Intelligence — connecteurs réels :
 *  - NASA POWER (API publique sans clé) : climatologie mensuelle et séries journalières. Données MODÉLISÉES
 *    (réanalyse MERRA-2 ~0,5° × 0,625°, rayonnement CERES ~1°) : échelle régionale, pas une mesure locale.
 *  - Meteomatics (identifiants serveur) : PRÉDICTIONS journalières (modèle « mix »).
 * Chaque appel est journalisé (geo_requests) ; aucune donnée n'est inventée en cas d'échec.
 */
import { sql } from "../db";
import { env } from "../env";
import { outboundFetch } from "../outbound";
import { buildMeteomaticsUrl, parseMeteomatics } from "@/lib/meteomatics";

export const POWER_RESOLUTION = "Météo ~0,5° × 0,625° (MERRA-2) ; rayonnement ~1° × 1° (CERES/SYN1DEG) — échelle régionale";
export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

/** Paramètres journaliers proposés (codes de l'API NASA POWER → libellé affiché, unité). */
const daily = (label: string, unit: string) => ({ label, unit });
export const DAILY_PARAMS: Record<string, { label: string; unit: string }> = {
  T2M: daily("Air à 2 m — moyenne", "°C"),
  T2M_MAX: daily("Air à 2 m — maximum", "°C"),
  T2M_MIN: daily("Air à 2 m — minimum", "°C"),
  RH2M: daily("Humidité relative de l'air (2 m)", "%"),
  PRECTOTCORR: daily("Précipitations corrigées", "mm/j"),
  WS2M: daily("Vitesse du vent (2 m)", "m/s"),
  ALLSKY_SFC_SW_DWN: daily("Irradiation globale horizontale", "kWh/m²/j"),
  GWETROOT: daily("Indice d'humidité du sol racinaire", "0–1"),
};

/** Construit l'adresse d'une requête POWER « point » (`kind` : climatology, daily, hourly). */
function powerEndpoint(kind: "climatology" | "daily" | "hourly", lat: number, lon: number, query: Record<string, string>): string {
  const target = new URL(`/api/temporal/${kind}/point`, env.nasaPowerBaseUrl);
  const all = { ...query, latitude: lat.toFixed(4), longitude: lon.toFixed(4), format: "JSON" };
  for (const [key, value] of Object.entries(all)) target.searchParams.set(key, value);
  return target.toString();
}

const powerHttpError = (status: number) => new Error(`Service NASA POWER indisponible (statut HTTP ${status})`);
const POWER_FILL = -999;

async function logReq(source: string, url: string, ok: boolean, status: number | null, error: string | null, count: number | null) {
  await sql("INSERT INTO geo_requests(source, url, ok, http_status, error, record_count) VALUES ($1,$2,$3,$4,$5,$6)", [source, url, ok, status, error, count]);
}

const errMsg = (e: unknown, what: string) => e instanceof Error ? (e.name === "TimeoutError" ? `Délai dépassé lors de l'appel ${what}` : e.message) : String(e);

export interface GeoSeries { source: string; nature: "modelled" | "prediction"; resolution: string; fetched_at: string; period: string; parameters: Record<string, { label: string; unit: string; values: { period: string; value: number | null }[] }>; url: string }

/** Climatologie mensuelle NASA POWER (communauté RE) : moyennes 2001–2025 selon l'API. */
export async function powerClimatology(lat: number, lon: number, params: string[], fetchImpl: typeof fetch = outboundFetch): Promise<GeoSeries> {
  const url = powerEndpoint("climatology", lat, lon, { parameters: params.join(","), community: "RE" });
  let status: number | null = null;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(40000), headers: { Accept: "application/json" } });
    status = r.status;
    if (!r.ok) throw powerHttpError(r.status);
    const b = await r.json() as { header?: { fill_value?: number; range?: string }; parameters?: Record<string, { units: string; longname: string }>; properties?: { parameter?: Record<string, Record<string, number>> } };
    const p = b.properties?.parameter;
    if (!p) throw new Error("Réponse NASA POWER inattendue");
    const fill = b.header?.fill_value ?? POWER_FILL;
    const out: GeoSeries["parameters"] = {};
    for (const [name, byMonth] of Object.entries(p)) {
      const unit = b.parameters?.[name]?.units === "kW-hr/m^2/day" ? "kWh/m²/j" : b.parameters?.[name]?.units ?? "";
      out[name] = { label: b.parameters?.[name]?.longname ?? name, unit, values: MONTHS.map((m, i) => { const v = byMonth[m]; return { period: `clim-${String(i + 1).padStart(2, "0")}`, value: typeof v === "number" && v !== fill && v > -998 ? v : null }; }) };
      for (const v of out[name].values) {
        await sql(`INSERT INTO geo_observations(source, lat, lon, period, parameter, value, unit, nature, resolution) VALUES ('nasa_power',$1,$2,$3,$4,$5,$6,'modelled',$7)
          ON CONFLICT (source, lat, lon, period, parameter) DO UPDATE SET value=EXCLUDED.value, fetched_at=now()`, [lat.toFixed(4), lon.toFixed(4), v.period, name, v.value, unit, POWER_RESOLUTION]);
      }
    }
    await logReq("nasa_power", url, true, status, null, Object.keys(out).length * 12);
    return { source: "NASA POWER (climatologie)", nature: "modelled", resolution: POWER_RESOLUTION, fetched_at: new Date().toISOString(), period: b.header?.range ?? "climatologie", parameters: out, url };
  } catch (e) {
    const m = errMsg(e, "NASA POWER");
    await logReq("nasa_power", url, false, status, m, null);
    throw new Error(m);
  }
}

/** Série journalière NASA POWER (communauté AG). Les valeurs récentes peuvent être absentes (latence de production). */
export async function powerDaily(lat: number, lon: number, start: string, end: string, params: string[], fetchImpl: typeof fetch = outboundFetch): Promise<GeoSeries> {
  const url = powerEndpoint("daily", lat, lon, { parameters: params.join(","), community: "AG", start: start.replaceAll("-", ""), end: end.replaceAll("-", "") });
  let status: number | null = null;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(40000), headers: { Accept: "application/json" } });
    status = r.status;
    if (!r.ok) throw powerHttpError(r.status);
    const b = await r.json() as { header?: { fill_value?: number }; properties?: { parameter?: Record<string, Record<string, number>> } };
    const p = b.properties?.parameter;
    if (!p) throw new Error("Réponse NASA POWER inattendue");
    const fill = b.header?.fill_value ?? POWER_FILL;
    const out: GeoSeries["parameters"] = {};
    let count = 0;
    for (const [name, byDate] of Object.entries(p)) {
      const meta = DAILY_PARAMS[name] ?? { label: name, unit: "" };
      out[name] = { ...meta, values: Object.entries(byDate).filter(([k]) => /^\d{8}$/.test(k)).map(([k, v]) => ({ period: `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`, value: typeof v === "number" && v !== fill && v > -998 ? v : null })) };
      for (const v of out[name].values) {
        count++;
        await sql(`INSERT INTO geo_observations(source, lat, lon, period, parameter, value, unit, nature, resolution) VALUES ('nasa_power',$1,$2,$3,$4,$5,$6,'modelled',$7)
          ON CONFLICT (source, lat, lon, period, parameter) DO UPDATE SET value=EXCLUDED.value, fetched_at=now()`, [lat.toFixed(4), lon.toFixed(4), v.period, name, v.value, meta.unit, POWER_RESOLUTION]);
      }
    }
    await logReq("nasa_power", url, true, status, null, count);
    return { source: "NASA POWER (journalier)", nature: "modelled", resolution: POWER_RESOLUTION, fetched_at: new Date().toISOString(), period: `${start} → ${end}`, parameters: out, url };
  } catch (e) {
    const m = errMsg(e, "NASA POWER");
    await logReq("nasa_power", url, false, status, m, null);
    throw new Error(m);
  }
}

export class MeteomaticsNotConfigured extends Error {
  constructor() { super("Prévisions Meteomatics non configurées : l'administrateur doit renseigner METEOMATICS_USERNAME et METEOMATICS_PASSWORD (compte Meteomatics de XAM-XAM LAB)."); this.name = "MeteomaticsNotConfigured"; }
}

/** Prévisions journalières Meteomatics (PRÉDICTIONS). Identifiants côté serveur uniquement. */
export async function meteomaticsForecast(lat: number, lon: number, days: number, fetchImpl: typeof fetch = outboundFetch): Promise<GeoSeries> {
  // Sans compte Meteomatics propre à XAM-XAM LAB : aucun appel sortant (rien n'est envoyé, rien n'est inventé).
  if (!env.meteomaticsUser || !env.meteomaticsPassword) throw new MeteomaticsNotConfigured();
  const url = buildMeteomaticsUrl(lat, lon, days);
  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${env.meteomaticsUser}:${env.meteomaticsPassword}`).toString("base64")}` };
  let status: number | null = null;
  try {
    const r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(30000) });
    status = r.status;
    if (r.status === 401 || r.status === 403) throw new Error("Meteomatics : identifiants absents ou refusés (METEOMATICS_USERNAME / METEOMATICS_PASSWORD)");
    if (!r.ok) throw new Error(`Meteomatics a répondu HTTP ${r.status}`);
    const vals = parseMeteomatics(await r.json());
    const out: GeoSeries["parameters"] = {};
    for (const v of vals) {
      out[v.parameter] ??= { label: v.parameter, unit: v.unit, values: [] };
      out[v.parameter].values.push({ period: v.date, value: v.value });
    }
    await logReq("meteomatics", url, true, status, null, vals.length);
    return { source: "Meteomatics (modèle mix)", nature: "prediction", resolution: "Point interpolé du modèle « mix » de Meteomatics", fetched_at: new Date().toISOString(), period: `${days} jours`, parameters: out, url };
  } catch (e) {
    const m = errMsg(e, "Meteomatics");
    await logReq("meteomatics", url, false, status, m, null);
    throw new Error(m);
  }
}

export interface HourlyWeather { times: string[]; ghi: (number | null)[]; dni: (number | null)[]; dhi: (number | null)[]; temp_air: (number | null)[]; wind_speed: (number | null)[]; url: string; fetched_at: string }

/** Données horaires NASA POWER d'une année (UTC) : rayonnement global, direct normal, diffus, température, vent à 2 m. */
export async function powerHourlyYear(lat: number, lon: number, year: number, fetchImpl: typeof fetch = outboundFetch): Promise<HourlyWeather> {
  const url = powerEndpoint("hourly", lat, lon, { parameters: "ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,T2M,WS2M", community: "RE", start: `${year}0101`, end: `${year}1231`, "time-standard": "UTC" });
  let status: number | null = null;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(90000), headers: { Accept: "application/json" } });
    status = r.status;
    if (!r.ok) throw powerHttpError(r.status);
    const b = await r.json() as { header?: { fill_value?: number }; properties?: { parameter?: Record<string, Record<string, number>> } };
    const p = b.properties?.parameter;
    if (!p?.ALLSKY_SFC_SW_DWN) throw new Error("Réponse NASA POWER inattendue");
    const fill = b.header?.fill_value ?? POWER_FILL;
    const keys = Object.keys(p.ALLSKY_SFC_SW_DWN).filter((k) => /^\d{10}$/.test(k)).sort();
    const val = (name: string, k: string) => { const v = p[name]?.[k]; return typeof v === "number" && v !== fill && v > -998 ? v : null; };
    const out: HourlyWeather = { times: keys.map((k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}T${k.slice(8, 10)}:00:00Z`),
      ghi: keys.map((k) => val("ALLSKY_SFC_SW_DWN", k)), dni: keys.map((k) => val("ALLSKY_SFC_SW_DNI", k)), dhi: keys.map((k) => val("ALLSKY_SFC_SW_DIFF", k)),
      temp_air: keys.map((k) => val("T2M", k)), wind_speed: keys.map((k) => val("WS2M", k)), url, fetched_at: new Date().toISOString() };
    await logReq("nasa_power", url, true, status, null, keys.length);
    return out;
  } catch (e) {
    const m = errMsg(e, "NASA POWER");
    await logReq("nasa_power", url, false, status, m, null);
    throw new Error(m);
  }
}
