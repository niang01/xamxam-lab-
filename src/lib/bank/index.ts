/** Banque de projets : index, recherche et filtres (données statiques versionnées avec le code). */
import { IOT_PROJECTS } from "./iot";
import { FILIERE_PROJECTS } from "./filieres";
import { SECTOR_PROJECTS, SECTORS } from "./sectors";
export { SECTORS } from "./sectors";
import type { BankProject } from "./types";

export const BANK: BankProject[] = [...IOT_PROJECTS, ...SECTOR_PROJECTS, ...FILIERE_PROJECTS];
export const bankById = (id: string) => BANK.find((p) => p.id === id) ?? null;

export function searchBank(f: { q?: string; filiere?: string; level?: string; iot?: boolean; component?: string; sector?: string }): BankProject[] {
  const q = (f.q ?? "").toLowerCase().trim();
  return BANK.filter((p) => (!f.filiere || p.filiere === f.filiere) && (!f.sector || p.sector === f.sector) && (!f.level || p.level === f.level) && (f.iot === undefined || p.iot === f.iot)
    && (!f.component || p.components.some(([n]) => n === f.component))
    && (!q || `${p.title} ${p.domain} ${p.problem} ${p.theme} ${p.components.map(([n]) => n).join(" ")}`.toLowerCase().includes(q)));
}

/** Rapport d'inventaire : nombre de projets par filière, par niveau, IoT / non IoT. */
export function bankInventory() {
  const by = <K extends string>(k: (p: BankProject) => K) => BANK.reduce((m, p) => ({ ...m, [k(p)]: (m[k(p)] ?? 0) + 1 }), {} as Record<K, number>);
  return { total: BANK.length, iot: BANK.filter((p) => p.iot).length, byFiliere: by((p) => p.filiere), byLevel: by((p) => p.level), bySector: by((p) => p.sector ?? "—"), sectors: SECTORS.length, withCode: BANK.filter((p) => p.code).length, withSchematic: BANK.filter((p) => p.schematic).length };
}

/** Projet de la banque → contenu d'un projet personnel (sections, nomenclature, tâches). */
export function bankToProject(p: BankProject) {
  const kind = p.level === "startup" ? "startup" : p.level === "recherche" ? "research" : p.level === "ingenieur" ? "engineering" : "thesis";
  const level = ({ startup: "startup", recherche: "recherche", ingenieur: "projet_ingenieur", technicien: "projet_bts" } as Record<string, string>)[p.level] ?? "fin_formation";
  return {
    title: p.title, kind, level,
    description: `${p.domain} — ${p.principle}`,
    problem: p.problem,
    objectives: p.objectives.map((o) => `- ${o}`).join("\n"),
    specs: p.specs.map((s) => `- ${s}`).join("\n"),
    methodology: p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    architecture: p.principle,
    programming: p.code ? `Programme d'exemple : « ${p.code} » (banque de projets), à adapter et compiler.` : null,
    tests: [...p.tests, ...p.faults.map(([s, c, r]) => `Panne possible — ${s} : ${c} → ${r}`)].map((x) => `- ${x}`).join("\n"),
    components: p.components, tasks: p.steps,
  };
}
