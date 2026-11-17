/**
 * Refrigeration & HVAC Lab — calculs thermiques de base (fonctions pures).
 * Diagrammes enthalpiques de fluides réels (CoolProp) : non disponibles dans cette version (signalé dans l'interface).
 */
import { result, round, need, type CalcResult } from "./result";

/** COP de Carnot (limite théorique) d'une machine frigorifique : COP = Tf / (Tc − Tf), températures en kelvins. */
export function carnotCop(p: { tColdC: number | null; tHotC: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.tColdC, "température de la source froide (°C)"); need(missing, p.tHotC, "température de la source chaude (°C)");
  if (missing.length) return result({ missing });
  const tf = p.tColdC! + 273.15, tc = p.tHotC! + 273.15;
  if (tc <= tf) return result({ missing: ["source chaude plus chaude que la source froide"] });
  return result({ outputs: { copF: { value: round(tf / (tc - tf)), unit: "", label: "COP froid de Carnot" }, copH: { value: round(tc / (tc - tf)), unit: "", label: "COP chaud de Carnot (pompe à chaleur)" } }, formulas: ["COP_f = Tf / (Tc − Tf)", "COP_c = Tc / (Tc − Tf)"], assumptions: ["Cycle réversible idéal : le COP réel est toujours inférieur"] });
}

/** COP réel mesuré : puissance utile / puissance électrique (deux mesures). */
export function measuredCop(p: { usefulW: number | null; electricW: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.usefulW, "puissance frigorifique ou calorifique (W)"); need(missing, p.electricW, "puissance électrique absorbée (W)");
  if (missing.length) return result({ missing });
  return result({ outputs: { cop: { value: round(p.usefulW! / p.electricW!), unit: "", label: "COP" } }, formulas: ["COP = Q / W"] });
}

/** Déperditions/apports par les parois : Q = Σ U × A × ΔT (coefficients U saisis d'après les matériaux). */
export function wallLoad(p: { walls: { name: string; u: number | null; areaM2: number | null }[]; tInC: number | null; tOutC: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.tInC, "température intérieure (°C)"); need(missing, p.tOutC, "température extérieure (°C)");
  for (const w of p.walls) { if (w.u == null) missing.push(`coefficient U de « ${w.name} » (W/m²·K)`); if (w.areaM2 == null) missing.push(`surface de « ${w.name} » (m²)`); }
  if (!p.walls.length) missing.push("au moins une paroi");
  if (missing.length) return result({ missing });
  const dt = p.tOutC! - p.tInC!;
  const q = p.walls.reduce((a, w) => a + w.u! * w.areaM2! * dt, 0);
  return result({ outputs: { q: { value: round(q), unit: "W", label: "Flux à travers les parois" } }, formulas: ["Q = Σ U × A × (T_ext − T_int)"], assumptions: ["Régime permanent ; ponts thermiques, renouvellement d'air, produits et occupants non inclus"] });
}
