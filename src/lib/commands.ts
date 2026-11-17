/**
 * Règles de sécurité des commandes d'équipements de XAM-XAM LAB (fonctions pures, testées).
 * - La durée maximale de chaque commande est fixée par le propriétaire de l'appareil (jamais de valeur par défaut).
 * - Un arrêt (« stop ») est toujours autorisé.
 * - Une commande confirmée non récupérée par l'appareil dans le délai expire (jamais exécutée en retard).
 * - « Exécutée » uniquement sur accusé de l'appareil.
 */
export const PICKUP_WINDOW_S = 300;
export const PROPOSAL_WINDOW_S = 1800;

export interface CommandCapability { action: string; label?: string; max_duration_s: number | null; requires_duration: boolean }
export interface DeviceForCommand {
  status: string; environment: "virtual" | "bench" | "real";
  capabilities: { commands?: CommandCapability[] };
}
export interface Actor { clearances: string[]; canConfirm: boolean }

export const STOP_ACTIONS = new Set(["stop", "off", "estop"]);

export function commandBlockers(d: DeviceForCommand, action: string, durationS: number | null | undefined): string[] {
  const out: string[] = [];
  if (d.status !== "active") out.push("appareil désactivé");
  if (STOP_ACTIONS.has(action)) return out;
  const cap = (d.capabilities.commands ?? []).find((c) => c.action === action);
  if (!cap) { out.push(`commande « ${action} » non déclarée dans les capacités de l'appareil`); return out; }
  if (cap.requires_duration) {
    if (cap.max_duration_s == null) out.push("durée maximale non fixée par le propriétaire de l'appareil");
    if (durationS == null || !Number.isFinite(durationS) || durationS <= 0) out.push("durée de fonctionnement manquante");
    else if (cap.max_duration_s != null && durationS > cap.max_duration_s) out.push(`durée demandée (${durationS} s) supérieure au maximum fixé (${cap.max_duration_s} s)`);
  }
  return out;
}

/** Qui peut confirmer : profil autorisé + habilitation selon l'environnement (banc / réel). Arrêt : toujours. */
export function confirmBlockers(d: DeviceForCommand, action: string, a: Actor): string[] {
  if (STOP_ACTIONS.has(action)) return [];
  const out: string[] = [];
  if (!a.canConfirm) out.push("votre profil ne permet pas de confirmer une commande d'équipement");
  if (d.environment === "real" && !a.clearances.includes("operation_reelle")) out.push("habilitation « opération réelle » requise");
  if (d.environment === "bench" && !a.clearances.includes("banc_essai") && !a.clearances.includes("operation_reelle")) out.push("habilitation « banc d'essai » requise");
  return out;
}

export const ageS = (iso: string | Date | null | undefined, now = Date.now()) => (iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)) : null);

/** Fraîcheur d'une mesure : « live » (≤ maxAge), « stale », « none ». */
export function freshness(iso: string | Date | null | undefined, maxAgeS: number, now = Date.now()): "live" | "stale" | "none" {
  const a = ageS(iso, now);
  if (a == null) return "none";
  return a <= maxAgeS ? "live" : "stale";
}
