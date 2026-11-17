/**
 * Niveaux d'autonomie de l'IA (cahier des charges §6) et règles du moteur de gouvernance (fonctions pures, testées).
 * Le niveau effectif est le MINIMUM des niveaux accordés (utilisateur, projet, appareil). Aucun niveau ne permet
 * de modifier des limites matérielles, de s'accorder des droits ni d'exécuter une commande physique sans validation
 * humaine ou préautorisation écrite.
 */
export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** Effet d'un outil → niveau minimal requis pour que l'IA l'exécute sans approbation. */
export type ToolEffect = "read" | "compute" | "write" | "physical";
export const EFFECT_LEVEL: Record<ToolEffect, Level> = { read: 1, compute: 2, write: 3, physical: 4 };

export function effectiveLevel(...levels: (number | null | undefined)[]): Level {
  const v = levels.filter((x): x is number => typeof x === "number");
  const m = v.length ? Math.min(...v) : 1;
  return Math.max(1, Math.min(5, Math.floor(m))) as Level;
}

export type Decision = { kind: "execute" } | { kind: "approval"; reason: string } | { kind: "blocked"; reason: string };

/**
 * Décision du moteur de gouvernance pour un appel d'outil par l'IA.
 * - coupe-circuit actif ou agent désactivé → bloqué ;
 * - outil hors de la liste blanche de l'agent → bloqué ;
 * - effet physique → toujours une PROPOSITION (l'outil lui-même ne fait que proposer ; confirmation humaine ensuite) ;
 * - niveau insuffisant → approbation humaine requise.
 */
export function decide(opts: { effect: ToolEffect; level: Level; aiEnabled: boolean; agentEnabled: boolean; toolAllowed: boolean }): Decision {
  if (!opts.aiEnabled) return { kind: "blocked", reason: "Arrêt global de l'IA activé dans le Command Center" };
  if (!opts.agentEnabled) return { kind: "blocked", reason: "Agent désactivé dans le Command Center" };
  if (!opts.toolAllowed) return { kind: "blocked", reason: "Outil hors de la liste blanche de l'agent" };
  const need = EFFECT_LEVEL[opts.effect];
  if (opts.level < need) return { kind: "approval", reason: `Niveau d'autonomie ${opts.level} : l'action « ${opts.effect} » exige le niveau ${need} ou une approbation humaine` };
  return { kind: "execute" };
}
