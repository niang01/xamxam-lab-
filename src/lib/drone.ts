/**
 * Drones — règles pures (testées) : profil constructeur, conditions de vol, validation de mission, commandes.
 *
 * Principes :
 *  - Les limites viennent du CONSTRUCTEUR et de l'exploitant (profil saisi), jamais de valeurs inventées : une limite
 *    absente rend l'évaluation incomplète (« données insuffisantes »), pas favorable.
 *  - La météo est une PRÉVISION (modèle) pour une maille, pas une mesure sur le lieu de vol : la décision finale
 *    reste celle du télépilote, après observation sur place.
 *  - Plafond réglementaire et zones : fixés par l'exploitant selon la réglementation applicable (ANACIM au Sénégal) ;
 *    la plateforme vérifie, elle n'autorise pas.
 */
import { z } from "zod";

export const DRONE_ACTIONS = ["arm", "disarm", "takeoff", "goto", "mission_start", "hold", "rtl", "land", "estop"] as const;
export type DroneAction = (typeof DRONE_ACTIONS)[number];

/** Limites du constructeur et de l'exploitation (toutes obligatoires pour un vol réel). */
export const droneProfile = z.object({
  model: z.string().trim().min(1).max(80),
  max_wind_ms: z.number().positive().max(40).nullable(),        // vent soutenu maximal (constructeur)
  max_gust_ms: z.number().positive().max(50).nullable(),        // rafales maximales
  rain_allowed: z.boolean().nullable(),                         // indice de protection permettant le vol sous pluie
  min_temp_c: z.number().min(-40).max(30).nullable(),
  max_temp_c: z.number().min(0).max(60).nullable(),
  max_alt_m: z.number().positive().max(500).nullable(),         // plafond retenu par l'exploitant (réglementation)
  geofence_radius_m: z.number().positive().max(20000).nullable(),
  cruise_speed_ms: z.number().positive().max(40).nullable(),
  endurance_min: z.number().positive().max(300).nullable(),     // autonomie annoncée (batterie neuve)
  reserve_pct: z.number().min(10).max(60).nullable(),           // réserve d'énergie exigée à l'atterrissage
  min_visibility_m: z.number().positive().max(20000).nullable(),// visibilité minimale (vol à vue)
  night_allowed: z.boolean().nullable(),
});
export type DroneProfile = z.infer<typeof droneProfile>;

/** Une heure de prévision (Open-Meteo ou Meteomatics) — valeurs null si non fournies par la source. */
export interface WeatherHour {
  time: string; wind_10m_ms: number | null; wind_80m_ms: number | null; wind_120m_ms: number | null; wind_dir_deg: number | null;
  gust_10m_ms: number | null; precip_mm: number | null; precip_prob_pct: number | null; visibility_m: number | null;
  cloud_cover_pct: number | null; temperature_c: number | null; is_day: boolean | null; weather_code: number | null;
}

export type Verdict = "favorable" | "prudence" | "defavorable" | "donnees_insuffisantes";
export interface Assessment { verdict: Verdict; reasons: string[]; missing: string[]; wind_used_ms: number | null; nature: "prediction" }

/** Vent à l'altitude de vol : niveau de prévision le plus proche au-dessus (prudence), sinon 10 m. */
export function windAtAltitude(h: WeatherHour, altM: number): number | null {
  const levels: [number, number | null][] = [[10, h.wind_10m_ms], [80, h.wind_80m_ms], [120, h.wind_120m_ms]];
  const available = levels.filter(([, v]) => v != null) as [number, number][];
  if (!available.length) return null;
  const above = available.find(([lvl]) => lvl >= altM);
  // Vent maximal entre 10 m et le niveau couvrant l'altitude : on ne retient jamais le plus faible.
  const upto = available.filter(([lvl]) => lvl <= (above ? above[0] : Infinity));
  return Math.max(...upto.map(([, v]) => v));
}

/**
 * Évaluation des conditions de vol pour un profil et une heure de prévision.
 * « défavorable » dès qu'une limite constructeur est dépassée ; « prudence » au-delà de 80 % d'une limite ou si
 * l'information manque ; jamais « favorable » si une limite indispensable n'est pas renseignée.
 */
