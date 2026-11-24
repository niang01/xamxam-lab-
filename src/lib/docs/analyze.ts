/**
 * Analyse déterministe d'un document technique (fonctions pures, testées) :
 *  1. découpage en exercices et questions ;
 *  2. relevé des données « symbole = valeur unité » (conversion des préfixes, contrôle de dimension) ;
 *  3. choix du calcul de la plateforme adapté (registre testé : loi d'Ohm, puissances, courant d'emploi, chute de
 *     tension, couple, pompe, sous-réseau) et résolution étape par étape ;
 *  4. vérification croisée (re-substitution), comparaison avec les réponses écrites dans le document ;
 *  5. séparation stricte : informations extraites / hypothèses / résultats calculés / points à valider.
 * Aucune donnée manquante n'est inventée : elle est listée comme « paramètre manquant ».
 */
export type Dim = "voltage" | "current" | "resistance" | "power" | "apparent" | "reactive" | "energy" | "length" | "area" | "frequency" | "speed" | "torque" | "flow" | "head" | "ratio" | "temperature" | "pressure" | "unknown";

export interface Quantity { symbol: string; raw: string; value: number; unit: string; si: number; dim: Dim; hypothesis?: string }
export interface Question { label: string; text: string }
export interface Block { title: string; text: string; questions: Question[]; data: Quantity[]; answers: Quantity[]; system: "single" | "three" | null; conductor: "copper" | "aluminium" | null; cidr: string | null }

const PREFIX: Record<string, number> = { G: 1e9, M: 1e6, k: 1e3, h: 1e2, m: 1e-3, "µ": 1e-6, "μ": 1e-6, u: 1e-6, n: 1e-9 };
const UNITS: [RegExp, Dim, string, number?][] = [
  [/^(V)$/, "voltage", "V"], [/^(A)$/, "current", "A"], [/^(Ω|ohms?|Ohms?)$/, "resistance", "Ω"], [/^(W)$/, "power", "W"], [/^(VA)$/, "apparent", "VA"],
  [/^(var|VAR|VAr)$/, "reactive", "var"], [/^(Wh)$/, "energy", "Wh"], [/^(Hz)$/, "frequency", "Hz"], [/^(m)$/, "length", "m"],
  [/^(mm²|mm2)$/, "area", "mm²", 1], [/^(tr\/min|rpm|tr\.min-1)$/, "speed", "tr/min", 1], [/^(N·m|N\.m|Nm)$/, "torque", "N·m"],
  [/^(m³\/h|m3\/h)$/, "flow", "m³/h", 1], [/^(mCE|mce)$/, "head", "m", 1], [/^(%)$/, "ratio", "%", 0.01], [/^(°C)$/, "temperature", "°C", 1], [/^(K)$/, "temperature", "K", 1], [/^(bar)$/, "pressure", "bar", 1],
];

/** Interprète une unité éventuellement préfixée (kW, mA, kΩ, MW, µF…). */
export function parseUnit(u: string): { dim: Dim; unit: string; factor: number } | null {
  const s = u.trim();
  if (!s) return null;
  for (const [re, dim, unit, fixed] of UNITS) if (re.test(s)) return { dim, unit, factor: fixed ?? 1 };
  const p = s[0], rest = s.slice(1);
  if (PREFIX[p] && rest) for (const [re, dim, unit, fixed] of UNITS) if (fixed === undefined && re.test(rest)) return { dim, unit, factor: PREFIX[p] };
  return null;
}

/** Dimension attendue pour un symbole usuel (sert au contrôle des unités et aux hypothèses). */
export function expectedDim(symbol: string): Dim | null {
  const s = symbol.toLowerCase();
  if (/^cos/.test(s) || /^(η|eta|rendement)/.test(s)) return "ratio";
  if (/^u|^v[a-z0-9]*$/.test(s)) return "voltage";
  if (/^i/.test(s)) return "current";
  if (/^r/.test(s)) return "resistance";
  if (/^p/.test(s)) return "power";
  if (/^s$/.test(s)) return null; // S : section (mm²) ou puissance apparente (VA) — ambigu
  if (/^q$/.test(s)) return null;
  if (/^(l|long)/.test(s)) return "length";
  if (/^f$/.test(s)) return "frequency";
  if (/^n$/.test(s)) return "speed";
  if (/^(c|t)$/.test(s)) return null;
  if (/^(h|hmt)$/.test(s)) return "head";
  return null;
}

const NUM = String.raw`-?\d+(?:[   ]\d{3})*(?:[.,]\d+)?`;
const QTY = new RegExp(String.raw`(cos\s*(?:φ|ϕ|phi)|η|[A-Za-zΔ][A-Za-z0-9_]{0,5})\s*=\s*(${NUM})\s*([a-zA-ZΩµμ°²³%\/·.\-]*[²³]?)`, "g");
const toNum = (s: string) => Number(s.replace(/[   ]/g, "").replace(",", "."));

