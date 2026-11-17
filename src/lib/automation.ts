/**
 * Scénarios d'automatisation (AI Automation Studio) — évaluation déterministe (pas par le modèle d'IA).
 * Structure obligatoire : déclencheur, condition, action, temporisation, vérification, notification, journalisation, arrêt.
 * Un seuil n'est jamais imposé par défaut ; une règle sans donnée fraîche n'est pas déclenchée.
 */
import { z } from "zod";

export const automationSpec = z.object({
  trigger: z.object({ device_id: z.string().uuid(), metric: z.string().min(1).max(60) }),
  condition: z.object({ op: z.enum(["<", ">", "<=", ">="]), threshold: z.number().finite(), max_age_s: z.number().int().min(10).max(86400) }),
  action: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("notify") }),
    z.object({ kind: z.literal("command"), device_id: z.string().uuid(), action: z.string().min(1).max(40), duration_s: z.number().int().positive().nullable() }),
  ]),
  cooldown_s: z.number().int().min(60).max(7 * 86400),          // temporisation entre deux déclenchements
  verify: z.object({ metric: z.string().max(60).nullable(), within_s: z.number().int().min(10).max(86400).nullable() }), // vérification du résultat
  stop: z.object({ max_runs_per_day: z.number().int().min(1).max(100) }), // arrêt : plafond journalier
});
export type AutomationSpec = z.infer<typeof automationSpec>;

export interface Reading { ts: string; value: number; quality: string }

export function conditionMet(op: AutomationSpec["condition"]["op"], v: number, t: number) {
  return op === "<" ? v < t : op === ">" ? v > t : op === "<=" ? v <= t : v >= t;
}

export type Evaluation = { fire: true; reading: Reading } | { fire: false; reason: string };

export function evaluate(spec: AutomationSpec, latest: Reading | null, lastFiredAt: string | null, runsToday: number, now = Date.now()): Evaluation {
  if (!latest) return { fire: false, reason: "aucune mesure" };
  if (latest.quality === "simulated") return { fire: false, reason: "mesure simulée : jamais utilisée pour déclencher une action réelle" };
  if (latest.quality !== "valid") return { fire: false, reason: "mesure suspecte" };
  const age = (now - new Date(latest.ts).getTime()) / 1000;
  if (age > spec.condition.max_age_s) return { fire: false, reason: `mesure trop ancienne (${Math.round(age)} s)` };
  if (!conditionMet(spec.condition.op, latest.value, spec.condition.threshold)) return { fire: false, reason: "condition non remplie" };
  if (lastFiredAt && (now - new Date(lastFiredAt).getTime()) / 1000 < spec.cooldown_s) return { fire: false, reason: "temporisation en cours" };
  if (runsToday >= spec.stop.max_runs_per_day) return { fire: false, reason: "plafond journalier atteint" };
  return { fire: true, reading: latest };
}

/** Essai à blanc : rejoue un historique (ordre chronologique) et liste ce qui aurait été déclenché. */
export function dryRun(spec: AutomationSpec, history: Reading[]): { ts: string; value: number }[] {
  const fired: { ts: string; value: number }[] = [];
  let last: string | null = null;
  const perDay = new Map<string, number>();
  for (const r of [...history].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const t = new Date(r.ts).getTime();
    const day = r.ts.slice(0, 10);
    const e = evaluate(spec, r, last, perDay.get(day) ?? 0, t);
    if (e.fire) { fired.push({ ts: r.ts, value: r.value }); last = r.ts; perDay.set(day, (perDay.get(day) ?? 0) + 1); }
  }
  return fired;
}
