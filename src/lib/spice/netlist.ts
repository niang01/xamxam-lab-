/**
 * Schéma (éditeur 2D) → netlist SPICE + vérification électrique (ERC). Fonctions pures, testées.
 * Les valeurs saisies sont filtrées : aucune directive SPICE (lignes commençant par « . », retours à la ligne,
 * inclusions) ne peut être injectée depuis l'interface.
 */
export type PartType = "R" | "C" | "L" | "V" | "I" | "D" | "GND";

export const PART_INFO: Record<PartType, { pins: number; label: string; defaultValue: string; unitHint: string }> = {
  R: { pins: 2, label: "Résistance", defaultValue: "1k", unitHint: "Ω (ex. 1k, 4.7k, 220)" },
  C: { pins: 2, label: "Condensateur", defaultValue: "1u", unitHint: "F (ex. 100n, 1u)" },
  L: { pins: 2, label: "Bobine", defaultValue: "1m", unitHint: "H (ex. 10u, 1m)" },
  V: { pins: 2, label: "Source de tension", defaultValue: "DC 5", unitHint: "DC 5 · PULSE(0 5 0 1u 1u 1m 2m) · SIN(0 1 1k) · DC 0 AC 1" },
  I: { pins: 2, label: "Source de courant", defaultValue: "DC 1m", unitHint: "A (ex. DC 1m)" },
  D: { pins: 2, label: "Diode (modèle par défaut ngspice)", defaultValue: "", unitHint: "anode = broche 1, cathode = broche 2" },
  GND: { pins: 1, label: "Masse (nœud 0)", defaultValue: "", unitHint: "" },
};

export interface Part { id: string; type: PartType; x: number; y: number; rot: number; value: string }
export interface WireEnd { part: string; pin: number }
export interface Wire { a: WireEnd; b: WireEnd }
export interface Graph { parts: Part[]; wires: Wire[] }

export type Analysis =
  | { kind: "op" }
  | { kind: "tran"; step: string; stop: string }
  | { kind: "dc"; source: string; start: string; stop: string; step: string }
  | { kind: "ac"; points: number; fstart: string; fstop: string };

export interface Issue { level: "error" | "warning"; message: string; part?: string }

const NUM = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?(meg|[fpnumkgt])?[a-z]*$/i;
const SOURCE = /^(dc\s+\S+(\s+ac\s+\S+)?|ac\s+\S+|\S+|(pulse|sin|pwl|exp)\s*\([0-9eE+\-.\sa-zA-Z,]*\)(\s+ac\s+\S+)?|dc\s+\S+\s+(pulse|sin)\s*\([0-9eE+\-.\sa-zA-Z,]*\))$/i;

export function validValue(type: PartType, v: string): boolean {
  if (/[\n\r;*]/.test(v) || v.trim().startsWith(".")) return false;
  const s = v.trim();
  if (type === "D" || type === "GND") return true;
  if (type === "V" || type === "I") return SOURCE.test(s) && s.split(/\s+|[(),]/).filter(Boolean).every((t) => /^(dc|ac|pulse|sin|pwl|exp)$/i.test(t) || NUM.test(t));
  return NUM.test(s);
}

export const validId = (id: string) => /^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(id);

/** Calcule les nœuds électriques (union-find). La masse impose le nœud « 0 ». */
export function nets(g: Graph): Map<string, string> {
  const parent = new Map<string, string>();
  const key = (p: string, i: number) => `${p}:${i}`;
  const find = (k: string): string => { let r = k; while (parent.get(r) !== r) r = parent.get(r)!; let c = k; while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; } return r; };
  for (const p of g.parts) for (let i = 0; i < PART_INFO[p.type].pins; i++) parent.set(key(p.id, i), key(p.id, i));
  for (const w of g.wires) {
    const a = key(w.a.part, w.a.pin), b = key(w.b.part, w.b.pin);
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
  }
  const groundRoots = new Set(g.parts.filter((p) => p.type === "GND").map((p) => find(key(p.id, 0))));
  const names = new Map<string, string>();
  let n = 1;
  const out = new Map<string, string>();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!names.has(r)) names.set(r, groundRoots.has(r) ? "0" : `n${n++}`);
    out.set(k, names.get(r)!);
  }
  return out;
}

