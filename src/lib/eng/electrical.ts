/**
 * Electrical Lab — calculs électrotechniques (fonctions pures).
 * Constantes physiques utilisées (citées) : résistivité à 20 °C du cuivre recuit 1/58 Ω·mm²/m (CEI 60028),
 * de l'aluminium 1/35,38 Ω·mm²/m (CEI 60889) ; coefficients de température 0,00393 /K (cuivre) et 0,00403 /K (aluminium).
 * Les tableaux normatifs (courants admissibles, facteurs de correction, réactance linéique de la NF C 15-100) ne sont
 * jamais inventés : ils sont fournis par l'utilisateur ou saisis par un ingénieur depuis la norme (normative_tables).
 */
import { result, round, need, type CalcResult } from "./result";

export const CONDUCTORS = {
  copper: { rho20: 1 / 58, alpha: 0.00393, ref: "Cuivre recuit : ρ20 = 1/58 Ω·mm²/m, α = 0,00393 /K (CEI 60028)" },
  aluminium: { rho20: 1 / 35.38, alpha: 0.00403, ref: "Aluminium : ρ20 = 1/35,38 Ω·mm²/m, α = 0,00403 /K (CEI 60889)" },
} as const;
export type Conductor = keyof typeof CONDUCTORS;

/** Résistivité à la température θ : ρθ = ρ20 (1 + α (θ − 20)). */
export function resistivity(c: Conductor, tempC: number) {
  const k = CONDUCTORS[c];
  return k.rho20 * (1 + k.alpha * (tempC - 20));
}

/** Loi d'Ohm : deux grandeurs connues parmi U, I, R → les autres et la puissance. */
export function ohm(p: { u?: number | null; i?: number | null; r?: number | null }): CalcResult {
  const known = (["u", "i", "r"] as const).filter((k) => p[k] != null && Number.isFinite(p[k]!));
  if (known.length < 2) return result({ missing: ["deux grandeurs parmi tension U (V), courant I (A), résistance R (Ω)"] });
  let { u, i, r } = p as { u: number; i: number; r: number };
  const warnings: string[] = [];
  if (p.u == null) u = i * r;
  else if (p.i == null) { if (r === 0) return result({ missing: ["R ≠ 0"] }); i = u / r; }
  else if (p.r == null) { if (i === 0) return result({ missing: ["I ≠ 0"] }); r = u / i; }
  else if (Math.abs(u - i * r) > 1e-9 * Math.max(1, Math.abs(u))) warnings.push("Les trois grandeurs fournies ne vérifient pas U = R·I");
  return result({
    outputs: { u: { value: round(u), unit: "V", label: "Tension U" }, i: { value: round(i), unit: "A", label: "Courant I" }, r: { value: round(r), unit: "Ω", label: "Résistance R" }, p: { value: round(u * i), unit: "W", label: "Puissance P = U·I" } },
    formulas: ["U = R × I", "P = U × I"], warnings,
  });
}

/** Puissances en courant alternatif sinusoïdal, monophasé ou triphasé équilibré (U = tension entre phases en triphasé). */
export function acPower(p: { system: "single" | "three"; u: number | null; i: number | null; cosPhi: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.u, "tension U (V)"); need(missing, p.i, "courant I (A)"); need(missing, p.cosPhi, "facteur de puissance cos φ");
  if (missing.length) return result({ missing });
  if (p.cosPhi! < 0 || p.cosPhi! > 1) return result({ missing: ["cos φ entre 0 et 1"] });
  const k = p.system === "three" ? Math.sqrt(3) : 1;
  const s = k * p.u! * p.i!;
  const sin = Math.sqrt(1 - p.cosPhi! ** 2);
  return result({
    outputs: { s: { value: round(s), unit: "VA", label: "Puissance apparente S" }, p: { value: round(s * p.cosPhi!), unit: "W", label: "Puissance active P" }, q: { value: round(s * sin), unit: "var", label: "Puissance réactive Q" } },
    formulas: [p.system === "three" ? "S = √3 × U × I" : "S = U × I", "P = S × cos φ", "Q = S × sin φ"],
    assumptions: ["Régime sinusoïdal établi" + (p.system === "three" ? ", charge triphasée équilibrée, U entre phases" : "")],
  });
}

/** Courant d'emploi à partir de la puissance active absorbée : I = P / (k U cos φ η). */
export function designCurrent(p: { system: "single" | "three"; pW: number | null; u: number | null; cosPhi: number | null; efficiency: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.pW, "puissance P (W)"); need(missing, p.u, "tension U (V)"); need(missing, p.cosPhi, "cos φ"); need(missing, p.efficiency, "rendement η (1 pour une charge non motorisée)");
  if (missing.length) return result({ missing });
  const k = p.system === "three" ? Math.sqrt(3) : 1;
  const i = p.pW! / (k * p.u! * p.cosPhi! * p.efficiency!);
  return result({ outputs: { ib: { value: round(i), unit: "A", label: "Courant d'emploi Ib" } }, formulas: [p.system === "three" ? "Ib = P / (√3 × U × cos φ × η)" : "Ib = P / (U × cos φ × η)"], assumptions: ["P = puissance utile ; η = rendement de l'appareil (plaque signalétique)"] });
}

/**
 * Chute de tension : ΔU = b (ρ L cos φ / S + λ L sin φ) I ; b = 2 en monophasé, 1 en triphasé (ΔU entre phase et neutre ×√3 pour la tension composée).
 * λ (réactance linéique, Ω/m) est requise si sin φ > 0 ; elle n'est jamais supposée.
 */
