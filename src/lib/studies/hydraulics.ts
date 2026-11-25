/**
 * Hydraulique en charge (fonctions pures) — eau.
 * Références : viscosité dynamique de l'eau par la loi de Vogel (A = 2,414·10⁻⁵ Pa·s, B = 247,8 K, C = 140 K) ;
 * coefficient de frottement : 64/Re en laminaire, Colebrook-White en turbulent (résolution itérative) ;
 * pertes de charge de Darcy-Weisbach ; pression de vapeur saturante : équation de Buck (1996) ;
 * pression atmosphérique selon l'atmosphère type OACI. Masse volumique de l'eau prise égale à 1000 kg/m³
 * (écart < 0,5 % entre 0 et 40 °C), g = 9,81 m/s².
 */
export const G = 9.81;
export const RHO = 1000;

/** Viscosité cinématique de l'eau (m²/s) à la température T (°C). */
export function waterNu(tC: number) {
  const mu = 2.414e-5 * 10 ** (247.8 / (tC + 273.15 - 140));
  return mu / RHO;
}
/** Pression de vapeur saturante de l'eau (Pa), équation de Buck. */
export const vapourPressure = (tC: number) => 611.21 * Math.exp((18.678 - tC / 234.5) * (tC / (257.14 + tC)));
/** Pression atmosphérique (Pa) à l'altitude z (m), atmosphère type. */
export const atmPressure = (z: number) => 101325 * (1 - 2.25577e-5 * z) ** 5.25588;

export function frictionFactor(re: number, relRough: number) {
  if (re <= 0) return 0;
  if (re < 2300) return 64 / re;
  let f = 0.02;
  for (let i = 0; i < 60; i++) {
    const nf = (-2 * Math.log10(relRough / 3.7 + 2.51 / (re * Math.sqrt(f)))) ** -2;
    if (Math.abs(nf - f) < 1e-10) { f = nf; break; }
    f = nf;
  }
  return f;
}

export interface Pipe { name: string; length: number; d: number; rough: number; k: number }
/** Pertes de charge d'une conduite (m) au débit q (m³/s) : régulières (Darcy-Weisbach) et singulières (ΣK). */
export function pipeLoss(p: Pipe, q: number, nu: number) {
  const area = (Math.PI * p.d * p.d) / 4, v = q / area, re = (v * p.d) / nu;
  const f = frictionFactor(re, p.rough / p.d);
  const dyn = (v * v) / (2 * G);
  return { v, re, f, linear: f * (p.length / p.d) * dyn, singular: p.k * dyn, regime: re < 2300 ? "laminaire" : re < 4000 ? "transitoire" : "turbulent" };
}

/** Interpolation linéaire d'une courbe tabulée (points triés par x croissant) ; null hors domaine. */
export function interp(points: { x: number; y: number }[], x: number): number | null {
  const s = [...points].sort((a, b) => a.x - b.x);
  if (!s.length || x < s[0].x - 1e-12 || x > s[s.length - 1].x + 1e-12) return null;
  for (let i = 0; i < s.length - 1; i++) if (x <= s[i + 1].x) { const t = (x - s[i].x) / (s[i + 1].x - s[i].x || 1); return s[i].y + t * (s[i + 1].y - s[i].y); }
  return s[s.length - 1].y;
}

/** Point de fonctionnement : intersection courbe de la pompe H_p(Q) et courbe du réseau H_r(Q) (dichotomie). */
export function operatingPoint(pump: { x: number; y: number }[], system: (q: number) => number): { q: number; h: number } | null {
  const s = [...pump].sort((a, b) => a.x - b.x);
  if (s.length < 2) return null;
  const g = (q: number) => interp(s, q)! - system(q);
  let a = s[0].x, b = s[s.length - 1].x;
  if (g(a) < 0 || g(b) > 0) return null;
  for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (g(m) > 0) a = m; else b = m; }
  const q = (a + b) / 2;
  return { q, h: interp(s, q)! };
}
