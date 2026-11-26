/**
 * Automate programmable simulé — langage à contacts (Ladder, CEI 61131-3 « LD »). Fonctions pures.
 *
 * Variables : entrées I1…I32, sorties Q1…Q32, mémoires M1…M64, temporisations T1…T16 (bit de sortie),
 * compteurs C1…C16 (bit de sortie). Cycle d'automate : lecture des entrées, exécution des échelons dans l'ordre
 * (une variable écrite par un échelon est lue à jour par les échelons suivants du même cycle), écriture des sorties.
 * Temporisations : TON (retard à l'enclenchement), TOF (retard au déclenchement), TP (impulsion), comme la CEI 61131-3.
 * Compteurs : CTU (comptage, bit = valeur ≥ présélection), CTD (décomptage, bit = valeur ≤ 0), CRES (remise à zéro).
 * Contacts P / N : front montant / descendant de la variable entre le cycle précédent et le cycle courant.
 */

export type ContactKind = "NO" | "NC" | "P" | "N";
export interface Contact { kind: ContactKind; v: string }
export type CoilKind = "OUT" | "NOT" | "SET" | "RST" | "TON" | "TOF" | "TP" | "CTU" | "CTD" | "CRES";
export interface Coil { kind: CoilKind; v: string; preset?: number }
/** Échelon : branches en parallèle (OU), chacune étant une suite de contacts en série (ET), puis une sortie. */
export interface Rung { branches: Contact[][]; out: Coil; comment?: string }
export interface IoLabel { v: string; label: string }
export interface LadderProgram { title: string; description: string; inputs: IoLabel[]; outputs: IoLabel[]; rungs: Rung[] }

export interface TimerState { et: number; q: boolean; prevIn: boolean; running: boolean }
export interface CounterState { cv: number; q: boolean; prevIn: boolean }
export interface PlcState { bits: Record<string, boolean>; prev: Record<string, boolean>; timers: Record<string, TimerState>; counters: Record<string, CounterState>; cycles: number; timeMs: number }

export const VAR_RE = /^(I|Q|M|T|C)([1-9]\d?)$/;
const LIMITS: Record<string, number> = { I: 32, Q: 32, M: 64, T: 16, C: 16 };

export function emptyState(): PlcState { return { bits: {}, prev: {}, timers: {}, counters: {}, cycles: 0, timeMs: 0 }; }

/** Vérification du programme : variables valides, écriture interdite sur les entrées, présélections, sorties doublées. */
export function checkLadder(p: LadderProgram): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const valid = (v: string) => { const m = VAR_RE.exec(v); return !!m && Number(m[2]) <= LIMITS[m[1]]; };
  const outs = new Map<string, number>();
  p.rungs.forEach((r, i) => {
    const n = i + 1;
    if (!r.branches.length || r.branches.some((b) => !b.length)) errors.push(`Échelon ${n} : chaque branche doit comporter au moins un contact`);
    for (const b of r.branches) for (const c of b) if (!valid(c.v)) errors.push(`Échelon ${n} : variable de contact invalide « ${c.v} »`);
    const o = r.out;
    if (!valid(o.v)) { errors.push(`Échelon ${n} : variable de sortie invalide « ${o.v} »`); return; }
    const kind = o.v[0];
    if (["TON", "TOF", "TP"].includes(o.kind)) {
      if (kind !== "T") errors.push(`Échelon ${n} : une temporisation s'écrit sur une variable T (ex. T1)`);
      if (!(o.preset && o.preset > 0)) errors.push(`Échelon ${n} : durée de la temporisation ${o.v} manquante (ms)`);
    } else if (["CTU", "CTD"].includes(o.kind)) {
      if (kind !== "C") errors.push(`Échelon ${n} : un compteur s'écrit sur une variable C (ex. C1)`);
      if (!(o.preset != null && o.preset >= 0)) errors.push(`Échelon ${n} : présélection du compteur ${o.v} manquante`);
    } else if (o.kind === "CRES") {
      if (kind !== "C") errors.push(`Échelon ${n} : la remise à zéro concerne un compteur (C)`);
    } else {
      if (kind === "I") errors.push(`Échelon ${n} : une entrée (${o.v}) ne peut pas être écrite par le programme`);
      if (kind === "T" || kind === "C") errors.push(`Échelon ${n} : ${o.v} est écrit par sa temporisation ou son compteur`);
      if (o.kind === "OUT" || o.kind === "NOT") outs.set(o.v, (outs.get(o.v) ?? 0) + 1);
    }
  });
  for (const [v, k] of outs) if (k > 1) warnings.push(`La bobine ${v} est commandée par ${k} échelons : seul le dernier compte (utiliser SET/RST ou une mémoire)`);
  return { errors, warnings };
}

