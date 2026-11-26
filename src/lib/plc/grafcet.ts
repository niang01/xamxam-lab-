/**
 * Grafcet (CEI 60848) simulé — fonctions pures.
 *
 * Réceptivités en notation française : « . » ET, « + » OU, « / » NON (préfixe), « ↑ » / « ↓ » fronts,
 * parenthèses, constante 1, variables (I1, M2…), état d'étape X3, temporisation « t/X1/3s » (vraie quand
 * l'étape 1 est active depuis au moins 3 s ; ms accepté : « t/X1/500ms »).
 * Règles d'évolution : une transition est franchissable si toutes ses étapes amont sont actives et sa réceptivité
 * vraie ; toutes les transitions franchissables sont franchies simultanément (règle 4) ; une étape activée et
 * désactivée en même temps reste active (règle 5). Recherche de stabilité : on itère sans nouveau front d'entrée
 * jusqu'à ce qu'aucune transition ne soit franchissable (au plus 50 itérations, sinon « grafcet instable »).
 * Actions : continues (N, sortie vraie tant que l'étape est active), mémorisées (S / R) ; sorties continues
 * combinées par OU entre les étapes actives.
 */

export interface GStep { id: number; initial?: boolean; actions: { kind: "N" | "S" | "R"; v: string }[]; comment?: string }
export interface GTransition { id: number; from: number[]; to: number[]; cond: string }
export interface GrafcetProgram { title: string; description: string; inputs: { v: string; label: string }[]; outputs: { v: string; label: string }[]; steps: GStep[]; transitions: GTransition[] }
export interface GState { active: number[]; since: Record<number, number>; timeMs: number; stored: Record<string, boolean>; prevInputs: Record<string, boolean> }

type Node = { t: "const"; v: boolean } | { t: "var"; v: string } | { t: "step"; n: number } | { t: "tmr"; n: number; ms: number }
  | { t: "not"; a: Node } | { t: "and" | "or"; a: Node; b: Node } | { t: "edge"; up: boolean; a: Node };

/** Analyse d'une réceptivité ; erreur explicite en cas de syntaxe incorrecte. */
export function parseCond(src: string): Node {
  const s = src.replace(/\s+/g, "");
  let i = 0;
  const fail = (m: string): never => { throw new Error(`Réceptivité « ${src} » : ${m} (position ${i + 1})`); };
  const or = (): Node => { let a = and(); while (s[i] === "+") { i++; a = { t: "or", a, b: and() }; } return a; };
  const and = (): Node => { let a = un(); while (s[i] === "." || s[i] === "*") { i++; a = { t: "and", a, b: un() }; } return a; };
  const un = (): Node => {
    const c = s[i];
    if (c === "/" || c === "¬" || c === "!") { i++; return { t: "not", a: un() }; }
    if (c === "↑" || c === "↓") { i++; return { t: "edge", up: c === "↑", a: un() }; }
    if (c === "(") { i++; const a = or(); if (s[i] !== ")") fail("parenthèse fermante attendue"); i++; return a; }
    const tm = /^t\/X(\d+)\/(\d+(?:[.,]\d+)?)(ms|s)/.exec(s.slice(i));
    if (tm) { i += tm[0].length; return { t: "tmr", n: Number(tm[1]), ms: Number(tm[2].replace(",", ".")) * (tm[3] === "s" ? 1000 : 1) }; }
    const st = /^X(\d+)/.exec(s.slice(i));
    if (st) { i += st[0].length; return { t: "step", n: Number(st[1]) }; }
    const v = /^(I|M|Q|C|T)\d+/.exec(s.slice(i));
    if (v) { i += v[0].length; return { t: "var", v: v[0] }; }
    if (c === "1" || c === "0") { i++; return { t: "const", v: c === "1" }; }
    return fail("terme attendu (I1, X2, t/X1/3s, 1, /…, ↑…)");
  };
  if (!s) fail("réceptivité vide");
  const n = or();
  if (i !== s.length) fail("caractère inattendu");
  return n;
}