export function parseQuantities(text: string): Quantity[] {
  const out: Quantity[] = [];
  for (const m of text.matchAll(QTY)) {
    const symbol = m[1].replace(/\s+/g, " ").replace(/phi|ϕ/i, "φ");
    const value = toNum(m[2]);
    if (!Number.isFinite(value)) continue;
    let unitRaw = m[3].replace(/[.\-]+$/, "");
    const u = parseUnit(unitRaw);
    const exp = expectedDim(symbol);
    let q: Quantity;
    if (u) q = { symbol, raw: m[0].trim(), value, unit: u.unit, si: value * u.factor, dim: u.dim };
    else if (unitRaw && exp !== "ratio") q = { symbol, raw: m[0].trim(), value, unit: unitRaw, si: value, dim: "unknown", hypothesis: `Unité « ${unitRaw} » non reconnue pour ${symbol} : grandeur non utilisée (vérifier la lecture)` };
    else if (exp === "ratio") { unitRaw = ""; q = { symbol, raw: m[0].trim(), value, unit: "", si: value > 1 && /^(η|rendement)/i.test(symbol) ? value / 100 : value, dim: "ratio" }; }
    else q = { symbol, raw: m[0].trim(), value, unit: unitRaw, si: value, dim: exp ?? "unknown", hypothesis: exp ? `Unité non précisée pour ${symbol} : interprétée dans l'unité usuelle (${({ voltage: "V", current: "A", resistance: "Ω", power: "W", length: "m", frequency: "Hz", speed: "tr/min", head: "m" } as Record<string, string>)[exp] ?? "SI"}) — à confirmer` : `Grandeur ${symbol} sans unité reconnue : non utilisée` };
    if (q.dim === "unknown" && !q.hypothesis) q.hypothesis = `Unité « ${unitRaw} » non reconnue : grandeur non utilisée`;
    out.push(q);
  }
  return out;
}

const QUESTION = /^\s*(?:(\d{1,2}|[a-h])\s*[).°-]|[-•]\s*)?\s*((?:calcule|détermine|determine|donne|trouve|vérifie|verifie|justifie|dessine|représente|indique|en déduire|déduire|exprime|compare|choisi|quelle?s?|combien|compute|calculate|find|determine)[^\n]*)/i;

/** Découpe en exercices (« Exercice 1 », « Problème », « Partie A »…) puis repère questions, données et réponses. */
export function splitExercises(text: string): Block[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: { title: string; lines: string[] }[] = [];
  for (const l of lines) {
    const h = l.match(/^\s*((?:exercice|exercise|problème|probleme|question|partie|part)\s*(?:n[°o]\s*)?[\dIVXA-H]+[^\n]{0,60})/i);
    if (h && (blocks.length === 0 || blocks.at(-1)!.lines.some((x) => x.trim()))) blocks.push({ title: h[1].trim(), lines: [] });
    else if (!blocks.length) blocks.push({ title: "Document", lines: [l] });
    else blocks.at(-1)!.lines.push(l);
  }
  return blocks.map((b): Block => {
    const body = b.lines.join("\n");
    const answerLines = b.lines.filter((l) => /^\s*(r[ée]ponse|answer|r\s*:)/i.test(l));
    const dataText = b.lines.filter((l) => !answerLines.includes(l)).join("\n");
    const questions: Question[] = [];
    for (const l of b.lines) {
      const m = l.match(QUESTION);
      if (m || /\?\s*$/.test(l.trim())) questions.push({ label: m?.[1] ?? String(questions.length + 1), text: (m?.[2] ?? l).trim() });
    }
    const low = body.toLowerCase();
    return {
      title: b.title, text: body.trim(), questions,
      data: parseQuantities(dataText), answers: parseQuantities(answerLines.join("\n")),
      system: /triphas|three[- ]phase|3\s*~|400\s*v/.test(low) ? "three" as const : /monophas|single[- ]phase|230\s*v/.test(low) ? "single" as const : null,
      conductor: /alu/.test(low) ? "aluminium" as const : /cuivre|copper/.test(low) ? "copper" as const : null,
      cidr: body.match(/\b(\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2})\b/)?.[1] ?? null,
    };
  }).filter((b) => b.text || b.title !== "Document");
}

const pick = (b: Block, dim: Dim, re?: RegExp) => b.data.find((q) => q.dim === dim && (!re || re.test(q.symbol)))?.si ?? null;

export interface Plan { kind: string; input: Record<string, unknown>; reason: string }

