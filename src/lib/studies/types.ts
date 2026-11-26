/**
 * Logiciels de dimensionnement de XAM-XAM LAB : chaque logiciel = formulaire décrit ici + moteur de calcul PUR
 * (src/lib/studies/*.ts) + nomenclature + schéma (générateur des Schémas 2D) + rapport exportable.
 * Règle : aucune valeur technique n'est supposée ; un paramètre absent est signalé dans `missing` et le calcul qui
 * en dépend n'est pas effectué. Les constantes physiques utilisées sont citées dans `references`.
 */
export type FieldType = "number" | "int" | "text" | "select" | "rows" | "bool" | "months";
export interface StudyField {
  key: string; label: string; unit?: string; type: FieldType; hint?: string;
  options?: { v: string; l: string }[]; cols?: StudyField[]; optional?: boolean;
}
/** Sélection d'une référence réelle de la bibliothèque (composant non générique) : ses caractéristiques remplissent les champs. */
export interface EquipmentPick { label: string; names: string[]; map: Record<string, string> }
/** `geo` : recherche de lieu et données NASA POWER (remplit lat, lon, place, ghi, tmean, t_min, t_max). */
export interface StudySection { title: string; fields: StudyField[]; equipment?: EquipmentPick[]; geo?: boolean }

export interface Line { label: string; value: number | string; unit?: string; formula?: string }
export interface Step { title: string; lines: Line[]; ok?: boolean; note?: string }
export interface BomLine { name: string; qty: number; unit: string; spec: string }
export interface StudyResult {
  nature: "calculation";
  ok: boolean;
  missing: string[];
  warnings: string[];
  steps: Step[];
  bom: BomLine[];
  /** Schéma à ouvrir dans l'éditeur 2D (générateur + paramètres). */
  diagram: { kind: string; params: Record<string, number | string> } | null;
  references: string[];
  assumptions: string[];
  summary: Line[];
}
export type Input = Record<string, unknown>;
export interface Software {
  key: string; title: string; discipline: string; lab: string; summary: string;
  sections: StudySection[];
  /** Exemple saisi pour la démonstration et les tests (valeurs d'un cas d'étude, à remplacer par les vôtres). */
  example: Input;
  /** Données serveur nécessaires (tableaux normatifs…), résolues par l'API avant l'appel du moteur. */
  needs?: ("ampacity_table")[];
  run: (input: Input, ctx: StudyContext) => StudyResult;
}
export interface StudyContext { ampacity?: { reference: string; rows: { s: number; iz: number }[] } | null }

export const empty = (): StudyResult => ({ nature: "calculation", ok: true, missing: [], warnings: [], steps: [], bom: [], diagram: null, references: [], assumptions: [], summary: [] });

/** Lecture d'un nombre saisi : null si absent ou invalide (jamais de valeur par défaut). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export const r2 = (x: number, d = 3) => Number.isFinite(x) ? Number(x.toPrecision(d + 1)) : x;
/** Ajoute un manque et renvoie false si la valeur est absente (ou hors bornes). */
export function req(res: StudyResult, v: number | null, name: string, opts: { min?: number; max?: number; positive?: boolean } = {}): v is number {
  if (v == null) { res.missing.push(name); return false; }
  if ((opts.positive && v <= 0) || (opts.min != null && v < opts.min) || (opts.max != null && v > opts.max)) { res.missing.push(`${name} (valeur hors domaine : ${v})`); return false; }
  return true;
}
export function rows(v: unknown): Record<string, unknown>[] { return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : []; }
export function finish(res: StudyResult): StudyResult { res.ok = res.missing.length === 0; return res; }

/** Champ numérique (raccourci de déclaration). */
export const nf = (key: string, label: string, unit?: string, o: Partial<StudyField> = {}): StudyField => ({ key, label, ...(unit ? { unit } : {}), type: "number", ...o });
/** Lecture groupée de valeurs obligatoires : chaque absence est ajoutée aux données manquantes. */
export function grab(res: StudyResult, input: Input, spec: Record<string, [label: string, opts?: { min?: number; max?: number; positive?: boolean }]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, [label, opts]] of Object.entries(spec)) { const v = num(input[k]); if (req(res, v, label, opts)) out[k] = v; }
  return out;
}
/** Valeurs normalisées de la série E12 (CEI 60063), une décade. */
export const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
/** Valeur E12 la plus proche (en échelle logarithmique). */
export function nearestE12(x: number): number {
  if (!(x > 0)) return NaN;
  const dec = 10 ** Math.floor(Math.log10(x));
  const cands = [...E12.map((v) => v * dec), 10 * dec, 0.82 * dec];
  return cands.reduce((a, b) => (Math.abs(Math.log(b / x)) < Math.abs(Math.log(a / x)) ? b : a));
}
/** Valeur E12 immédiatement supérieure ou égale. */
export function nextE12(x: number): number {
  const dec = 10 ** Math.floor(Math.log10(x));
  return [...E12.map((v) => v * dec), 10 * dec].find((v) => v >= x * (1 - 1e-9))!;
}