function evalNode(n: Node, env: { vars: Record<string, boolean>; prev: Record<string, boolean>; active: Set<number>; since: Record<number, number>; now: number }): boolean {
  switch (n.t) {
    case "const": return n.v;
    case "var": return !!env.vars[n.v];
    case "step": return env.active.has(n.n);
    case "tmr": return env.active.has(n.n) && env.now - (env.since[n.n] ?? env.now) >= n.ms;
    case "not": return !evalNode(n.a, env);
    case "and": return evalNode(n.a, env) && evalNode(n.b, env);
    case "or": return evalNode(n.a, env) || evalNode(n.b, env);
    case "edge": {
      const cur = evalNode(n.a, env), before = evalNode(n.a, { ...env, vars: env.prev });
      return n.up ? cur && !before : !cur && before;
    }
  }
}

export function checkGrafcet(g: GrafcetProgram): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const ids = new Set(g.steps.map((s) => s.id));
  if (ids.size !== g.steps.length) errors.push("Numéros d'étapes en double");
  if (!g.steps.some((s) => s.initial)) errors.push("Aucune étape initiale");
  for (const t of g.transitions) {
    if (!t.from.length || !t.to.length) errors.push(`Transition ${t.id} : étapes amont et aval obligatoires`);
    for (const x of [...t.from, ...t.to]) if (!ids.has(x)) errors.push(`Transition ${t.id} : étape ${x} inexistante`);
    try { parseCond(t.cond); } catch (e) { errors.push(`Transition ${t.id} : ${(e as Error).message}`); }
  }
  for (const s of g.steps) {
    if (!g.transitions.some((t) => t.from.includes(s.id))) warnings.push(`Étape ${s.id} sans transition de sortie (étape puits)`);
    for (const a of s.actions) if (!/^(Q|M)\d+$/.test(a.v)) errors.push(`Étape ${s.id} : action sur « ${a.v} » (sortie Q ou mémoire M attendue)`);
  }
  return { errors, warnings };
}

export function initialState(g: GrafcetProgram): GState {
  const active = g.steps.filter((s) => s.initial).map((s) => s.id);
  return { active, since: Object.fromEntries(active.map((a) => [a, 0])), timeMs: 0, stored: {}, prevInputs: {} };
}

/** Sorties : actions continues des étapes actives (OU) et actions mémorisées. */
export function outputsOf(g: GrafcetProgram, st: Pick<GState, "active" | "stored">): Record<string, boolean> {
  const out: Record<string, boolean> = { ...st.stored };
  for (const s of g.steps) if (st.active.includes(s.id)) for (const a of s.actions) if (a.kind === "N") out[a.v] = true;
  return out;
}

/** Avance le temps de `dtMs` avec les entrées données, puis fait évoluer le grafcet jusqu'à stabilité. */
export function step(g: GrafcetProgram, st: GState, inputs: Record<string, boolean>, dtMs: number): GState & { fired: number[]; unstable: boolean } {
  const now = st.timeMs + dtMs;
  const parsed = new Map(g.transitions.map((t) => [t.id, parseCond(t.cond)]));
  let active = new Set(st.active);
  const since = { ...st.since };
  const stored = { ...st.stored };
  let prev = st.prevInputs;
  const fired: number[] = [];
  let unstable = true;
  for (let iter = 0; iter < 50; iter++) {
    const vars = { ...inputs, ...outputsOf(g, { active: [...active], stored }) };
    const env = { vars, prev: { ...prev, ...outputsOf(g, { active: [...active], stored }) }, active, since, now };
    const ready = g.transitions.filter((t) => t.from.every((x) => active.has(x)) && evalNode(parsed.get(t.id)!, env));
    if (!ready.length) { unstable = false; break; }
    const off = new Set(ready.flatMap((t) => t.from)), on = new Set(ready.flatMap((t) => t.to));
    const next = new Set([...active].filter((x) => !off.has(x) || on.has(x)));
    for (const x of on) { if (!active.has(x) || off.has(x)) since[x] = now; next.add(x); }
    active = next;
    fired.push(...ready.map((t) => t.id));
    for (const s of g.steps) if (on.has(s.id)) for (const a of s.actions) { if (a.kind === "S") stored[a.v] = true; if (a.kind === "R") stored[a.v] = false; }
    prev = inputs; // les fronts d'entrée ne sont vus qu'une fois pendant la recherche de stabilité
  }
  return { active: [...active].sort((a, b) => a - b), since, timeMs: now, stored, prevInputs: inputs, fired, unstable };
}