export function assessFlight(p: DroneProfile, h: WeatherHour, altM: number): Assessment {
  const reasons: string[] = []; const missing: string[] = [];
  let worst: Verdict = "favorable";
  const raise = (v: Verdict) => { const order: Verdict[] = ["favorable", "prudence", "donnees_insuffisantes", "defavorable"]; if (order.indexOf(v) > order.indexOf(worst)) worst = v; };

  const wind = windAtAltitude(h, altM);
  const check = (label: string, value: number | null, limit: number | null, unit: string, profileField: string) => {
    if (limit == null) { missing.push(`profil : ${profileField}`); raise("donnees_insuffisantes"); return; }
    if (value == null) { missing.push(`prévision : ${label}`); raise("prudence"); return; }
    if (value > limit) { reasons.push(`${label} ${value.toFixed(1)} ${unit} > limite ${limit} ${unit}`); raise("defavorable"); }
    else if (value > 0.8 * limit) { reasons.push(`${label} ${value.toFixed(1)} ${unit} proche de la limite (${limit} ${unit})`); raise("prudence"); }
  };
  check(`vent à ${altM} m`, wind, p.max_wind_ms, "m/s", "vent maximal");
  check("rafales (10 m)", h.gust_10m_ms, p.max_gust_ms, "m/s", "rafales maximales");

  if (p.rain_allowed == null) { missing.push("profil : vol sous pluie autorisé ?"); raise("donnees_insuffisantes"); }
  else if (h.precip_mm == null) { missing.push("prévision : précipitations"); raise("prudence"); }
  else if (h.precip_mm > 0 && !p.rain_allowed) { reasons.push(`précipitations prévues (${h.precip_mm} mm/h) : vol sous pluie non autorisé par le constructeur`); raise("defavorable"); }
  if (h.precip_prob_pct != null && h.precip_prob_pct >= 50 && !p.rain_allowed) { reasons.push(`probabilité de précipitations ${h.precip_prob_pct} %`); raise("prudence"); }

  if (p.min_temp_c == null || p.max_temp_c == null) { missing.push("profil : plage de température"); raise("donnees_insuffisantes"); }
  else if (h.temperature_c == null) { missing.push("prévision : température"); raise("prudence"); }
  else if (h.temperature_c < p.min_temp_c || h.temperature_c > p.max_temp_c) { reasons.push(`température ${h.temperature_c} °C hors plage constructeur (${p.min_temp_c} à ${p.max_temp_c} °C)`); raise("defavorable"); }

  if (p.min_visibility_m == null) { missing.push("profil : visibilité minimale"); raise("donnees_insuffisantes"); }
  else if (h.visibility_m == null) { missing.push("prévision : visibilité"); raise("prudence"); }
  else if (h.visibility_m < p.min_visibility_m) { reasons.push(`visibilité ${Math.round(h.visibility_m)} m < ${p.min_visibility_m} m`); raise("defavorable"); }

  if (p.night_allowed == null) { missing.push("profil : vol de nuit autorisé ?"); raise("donnees_insuffisantes"); }
  else if (h.is_day === false && !p.night_allowed) { reasons.push("vol de nuit non autorisé"); raise("defavorable"); }
  else if (h.is_day == null) { missing.push("prévision : jour/nuit"); raise("prudence"); }

  if (h.weather_code != null && h.weather_code >= 95) { reasons.push("orage prévu (code météo WMO ≥ 95)"); raise("defavorable"); }

  return { verdict: worst, reasons, missing, wind_used_ms: wind, nature: "prediction" };
}

export interface LatLon { lat: number; lon: number }
export const waypoint = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), alt_m: z.number().min(1).max(500) });
export type Waypoint = z.infer<typeof waypoint>;

/** Distance orthodromique (m), formule de haversine, rayon terrestre moyen 6 371 008,8 m. */
export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface MissionCheck { ok: boolean; errors: string[]; total_distance_m: number; flight_time_min: number | null; energy_needed_pct: number | null }

