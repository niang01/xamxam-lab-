/** Mechanical & Mechatronics Lab — transmissions et motorisation (fonctions pures). */
import { result, round, need, type CalcResult } from "./result";

/** Couple à partir de la puissance et de la vitesse : C = P / ω, ω = 2π n / 60. */
export function torque(p: { powerW: number | null; rpm: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.powerW, "puissance P (W)"); need(missing, p.rpm, "vitesse n (tr/min)");
  if (missing.length) return result({ missing });
  const w = (2 * Math.PI * p.rpm!) / 60;
  return result({ outputs: { omega: { value: round(w), unit: "rad/s", label: "Vitesse angulaire ω" }, c: { value: round(p.powerW! / w), unit: "N·m", label: "Couple C" } }, formulas: ["ω = 2π n / 60", "C = P / ω"] });
}

/** Train d'engrenages simple (une ou plusieurs paires) : rapport, vitesse et couple de sortie avec rendement par étage. */
export function gearTrain(p: { stages: { z1: number; z2: number }[]; rpmIn: number | null; torqueIn: number | null; stageEfficiency: number | null }): CalcResult {
  const missing: string[] = [];
  if (!p.stages.length || p.stages.some((s) => !(s.z1 > 0 && s.z2 > 0))) missing.push("nombres de dents z1 (menante) et z2 (menée) de chaque étage");
  need(missing, p.rpmIn, "vitesse d'entrée (tr/min)"); need(missing, p.torqueIn, "couple d'entrée (N·m)"); need(missing, p.stageEfficiency, "rendement par étage (donnée constructeur)");
  if (missing.length) return result({ missing });
  const ratio = p.stages.reduce((a, s) => a * (s.z2 / s.z1), 1);
  const eta = p.stageEfficiency! ** p.stages.length;
  return result({
    outputs: { i: { value: round(ratio), unit: "", label: "Rapport de réduction i" }, rpmOut: { value: round(p.rpmIn! / ratio), unit: "tr/min", label: "Vitesse de sortie" }, torqueOut: { value: round(p.torqueIn! * ratio * eta), unit: "N·m", label: "Couple de sortie" }, eta: { value: round(eta), unit: "", label: "Rendement global" } },
    formulas: ["i = Π z2/z1", "n_s = n_e / i", "C_s = C_e × i × η^k"],
  });
}

/** Vérin pneumatique/hydraulique : F = p × A × η (poussée). */
export function cylinderForce(p: { pressureBar: number | null; boreMm: number | null; efficiency: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.pressureBar, "pression (bar)"); need(missing, p.boreMm, "alésage (mm)"); need(missing, p.efficiency, "rendement du vérin (constructeur)");
  if (missing.length) return result({ missing });
  const a = Math.PI * (p.boreMm! / 1000) ** 2 / 4;
  const f = p.pressureBar! * 1e5 * a * p.efficiency!;
  return result({ outputs: { a: { value: round(a * 1e4), unit: "cm²", label: "Section du piston" }, f: { value: round(f), unit: "N", label: "Force de poussée" } }, formulas: ["A = π D² / 4", "F = p × A × η"], references: ["1 bar = 10⁵ Pa"] });
}