export function erc(g: Graph): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();
  for (const p of g.parts) {
    if (!validId(p.id)) issues.push({ level: "error", message: `Identifiant invalide « ${p.id} »`, part: p.id });
    if (ids.has(p.id)) issues.push({ level: "error", message: `Identifiant en double « ${p.id} »`, part: p.id });
    ids.add(p.id);
    if (!validValue(p.type, p.value)) issues.push({ level: "error", message: `Valeur invalide pour ${p.id} : « ${p.value} » (${PART_INFO[p.type].unitHint})`, part: p.id });
  }
  if (!g.parts.some((p) => p.type === "GND")) issues.push({ level: "error", message: "Aucune masse : placez une masse (référence 0 V)" });
  if (!g.parts.some((p) => p.type === "V" || p.type === "I")) issues.push({ level: "error", message: "Aucune source : le circuit n'est pas alimenté" });
  const nm = nets(g);
  const count = new Map<string, number>();
  const connected = new Set<string>();
  for (const w of g.wires) { connected.add(`${w.a.part}:${w.a.pin}`); connected.add(`${w.b.part}:${w.b.pin}`); }
  for (const p of g.parts) {
    if (p.type === "GND") continue;
    for (let i = 0; i < PART_INFO[p.type].pins; i++) {
      const k = `${p.id}:${i}`;
      if (!connected.has(k)) issues.push({ level: "error", message: `Broche ${i + 1} de ${p.id} non connectée`, part: p.id });
      const n = nm.get(k)!;
      count.set(n, (count.get(n) ?? 0) + 1);
    }
    if (PART_INFO[p.type].pins === 2 && nm.get(`${p.id}:0`) === nm.get(`${p.id}:1`)) {
      issues.push({ level: p.type === "V" ? "error" : "warning", message: p.type === "V" ? `Source ${p.id} en court-circuit (ses deux broches sur le même nœud)` : `${p.id} court-circuité (ses deux broches sur le même nœud)`, part: p.id });
    }
  }
  for (const [n, c] of count) if (c < 2 && n !== "0") issues.push({ level: "warning", message: `Nœud ${n} relié à une seule broche (flottant)` });
  return issues;
}

const lineOf = (p: Part, a: string, b: string) => {
  switch (p.type) {
    case "R": case "C": case "L": return `${p.type}${p.id} ${a} ${b} ${p.value.trim()}`;
    case "V": case "I": return `${p.type}${p.id} ${a} ${b} ${p.value.trim()}`;
    case "D": return `D${p.id} ${a} ${b} DDEFAULT`;
    default: return null;
  }
};

export function analysisLine(an: Analysis): string {
  const ok = (s: string) => NUM.test(s.trim());
  switch (an.kind) {
    case "op": return ".op";
    case "tran": if (!ok(an.step) || !ok(an.stop)) throw new Error("Pas ou durée de simulation invalide"); return `.tran ${an.step} ${an.stop}`;
    case "dc": if (!validId(an.source) || ![an.start, an.stop, an.step].every(ok)) throw new Error("Balayage DC invalide"); return `.dc V${an.source} ${an.start} ${an.stop} ${an.step}`;
    case "ac": if (!Number.isInteger(an.points) || an.points < 1 || an.points > 1000 || !ok(an.fstart) || !ok(an.fstop)) throw new Error("Analyse AC invalide"); return `.ac dec ${an.points} ${an.fstart} ${an.fstop}`;
  }
}

/** Génère la netlist (refuse si l'ERC contient des erreurs). */
export function toNetlist(g: Graph, an: Analysis, title = "XAM-XAM LAB"): { netlist: string; issues: Issue[] } {
  const issues = erc(g);
  if (issues.some((i) => i.level === "error")) return { netlist: "", issues };
  const nm = nets(g);
  const lines = [`* ${title.replace(/[\n\r]/g, " ").slice(0, 80)}`];
  for (const p of g.parts) {
    const l = lineOf(p, nm.get(`${p.id}:0`)!, nm.get(`${p.id}:1`) ?? "0");
    if (l) lines.push(l);
  }
  if (g.parts.some((p) => p.type === "D")) lines.push(".model DDEFAULT D");
  lines.push(analysisLine(an), ".end");
  return { netlist: lines.join("\n"), issues };
}
