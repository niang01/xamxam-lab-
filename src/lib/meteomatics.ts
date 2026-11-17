/**
 * Meteomatics — construction de la requête et lecture de la réponse (fonctions pures).
 * Les grandeurs « _24h » horodatées J à 00:00 UTC agrègent les 24 heures qui précèdent : elles décrivent J−1.
 * Les valeurs sont des PRÉDICTIONS du modèle « mix ».
 */
export const METEOMATICS_API = "https://api.meteomatics.com";

export interface ForecastParam { code: string; key: string; unit: string; scale: number }

/** Paramètres demandés (code Meteomatics → clé interne, unité affichée, facteur d'échelle). */
export const FORECAST_PARAMS: ForecastParam[] = [
  { code: "t_max_2m_24h:C", key: "tmax", unit: "°C", scale: 1 },
  { code: "t_min_2m_24h:C", key: "tmin", unit: "°C", scale: 1 },
  { code: "precip_24h:mm", key: "precipitation", unit: "mm", scale: 1 },
  { code: "prob_precip_24h:p", key: "precip_probability", unit: "%", scale: 1 },
  { code: "relative_humidity_mean_2m_24h:p", key: "humidity", unit: "%", scale: 1 },
  { code: "wind_speed_mean_10m_24h:ms", key: "wind10m", unit: "m/s", scale: 1 },
  { code: "global_rad_24h:J", key: "radiation", unit: "MJ/m²", scale: 1e-6 },
];

const isoSeconds = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;

/** Requête journalière pour `days` jours (1 à 10) à partir de demain 00:00 UTC. */
export function buildMeteomaticsUrl(lat: number, lon: number, days = 7, now = new Date()): string {
  const n = Math.max(1, Math.min(10, Math.round(days)));
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const last = new Date(first.getTime() + (n - 1) * 86_400_000);
  const codes = FORECAST_PARAMS.map((p) => p.code).join(",");
  return `${METEOMATICS_API}/${isoSeconds(first)}--${isoSeconds(last)}:P1D/${codes}/${lat.toFixed(4)},${lon.toFixed(4)}/json?model=mix`;
}

export interface ForecastValue { date: string; parameter: string; value: number | null; unit: string }

export function parseMeteomatics(body: unknown): ForecastValue[] {
  const res = body as { status?: string; message?: string; data?: { parameter: string; coordinates?: { dates?: { date: string; value: number }[] }[] }[] };
  if (res?.status !== "OK" || !Array.isArray(res.data)) throw new Error(`Réponse Meteomatics inattendue${res?.message ? ` : ${res.message}` : ""}`);
  const values: ForecastValue[] = [];
  for (const series of res.data) {
    const param = FORECAST_PARAMS.find((p) => p.code === series.parameter);
    if (!param) continue;
    for (const point of series.coordinates?.[0]?.dates ?? []) {
      const t = Date.parse(point.date);
      if (Number.isNaN(t)) continue;
      const valid = typeof point.value === "number" && Number.isFinite(point.value) && point.value > -666; // -666/-999 : absent
      const day = new Date(t - 86_400_000).toISOString().slice(0, 10);
      values.push({ date: day, parameter: param.key, value: valid ? Math.round(point.value * param.scale * 100) / 100 : null, unit: param.unit });
    }
  }
  if (!values.length) throw new Error("Réponse Meteomatics sans valeur exploitable");
  return values;
}
