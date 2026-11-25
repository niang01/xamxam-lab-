/**
 * Géométrie solaire et irradiation mensuelle sur plan incliné (fonctions pures).
 * Méthode (Duffie & Beckman, « Solar Engineering of Thermal Processes », chap. 1 et 2) :
 *  - déclinaison de Cooper, jours moyens de Klein pour chaque mois ;
 *  - irradiation extraterrestre journalière H0 (constante solaire Gsc = 1367 W/m²) ;
 *  - fraction diffuse mensuelle d'Erbs et al. (1982) en fonction de l'indice de clarté KT = H / H0 ;
 *  - rapport géométrique Rb = ∫cos θ dω / ∫cos θz dω intégré numériquement sur la journée (toute orientation) ;
 *  - modèle isotrope de Liu et Jordan : H_T = Hb Rb + Hd (1 + cos β)/2 + H ρg (1 − cos β)/2.
 * Ce modèle mensuel est une ESTIMATION (modèle) : le calcul horaire pvlib (Solar Energy Lab) est plus fin.
 */
const RAD = Math.PI / 180;
export const GSC = 1367;
/** Jours moyens recommandés par Klein (1977), un par mois. */
export const MEAN_DAYS = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const declination = (n: number) => 23.45 * Math.sin(RAD * (360 * (284 + n)) / 365);

/** Angle horaire du coucher du soleil (degrés). */
export function sunsetHourAngle(latDeg: number, declDeg: number) {
  const x = -Math.tan(latDeg * RAD) * Math.tan(declDeg * RAD);
  if (x >= 1) return 0;
  if (x <= -1) return 180;
  return Math.acos(x) / RAD;
}

/** Irradiation extraterrestrique journalière sur plan horizontal (kWh/m²/j). */
export function h0Daily(latDeg: number, n: number) {
  const d = declination(n), ws = sunsetHourAngle(latDeg, d);
  const e = 1 + 0.033 * Math.cos(RAD * (360 * n) / 365);
  return ((24 / Math.PI) * (GSC / 1000) * e * (Math.cos(latDeg * RAD) * Math.cos(d * RAD) * Math.sin(ws * RAD) + (Math.PI * ws / 180) * Math.sin(latDeg * RAD) * Math.sin(d * RAD)));
}

/** cos θ (incidence sur une surface d'inclinaison β et d'azimut γ ; γ = 0 plein sud, est négatif, ouest positif). */
export function cosIncidence(latDeg: number, declDeg: number, betaDeg: number, gammaDeg: number, omegaDeg: number) {
  const [p, d, b, g, w] = [latDeg, declDeg, betaDeg, gammaDeg, omegaDeg].map((x) => x * RAD);
  return Math.sin(d) * Math.sin(p) * Math.cos(b) - Math.sin(d) * Math.cos(p) * Math.sin(b) * Math.cos(g)
    + Math.cos(d) * Math.cos(p) * Math.cos(b) * Math.cos(w) + Math.cos(d) * Math.sin(p) * Math.sin(b) * Math.cos(g) * Math.cos(w)
    + Math.cos(d) * Math.sin(b) * Math.sin(g) * Math.sin(w);
}

/** Rapport géométrique moyen journalier du rayonnement direct (intégration numérique, point milieu, pas ≤ 0,25°). */
export function rbDaily(latDeg: number, n: number, betaDeg: number, gammaDeg: number) {
  const d = declination(n), ws = sunsetHourAngle(latDeg, d);
  let num = 0, den = 0;
  const steps = Math.max(60, Math.ceil((2 * ws) / 0.25)), h = (2 * ws) / steps;
  for (let k = 0; k < steps; k++) {
    const w = -ws + (k + 0.5) * h;
    den += Math.max(0, cosIncidence(latDeg, d, 0, 0, w));
    num += Math.max(0, cosIncidence(latDeg, d, betaDeg, gammaDeg, w));
  }
  return den > 0 ? num / den : 0;
}

/** Fraction diffuse mensuelle d'Erbs et al. (1982). */
export function diffuseFraction(kt: number, wsDeg: number) {
  return wsDeg <= 81.4 ? 1.391 - 3.56 * kt + 4.189 * kt ** 2 - 2.137 * kt ** 3 : 1.311 - 3.022 * kt + 3.427 * kt ** 2 - 1.821 * kt ** 3;
}

export interface MonthPoa { month: number; h: number; h0: number; kt: number; hd: number; rb: number; poa: number }
/** Irradiation journalière moyenne mensuelle sur le plan des modules (kWh/m²/j). */
export function monthlyPoa(p: { lat: number; ghi: number[]; tilt: number; azimuth: number; albedo: number }): { months: MonthPoa[]; warnings: string[] } {
  const warnings: string[] = [];
  const months = p.ghi.map((h, m) => {
    const n = MEAN_DAYS[m], d = declination(n), ws = sunsetHourAngle(p.lat, d);
    const h0 = h0Daily(p.lat, n);
    const kt = h0 > 0 ? h / h0 : 0;
    if (kt < 0.3 || kt > 0.8) warnings.push(`Mois ${m + 1} : indice de clarté KT = ${kt.toFixed(2)} hors du domaine de validité de la corrélation (0,3–0,8)`);
    const hd = h * Math.min(1, Math.max(0, diffuseFraction(kt, ws)));
    const rb = rbDaily(p.lat, n, p.tilt, p.azimuth);
    const c = Math.cos(p.tilt * RAD);
    const poa = (h - hd) * rb + hd * (1 + c) / 2 + h * p.albedo * (1 - c) / 2;
    return { month: m + 1, h, h0, kt, hd, rb, poa };
  });
  return { months, warnings };
}
