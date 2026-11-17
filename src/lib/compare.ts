/**
 * Comparaison simulation / réalité (Studio 4D) — fonctions pures.
 * La simulation est interpolée linéairement aux instants des mesures (interpolation signalée) ; seuls les instants
 * couverts par la simulation sont comparés (pas d'extrapolation).
 */
export function interp(xs: number[], ys: number[], x: number): number | null {
  if (!xs.length || x < xs[0] || x > xs[xs.length - 1]) return null;
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  if (xs[hi] === xs[lo]) return ys[lo];
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
}

export interface Comparison { n: number; meanAbs: number | null; maxAbs: number | null; rmse: number | null; outside: number }

export function compare(simX: number[], simY: number[], measX: number[], measY: number[]): Comparison {
  const errs: number[] = [];
  let outside = 0;
  measX.forEach((x, i) => { const s = interp(simX, simY, x); if (s == null) outside++; else errs.push(measY[i] - s); });
  if (!errs.length) return { n: 0, meanAbs: null, maxAbs: null, rmse: null, outside };
  const abs = errs.map(Math.abs);
  return { n: errs.length, meanAbs: abs.reduce((a, b) => a + b, 0) / abs.length, maxAbs: Math.max(...abs), rmse: Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length), outside };
}