const contactValue = (c: Contact, bits: Record<string, boolean>, prev: Record<string, boolean>): boolean => {
  const v = !!bits[c.v], p = !!prev[c.v];
  switch (c.kind) { case "NO": return v; case "NC": return !v; case "P": return v && !p; case "N": return !v && p; }
};

/** Puissance d'un échelon (OU des branches, ET des contacts) avec l'état courant des variables. */
export function rungPower(r: Rung, bits: Record<string, boolean>, prev: Record<string, boolean>): boolean {
  return r.branches.some((b) => b.every((c) => contactValue(c, bits, prev)));
}

/** Un cycle d'automate de durée `dtMs` : entrées imposées, échelons exécutés dans l'ordre, nouvel état (l'ancien n'est pas modifié). */
export function scan(p: LadderProgram, s: PlcState, inputs: Record<string, boolean>, dtMs: number): PlcState & { power: boolean[] } {
  const bits: Record<string, boolean> = { ...s.bits };
  for (const [k, v] of Object.entries(inputs)) if (k.startsWith("I")) bits[k] = v;
  const prev = s.prev;
  const timers: Record<string, TimerState> = Object.fromEntries(Object.entries(s.timers).map(([k, t]) => [k, { ...t }]));
  const counters: Record<string, CounterState> = Object.fromEntries(Object.entries(s.counters).map(([k, c]) => [k, { ...c }]));
  const power: boolean[] = [];
  for (const r of p.rungs) {
    const on = rungPower(r, bits, prev);
    power.push(on);
    const o = r.out;
    switch (o.kind) {
      case "OUT": bits[o.v] = on; break;
      case "NOT": bits[o.v] = !on; break;
      case "SET": if (on) bits[o.v] = true; break;
      case "RST": if (on) bits[o.v] = false; break;
      case "TON": case "TOF": case "TP": {
        const t = timers[o.v] ?? { et: 0, q: false, prevIn: false, running: false };
        const pt = o.preset ?? 0;
        if (o.kind === "TON") { t.et = on ? Math.min(pt, t.et + dtMs) : 0; t.q = on && t.et >= pt; }
        else if (o.kind === "TOF") {
          if (on) { t.et = 0; t.q = true; }
          else if (t.q) { t.et = Math.min(pt, t.et + dtMs); t.q = t.et < pt; }
        } else {
          if (on && !t.prevIn && !t.running) { t.running = true; t.et = 0; }
          if (t.running) { t.et = Math.min(pt, t.et + dtMs); if (t.et >= pt) t.running = false; }
          else if (!on) t.et = 0;
          t.q = t.running;
        }
        t.prevIn = on; timers[o.v] = t; bits[o.v] = t.q; break;
      }
      case "CTU": case "CTD": case "CRES": {
        const c = counters[o.v] ?? { cv: o.kind === "CTD" ? (o.preset ?? 0) : 0, q: false, prevIn: false };
        if (o.kind === "CRES") { if (on) { c.cv = 0; c.q = false; } }
        else {
          if (on && !c.prevIn) c.cv = o.kind === "CTU" ? c.cv + 1 : Math.max(0, c.cv - 1);
          c.prevIn = on;
          c.q = o.kind === "CTU" ? c.cv >= (o.preset ?? 0) : c.cv <= 0;
        }
        counters[o.v] = c; bits[o.v] = c.q; break;
      }
    }
  }
  return { bits, prev: { ...bits }, timers, counters, cycles: s.cycles + 1, timeMs: s.timeMs + dtMs, power };
}

/** Exécute `ms` millisecondes de fonctionnement avec un cycle de `cycleMs` (entrées constantes pendant la durée). */
export function runFor(p: LadderProgram, s: PlcState, inputs: Record<string, boolean>, ms: number, cycleMs = 10): PlcState & { power: boolean[] } {
  let st: PlcState & { power: boolean[] } = { ...s, power: [] };
  for (let t = 0; t < ms; t += cycleMs) st = scan(p, st, inputs, Math.min(cycleMs, ms - t));
  return st;
}

/** Programme en liste d'instructions lisible (documentation, rapport). */
export function ladderText(p: LadderProgram): string {
  const c = (x: Contact) => ({ NO: x.v, NC: `/${x.v}`, P: `↑${x.v}`, N: `↓${x.v}` })[x.kind];
  return p.rungs.map((r, i) => {
    const cond = r.branches.map((b) => b.map(c).join(" . ")).join(" + ");
    const out = ["TON", "TOF", "TP"].includes(r.out.kind) ? `${r.out.kind} ${r.out.v} (${r.out.preset} ms)` : ["CTU", "CTD"].includes(r.out.kind) ? `${r.out.kind} ${r.out.v} (PV ${r.out.preset})` : `${r.out.kind} ${r.out.v}`;
    return `${String(i + 1).padStart(2, "0")}  ${cond}  →  ${out}${r.comment ? `   // ${r.comment}` : ""}`;
  }).join("\n");
}