/** Choix du calcul : mots-clés de l'énoncé + grandeurs disponibles. Retourne null si rien n'est reconnu. */
export function planFor(b: Block): Plan | null {
  const low = b.text.toLowerCase();
  const U = pick(b, "voltage"), I = pick(b, "current"), R = pick(b, "resistance"), P = pick(b, "power"), cos = b.data.find((q) => /^cos/i.test(q.symbol))?.si ?? null;
  const eta = b.data.find((q) => /^(η|eta|rendement)/i.test(q.symbol))?.si ?? null;
  const L = pick(b, "length"), S = b.data.find((q) => q.dim === "area")?.si ?? null, n = pick(b, "speed");
  if (b.cidr) return { kind: "subnet", input: { cidr: b.cidr }, reason: "adresse réseau CIDR dans l'énoncé" };
  if (/chute de tension|voltage drop/.test(low)) return { kind: "voltage_drop", input: { system: b.system, u: U, i: I, lengthM: L, sectionMm2: S, conductor: b.conductor, tempC: null, cosPhi: cos }, reason: "« chute de tension » dans l'énoncé" };
  if (/courant d'emploi|courant nominal absorb|design current/.test(low) || (P != null && U != null && cos != null && I == null)) return { kind: "design_current", input: { system: b.system, pW: P, u: U, cosPhi: cos, efficiency: eta ?? (/rendement/.test(low) ? null : 1) }, reason: "puissance, tension et cos φ donnés, courant demandé" };
  if (/couple|torque/.test(low) && (P != null || n != null)) return { kind: "torque", input: { powerW: P, rpm: n }, reason: "« couple » dans l'énoncé" };
  if (U != null && I != null && cos != null) return { kind: "ac_power", input: { system: b.system, u: U, i: I, cosPhi: cos }, reason: "tension, courant et cos φ donnés" };
  if ([U, I, R].filter((x) => x != null).length >= 2) return { kind: "ohm", input: { u: U, i: I, r: R }, reason: "deux grandeurs parmi U, I, R" };
  return null;
}

export interface CalcOutput { outputs: Record<string, { value: number; unit: string; label: string }>; formulas: string[]; missing: string[]; warnings: string[]; assumptions?: string[] }
export interface AnswerCheck { given: string; computed: string | null; verdict: "correct" | "incorrect" | "non comparable"; deviationPct: number | null }

const DIM_OF_UNIT: Record<string, Dim> = { V: "voltage", A: "current", "Ω": "resistance", W: "power", VA: "apparent", var: "reactive", "N·m": "torque", "hôtes": "unknown" };

/** Compare chaque réponse écrite dans le document au résultat calculé de même dimension (tolérance 2 %). */
export function checkAnswers(answers: Quantity[], r: CalcOutput | null): AnswerCheck[] {
  return answers.map((a) => {
    const o = r ? Object.values(r.outputs).find((x) => DIM_OF_UNIT[x.unit] === a.dim) : undefined;
    if (!o) return { given: a.raw, computed: null, verdict: "non comparable", deviationPct: null };
    const dev = o.value === 0 ? (a.si === 0 ? 0 : 100) : (Math.abs(a.si - o.value) / Math.abs(o.value)) * 100;
    return { given: a.raw, computed: `${o.value} ${o.unit}`, verdict: dev <= 2 ? "correct" : "incorrect", deviationPct: Math.round(dev * 100) / 100 };
  });
}

/** Contrôles : unités incohérentes avec le symbole, valeurs non finies, re-substitution des lois. */
export function crossChecks(b: Block, plan: Plan | null, r: CalcOutput | null): string[] {
  const out: string[] = [];
  for (const q of b.data) {
    const exp = expectedDim(q.symbol);
    if (exp && q.dim !== "unknown" && exp !== q.dim && !(exp === "power" && (q.dim === "apparent" || q.dim === "reactive"))) out.push(`⚠ ${q.raw} : l'unité ne correspond pas à la grandeur habituelle du symbole ${q.symbol} (${exp} attendu)`);
    if (q.dim === "ratio" && (q.si < 0 || q.si > 1)) out.push(`⚠ ${q.raw} : un facteur de puissance ou un rendement doit être compris entre 0 et 1`);
  }
  if (r) for (const o of Object.values(r.outputs)) if (!Number.isFinite(o.value)) out.push(`⚠ ${o.label} : valeur non finie`);
  if (plan?.kind === "ohm" && r) {
    const u = r.outputs.u?.value, i = r.outputs.i?.value, rr = r.outputs.r?.value;
    if (u != null && i != null && rr != null) out.push(Math.abs(u - rr * i) <= 1e-6 * Math.max(1, Math.abs(u)) ? `✓ Re-substitution : R × I = ${rr} × ${i} = ${+(rr * i).toPrecision(6)} V = U` : `⚠ Re-substitution : R × I ≠ U`);
  }
  if (plan?.kind === "ac_power" && r?.outputs.p && r.outputs.s) {
    const p = r.outputs.p.value, s = r.outputs.s.value, q = r.outputs.q?.value;
    if (q != null) out.push(Math.abs(s * s - p * p - q * q) <= 1e-3 * s * s ? "✓ Triangle des puissances : S² = P² + Q²" : "⚠ Triangle des puissances non vérifié");
  }
  return out;
}

/** Étapes de résolution lisibles : données → formule(s) → résultat. */
export function steps(b: Block, plan: Plan, r: CalcOutput): string[] {
  const data = Object.entries(plan.input).filter(([, v]) => v != null).map(([k, v]) => `${k} = ${v}`).join(" ; ");
  return [
    `Données utilisées (unités SI) : ${data || "—"}`,
    ...r.formulas.map((f) => `Formule : ${f}`),
    ...Object.values(r.outputs).map((o) => `Résultat : ${o.label} = ${o.value} ${o.unit}`),
    ...r.missing.map((m) => `Paramètre manquant : ${m}`),
  ];
}