export function voltageDrop(p: { system: "single" | "three"; u: number | null; i: number | null; lengthM: number | null; sectionMm2: number | null; conductor: Conductor; tempC: number | null; cosPhi: number | null; lambdaOhmPerM?: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.u, "tension nominale U (V)"); need(missing, p.i, "courant I (A)"); need(missing, p.lengthM, "longueur L (m, aller simple)"); need(missing, p.sectionMm2, "section S (mm²)"); need(missing, p.tempC, "température de l'âme θ (°C)"); need(missing, p.cosPhi, "cos φ");
  if (missing.length) return result({ missing });
  const sin = Math.sqrt(Math.max(0, 1 - p.cosPhi! ** 2));
  if (sin > 1e-9 && (p.lambdaOhmPerM == null || !Number.isFinite(p.lambdaOhmPerM))) return result({ missing: ["réactance linéique λ (Ω/m) — valeur de la norme ou du fabricant de câble (nécessaire car cos φ < 1)"] });
  const rho = resistivity(p.conductor, p.tempC!);
  const b = p.system === "single" ? 2 : 1;
  const lambda = sin > 1e-9 ? p.lambdaOhmPerM! : 0;
  const du = b * (rho * p.lengthM! * p.cosPhi! / p.sectionMm2! + lambda * p.lengthM! * sin) * p.i!;
  const ref = p.system === "single" ? p.u! : p.u! / Math.sqrt(3);
  const pct = (100 * du) / ref;
  return result({
    outputs: { rho: { value: round(rho), unit: "Ω·mm²/m", label: `Résistivité à ${p.tempC} °C` }, du: { value: round(du), unit: "V", label: p.system === "single" ? "Chute de tension ΔU" : "Chute de tension simple ΔU (phase-neutre)" }, pct: { value: round(pct, 3), unit: "%", label: "ΔU / U" } },
    formulas: ["ρθ = ρ20 (1 + α (θ − 20))", `ΔU = ${b} × (ρ × L × cos φ / S + λ × L × sin φ) × I`, p.system === "single" ? "ΔU% = 100 ΔU / U" : "ΔU% = 100 ΔU / (U/√3)"],
    references: [CONDUCTORS[p.conductor].ref, "Formule de la chute de tension en régime permanent (méthode de la NF C 15-100, § 525)"],
    assumptions: ["L = longueur simple du circuit", "Courant constant le long du circuit"],
    warnings: ["La limite admissible de ΔU dépend du type de circuit : à vérifier dans la norme applicable"],
  });
}

/** Table normative de courants admissibles : [{ s: mm², iz: A }] pour un mode de pose donné (saisie depuis la norme). */
export interface AmpacityTable { reference: string; rows: { s: number; iz: number }[] }

/** Choix de section : plus petite S telle que Iz × Π(facteurs de correction) ≥ In (calibre de la protection). */
export function cableSection(p: { inA: number | null; correctionFactors: number[]; table: AmpacityTable | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.inA, "calibre de la protection In (A)");
  if (!p.table || !p.table.rows.length) missing.push("tableau normatif des courants admissibles (à saisir depuis la norme par un ingénieur : Administration → Tableaux normatifs)");
  if (!p.correctionFactors.length) missing.push("facteurs de correction (température, groupement, mode de pose) — 1 si non applicable, d'après la norme");
  if (missing.length) return result({ missing });
  const k = p.correctionFactors.reduce((a, b) => a * b, 1);
  const rows = [...p.table!.rows].sort((a, b) => a.s - b.s);
  const pick = rows.find((r) => r.iz * k >= p.inA!);
  if (!pick) return result({ warnings: ["Aucune section du tableau ne convient : conducteurs en parallèle ou autre mode de pose"], outputs: { k: { value: round(k), unit: "", label: "Facteur global K" } }, references: [p.table!.reference] });
  return result({
    outputs: { s: { value: pick.s, unit: "mm²", label: "Section retenue" }, iz: { value: pick.iz, unit: "A", label: "Iz (tableau)" }, izk: { value: round(pick.iz * k), unit: "A", label: "Iz corrigé = Iz × K" }, k: { value: round(k), unit: "", label: "Facteur global K" } },
    formulas: ["K = Π facteurs de correction", "S minimale telle que Iz × K ≥ In"], references: [p.table!.reference],
    warnings: ["Vérifier ensuite la chute de tension et la tenue au court-circuit"],
  });
}

/** Bilan de puissance : Σ (P × ku × ks). Les coefficients d'utilisation/simultanéité sont saisis (jamais supposés). */
export function powerBalance(loads: { name: string; pW: number; qty: number; ku: number | null; ks: number | null }[]): CalcResult {
  const missing = loads.flatMap((l) => [l.ku == null ? `coefficient d'utilisation de « ${l.name} »` : null, l.ks == null ? `coefficient de simultanéité de « ${l.name} »` : null]).filter(Boolean) as string[];
  if (missing.length) return result({ missing });
  const installed = loads.reduce((a, l) => a + l.pW * l.qty, 0);
  const demand = loads.reduce((a, l) => a + l.pW * l.qty * l.ku! * l.ks!, 0);
  return result({ outputs: { installed: { value: round(installed), unit: "W", label: "Puissance installée" }, demand: { value: round(demand), unit: "W", label: "Puissance d'utilisation" } }, formulas: ["Pu = Σ P × n × ku × ks"] });
}
