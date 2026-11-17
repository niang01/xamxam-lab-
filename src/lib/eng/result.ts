/** Résultat de calcul standard : nature « calculation », formules, hypothèses, références, paramètres manquants. */
export interface CalcValue { value: number; unit: string; label: string }
export interface CalcResult {
  nature: "calculation";
  ok: boolean;
  outputs: Record<string, CalcValue>;
  formulas: string[];
  assumptions: string[];
  references: string[];
  missing: string[];
  warnings: string[];
}
export function result(p: Partial<CalcResult> & { outputs?: Record<string, CalcValue> }): CalcResult {
  const missing = p.missing ?? [];
  return { nature: "calculation", ok: missing.length === 0, outputs: p.outputs ?? {}, formulas: p.formulas ?? [], assumptions: p.assumptions ?? [], references: p.references ?? [], missing, warnings: p.warnings ?? [] };
}
export const round = (x: number, d = 4) => Number.isFinite(x) ? Number(x.toPrecision(d + 2)) : x;
export const need = (missing: string[], v: number | null | undefined, name: string): v is number => {
  if (v == null || !Number.isFinite(v)) { missing.push(name); return false; }
  return true;
};