/**
 * Validation d'une mission (décollage au point de départ, waypoints, retour au départ) : plafond, géorepérage,
 * autonomie avec réserve. Toute limite absente du profil est une erreur (pas de vol réel sans limites).
 */
export function checkMission(p: DroneProfile, home: LatLon, wps: Waypoint[]): MissionCheck {
  const errors: string[] = [];
  if (!wps.length) errors.push("aucun point de passage");
  if (p.max_alt_m == null) errors.push("plafond (max_alt_m) non renseigné");
  if (p.geofence_radius_m == null) errors.push("rayon de géorepérage non renseigné");
  if (p.cruise_speed_ms == null || p.endurance_min == null || p.reserve_pct == null) errors.push("vitesse de croisière, autonomie ou réserve non renseignée");
  wps.forEach((w, i) => {
    if (p.max_alt_m != null && w.alt_m > p.max_alt_m) errors.push(`point ${i + 1} : altitude ${w.alt_m} m > plafond ${p.max_alt_m} m`);
    const d = distanceM(home, w);
    if (p.geofence_radius_m != null && d > p.geofence_radius_m) errors.push(`point ${i + 1} : ${Math.round(d)} m du départ > géorepérage ${p.geofence_radius_m} m`);
  });
  let total = 0, prev: LatLon = home;
  for (const w of wps) { total += distanceM(prev, w); prev = w; }
  if (wps.length) total += distanceM(prev, home);
  let flight: number | null = null, energy: number | null = null;
  if (p.cruise_speed_ms && p.endurance_min) {
    // Montées/descentes ignorées : temps horizontal + 2 min de décollage/atterrissage (hypothèse affichée).
    flight = total / p.cruise_speed_ms / 60 + 2;
    energy = (flight / p.endurance_min) * 100;
    if (p.reserve_pct != null && energy > 100 - p.reserve_pct) errors.push(`énergie estimée ${energy.toFixed(0)} % > ${100 - p.reserve_pct} % (réserve de ${p.reserve_pct} % exigée)`);
  }
  return { ok: errors.length === 0, errors, total_distance_m: Math.round(total), flight_time_min: flight == null ? null : Math.round(flight * 10) / 10, energy_needed_pct: energy == null ? null : Math.round(energy) };
}

/** Paramètres de chaque commande drone (validés côté plateforme ET côté pont). */
export const droneCommandParams: Record<DroneAction, z.ZodType> = {
  arm: z.object({}).strict(),
  disarm: z.object({}).strict(),
  takeoff: z.object({ alt_m: z.number().min(1).max(500) }).strict(),
  goto: waypoint.strict(),
  mission_start: z.object({ mission_id: z.uuid() }).strict(),
  hold: z.object({}).strict(),
  rtl: z.object({}).strict(),
  land: z.object({}).strict(),
  estop: z.object({}).strict(),
};

/** Contrôles propres aux commandes drone avant proposition (plafond, géorepérage). */
export function droneCommandBlockers(p: DroneProfile | null, home: LatLon | null, action: DroneAction, params: Record<string, unknown>): string[] {
  const out: string[] = [];
  const parsed = droneCommandParams[action].safeParse(params);
  if (!parsed.success) return [`paramètres invalides pour « ${action} »`];
  if (action === "takeoff" || action === "goto") {
    const alt = Number(params.alt_m);
    if (!p || p.max_alt_m == null) out.push("plafond du profil drone non renseigné");
    else if (alt > p.max_alt_m) out.push(`altitude ${alt} m > plafond ${p.max_alt_m} m`);
  }
  if (action === "goto") {
    if (!home) out.push("point de départ (home) inconnu : attendre la télémétrie GPS du drone");
    else if (!p || p.geofence_radius_m == null) out.push("géorepérage du profil non renseigné");
    else { const d = distanceM(home, params as unknown as LatLon); if (d > p.geofence_radius_m) out.push(`destination à ${Math.round(d)} m du départ > géorepérage ${p.geofence_radius_m} m`); }
  }
  return out;
}
