/**
 * Thermique et psychrométrie (fonctions pures). Constantes citées :
 *  - eau : cp = 4186 J/(kg·K) ; chaleur latente de vaporisation hfg(T) ≈ 2501 − 2,361 T kJ/kg (0–100 °C, approximation usuelle) ;
 *  - air sec : cp = 1005 J/(kg·K), R = 287,05 J/(kg·K) ; vapeur d'eau : cp = 1860 J/(kg·K) ;
 *  - pression de vapeur saturante : équation de Buck (1996) ; humidité absolue w = 0,622 pv / (p − pv).
 *  - méthane : PCI = 35,8 MJ/Nm³ (0 °C, 1 atm) ; masses volumiques normales CH4 0,717 kg/Nm³, CO2 1,977 kg/Nm³.
 */
import { vapourPressure } from "./hydraulics";

export const CP_WATER = 4186;
export const CP_AIR = 1005;
export const CP_VAPOUR = 1860;
export const R_AIR = 287.05;
export const P_ATM = 101325;
export const LHV_CH4 = 35.8; // MJ/Nm³
export const RHO_CH4 = 0.717, RHO_CO2 = 1.977; // kg/Nm³
export const hfg = (tC: number) => 2501 - 2.361 * tC; // kJ/kg

/** Humidité absolue (kg d'eau / kg d'air sec) à T (°C) et humidité relative φ (0–1). */
export const humidityRatio = (tC: number, rh: number, p = P_ATM) => { const pv = rh * vapourPressure(tC); return (0.622 * pv) / (p - pv); };
/** Enthalpie de l'air humide (kJ/kg d'air sec). */
export const enthalpy = (tC: number, w: number) => 1.005 * tC + w * (2501 + 1.86 * tC);
/** Humidité relative à partir de T et w. */
export const relHumidity = (tC: number, w: number, p = P_ATM) => (w * p) / ((0.622 + w) * vapourPressure(tC));
/** Masse volumique de l'air humide (kg/m³). */
export const airDensity = (tC: number, w: number, p = P_ATM) => (p / (R_AIR * (tC + 273.15))) * (1 + w) / (1 + 1.6078 * w);

/**
 * Évolution adiabatique (enthalpie constante) de l'air de séchage jusqu'à l'humidité relative de sortie φs :
 * renvoie la température et l'humidité absolue de sortie (résolution par dichotomie sur T).
 */
export function adiabaticTo(tIn: number, wIn: number, rhOut: number, p = P_ATM): { t: number; w: number } | null {
  const h = enthalpy(tIn, wIn);
  const f = (t: number) => { const w = (h - 1.005 * t) / (2501 + 1.86 * t); return relHumidity(t, w, p) - rhOut; };
  let a = -10, b = tIn;
  if (f(b) > 0) return null; // l'air entrant est déjà plus humide que la sortie visée
  if (f(a) < 0) return null;
  for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
  const t = (a + b) / 2;
  return { t, w: (h - 1.005 * t) / (2501 + 1.86 * t) };
}
