/**
 * Aláji IA — analyse déterministe d'une demande et vérification des résultats (fonctions pures, testées).
 * Utilisées dans les deux modes (fournisseur d'IA configuré ou mode sans clé) : l'orientation vers les agents et
 * le contrôle des résultats ne dépendent pas d'un modèle de langage.
 */
import { AGENTS } from "./agents";

export type ProjectType = "memoire_technicien" | "projet_bts" | "projet_ingenieur" | "recherche" | "fin_formation" | "startup" | null;
export type Intent = "calcul" | "conception" | "simulation" | "rapport" | "explication" | "suivi" | "composants" | "donnees" | "commande";

const TYPES: [Exclude<ProjectType, null>, RegExp][] = [
  ["startup", /start-?up|prototype innovant|incubat|lev[ée]e de fonds|business plan|pitch/i],
  ["recherche", /recherche et d[ée]veloppement|\bR&D\b|th[èe]se|doctorat|article scientifique|publication/i],
  ["projet_ingenieur", /ing[ée]nieur|master|projet de fin d'[ée]tudes d'ing|\bPFE\b/i],
  ["projet_bts", /\bBTS\b|DUT|licence pro|technicien sup[ée]rieur|\bDTS\b/i],
  ["memoire_technicien", /m[ée]moire|technicien|\bBT\b|\bCAP\b|lyc[ée]e technique/i],
  ["fin_formation", /fin de formation|stage de fin|soutenance/i],
];
const INTENTS: [Intent, RegExp][] = [
  ["rapport", /rapport|report|compte rendu|synth[èe]se|document|m[ée]moire r[ée]dig/i],
  ["suivi", /suivi|avancement|progress|t[âa]ches? (en cours|restantes)|o[ùu] en est/i],
  ["calcul", /calcul|dimensionn|sizing|combien|section|puissance|couple|chute de tension|\b[A-Za-z]{1,8}\s*=\s*-?\d/i],
  ["simulation", /simul|spice|transitoire|r[ée]ponse|courbe/i],
  ["conception", /concevoir|conception|design|sch[ée]ma|architecture|plan [ée]lectrique|câblage|cablage/i],
  ["composants", /composant|component|r[ée]f[ée]rence|choisir (un|une)|quel(le)? (capteur|carte|module)/i],
  ["donnees", /nasa|m[ée]t[ée]o|weather|satellite|irradi|climat|mesure|capteur.*valeur/i],
  ["commande", /allume|[ée]teins|d[ée]marre|arr[êe]te|ouvre la vanne|commande|pilote/i],
  ["explication", /explique|comment fonctionne|pourquoi|qu'est-ce|what is|how does|d[ée]finition/i],
];

export interface RequestAnalysis { disciplines: { key: string; name: string }[]; projectType: ProjectType; intents: Intent[] }

export function analyseRequest(question: string): RequestAnalysis {
  const disciplines = AGENTS.filter((a) => a.key !== "verifier" && a.keywords.test(question)).map((a) => ({ key: a.key, name: a.name }));
  return {
    disciplines,
    projectType: TYPES.find(([, re]) => re.test(question))?.[0] ?? null,
    intents: INTENTS.filter(([, re]) => re.test(question)).map(([k]) => k),
  };
}

export const PROJECT_TYPE_LABEL: Record<Exclude<ProjectType, null>, string> = {
  memoire_technicien: "Mémoire de fin d'études de technicien", projet_bts: "Projet de technicien supérieur (BTS, DUT, DTS)", projet_ingenieur: "Projet d'ingénieur",
  recherche: "Projet de recherche et développement", fin_formation: "Projet de fin de formation", startup: "Projet de start-up / prototype innovant",
};
export const INTENT_LABEL: Record<Intent, string> = {
  calcul: "calcul / dimensionnement", conception: "conception", simulation: "simulation", rapport: "rapport ou document", explication: "explication",
  suivi: "suivi de projet", composants: "choix de composants", donnees: "données (NASA, météo, capteurs)", commande: "commande d'équipement",
};

/** Laboratoires et espaces à ouvrir selon la discipline (liens réels de la plateforme). */
export const DISCIPLINE_LINKS: Record<string, { label: string; href: string }[]> = {
  electrical: [{ label: "Electrical Lab", href: "/lab/electrical" }], electronics: [{ label: "Electronics Lab (schéma + ngspice)", href: "/lab/electronics" }],
  solar: [{ label: "Solar Energy Lab", href: "/lab/solar" }], iot: [{ label: "IoT & Embedded Lab", href: "/lab/iot" }, { label: "IoT Gateway", href: "/iot" }],
  robotics: [{ label: "Mechanical Lab", href: "/lab/mechanical" }], drone: [{ label: "Drone Command Center", href: "/drones" }],
  mechanical: [{ label: "Mechanical Lab", href: "/lab/mechanical" }], refrigeration: [{ label: "Refrigeration & HVAC Lab", href: "/lab/refrigeration" }],
  network: [{ label: "Computer & Network Lab", href: "/lab/network" }], cyber: [{ label: "Computer & Network Lab", href: "/lab/network" }],
  gis: [{ label: "Earth & Space", href: "/earth" }], research: [{ label: "Projets", href: "/projects" }], tutor: [{ label: "Academy", href: "/academy" }],
  startup: [{ label: "Startups", href: "/startups" }, { label: "Marketplace", href: "/marketplace" }], talent: [{ label: "Carrières", href: "/careers" }],
  software: [{ label: "IoT & Embedded Lab", href: "/lab/iot" }],
  industrial: [{ label: "Automatisme et informatique industrielle (Ladder, Grafcet, Modbus)", href: "/lab/automatisme" }],
};

// ---------------------------------------------------------------- Vérification
export interface VerifiableStep { tool: string; status: string; error: string | null; output?: unknown }
export interface Verification { ok: boolean; checked: number; issues: string[] }

type CalcLike = { outputs?: Record<string, { value: unknown; unit?: string; label?: string }>; missing?: string[]; warnings?: string[] };

/** Contrôle : étapes non exécutées, paramètres manquants, valeurs non finies, unités absentes, mesures simulées. */
export function verifySteps(steps: VerifiableStep[]): Verification {
  const issues: string[] = [];
  let checked = 0;
  for (const s of steps) {
    if (s.tool === "verify_results") continue;
    checked++;
    if (s.status === "awaiting_approval") { issues.push(`${s.tool} : NON exécuté — en attente d'approbation humaine.`); continue; }
    if (s.status !== "done") { issues.push(`${s.tool} : NON exécuté (${s.status}) — ${s.error ?? "raison inconnue"}.`); continue; }
    const o = s.output as { result?: CalcLike } & CalcLike & { status?: string; errors?: unknown[] } | null | undefined;
    const r: CalcLike | undefined = o?.result ?? (o && "outputs" in o ? o : undefined);
    if (r) {
      for (const m of r.missing ?? []) issues.push(`${s.tool} : paramètre manquant — ${m}.`);
      for (const [k, v] of Object.entries(r.outputs ?? {})) {
        if (typeof v.value === "number" && !Number.isFinite(v.value)) issues.push(`${s.tool} : valeur non finie pour ${v.label ?? k}.`);
        if (v.unit === undefined) issues.push(`${s.tool} : unité absente pour ${v.label ?? k}.`);
      }
    }
    if (o && Array.isArray(o.errors) && o.errors.length) issues.push(`${s.tool} : ${o.errors.length} erreur(s) signalée(s) par le moteur.`);
    if (Array.isArray(o) && o.some((x) => (x as { quality?: string })?.quality === "simulated")) issues.push(`${s.tool} : contient des mesures SIMULÉES (à ne pas présenter comme réelles).`);
  }
  return { ok: issues.length === 0, checked, issues };
}

export function verificationText(v: Verification): string {
  if (!v.checked) return "";
  return `\n\n**Vérification (agent vérificateur)** — ${v.checked} étape(s) contrôlée(s) : ${v.ok ? "aucune anomalie détectée (unités présentes, aucun paramètre manquant)." : `\n${v.issues.map((i) => `- ${i}`).join("\n")}`}`;
}

// ---------------------------------------------------------------- Rapport
type Rep = {
  project: { title: string; kind: string; level?: string | null; description: string | null; problem: string | null; objectives: string | null; specs: string | null;
    methodology?: string | null; architecture?: string | null; programming?: string | null; tests?: string | null; results?: string | null; conclusion?: string | null; owner_name?: string };
  tasks: { title: string; status: string; due_date: string | null }[];
  calcs: { calc_kind: string; outputs: CalcLike; missing: string[]; created_at: string }[];
  sims: { engine_version: string | null; analysis: unknown; status: string; created_at: string }[];
  measures: { device: string; metric: string; unit: string | null; n: number; min: number; max: number; avg: number }[];
  components: { name: string; qty: number; unit_price: number | null; currency: string; note: string | null }[];
};

const d = (s: string) => new Date(s).toLocaleDateString("fr-FR");

/** Rapport technique en Markdown, à partir des seules données enregistrées (aucun contenu inventé). */
export function projectReportMarkdown(r: Rep, generatedAt = new Date()): string {
  const p = r.project;
  const sec = (t: string, body: string) => `\n## ${t}\n\n${body.trim() || "_Non renseigné._"}\n`;
  const done = r.tasks.filter((t) => t.status === "done").length;
  return [
    `# ${p.title}`,
    p.level && p.level in PROJECT_TYPE_LABEL ? `**${PROJECT_TYPE_LABEL[p.level as Exclude<ProjectType, null>]}**` : "",
    `_Rapport généré le ${generatedAt.toLocaleString("fr-FR")} par Aláji IA à partir des données enregistrées du projet (type : ${p.kind}${p.owner_name ? ` · responsable : ${p.owner_name}` : ""}). Aucun contenu n'est inventé : les sections vides sont à compléter._`,
    sec("1. Contexte et description", p.description ?? ""),
    sec("2. Problématique", p.problem ?? ""),
    sec("3. Objectifs", p.objectives ?? ""),
    sec("4. Cahier des charges", p.specs ?? ""),
    sec("5. Méthodologie", p.methodology ?? ""),
    sec("6. Architecture matérielle et logicielle", p.architecture ?? ""),
    sec("7. Liste des composants", r.components.map((c) => `- ${c.qty} × ${c.name}${c.note ? ` — ${c.note}` : ""}`).join("\n")),
    sec("8. Budget prévisionnel", budget(r.components)),
    sec("9. Calculs et dimensionnement (nature : calcul)", r.calcs.map((c) => `- **${c.calc_kind}** (${d(c.created_at)}) : ${Object.values(c.outputs?.outputs ?? {}).map((o) => `${o.label} = ${o.value} ${o.unit ?? ""}`).join(" ; ") || "aucun résultat"}${c.missing?.length ? ` — paramètres manquants : ${c.missing.join(", ")}` : ""}`).join("\n")),
    sec("10. Programmation et configuration", p.programming ?? ""),
    sec("11. Simulations (nature : simulation)", r.sims.map((s) => `- ${s.engine_version ?? "moteur"} · ${JSON.stringify(s.analysis)} · ${s.status} (${d(s.created_at)})`).join("\n")),
    sec("12. Tests", p.tests ?? ""),
    sec("13. Mesures (nature : mesure, qualité valide)", r.measures.map((m) => `- ${m.device} · ${m.metric} : ${m.n} valeurs, min ${m.min}, moy ${Number(m.avg).toFixed(2)}, max ${m.max} ${m.unit ?? ""}`).join("\n")),
    sec("14. Planning et avancement", r.tasks.length ? `${done}/${r.tasks.length} tâche(s) terminée(s).\n\n${r.tasks.map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title}${t.due_date ? ` (échéance ${t.due_date})` : ""}`).join("\n")}` : ""),
    sec("15. Résultats", p.results ?? ""),
    sec("16. Conclusion et perspectives", p.conclusion ?? ""),
  ].join("\n");
}

/** Budget : total par devise ; une ligne sans prix est signalée, jamais estimée. */
export function budget(items: { name: string; qty: number; unit_price: number | null; currency: string }[]): string {
  if (!items.length) return "";
  const totals = new Map<string, number>();
  const unpriced: string[] = [];
  const lines = items.map((c) => {
    if (c.unit_price == null) { unpriced.push(c.name); return `| ${c.name} | ${c.qty} | prix à saisir | — |`; }
    const t = Number(c.qty) * Number(c.unit_price);
    totals.set(c.currency, (totals.get(c.currency) ?? 0) + t);
    return `| ${c.name} | ${c.qty} | ${c.unit_price} ${c.currency} | ${t} ${c.currency} |`;
  });
  return ["| Article | Qté | Prix unitaire | Total |", "|---|---|---|---|", ...lines, "",
    `**Total** : ${[...totals].map(([cur, v]) => `${v} ${cur}`).join(" + ") || "—"}${unpriced.length ? ` — ${unpriced.length} article(s) sans prix : total incomplet.` : ""}`].join("\n");
}

/** Support de présentation (diapositives séparées par « --- », compatible Marp) à partir des données du projet. */
export function projectSlidesMarkdown(r: Rep): string {
  const p = r.project;
  const firstLines = (s: string | null | undefined, n = 6) => (s ?? "").split("\n").filter((l) => l.trim()).slice(0, n).join("\n") || "_À compléter._";
  const done = r.tasks.filter((t) => t.status === "done").length;
  const slides = [
    `# ${p.title}\n\n${p.level && p.level in PROJECT_TYPE_LABEL ? PROJECT_TYPE_LABEL[p.level as Exclude<ProjectType, null>] : ""}${p.owner_name ? `\n\n${p.owner_name}` : ""}`,
    `## Contexte et problématique\n\n${firstLines(p.description, 3)}\n\n${firstLines(p.problem, 3)}`,
    `## Objectifs\n\n${firstLines(p.objectives)}`,
    `## Méthodologie\n\n${firstLines(p.methodology)}`,
    `## Architecture\n\n${firstLines(p.architecture)}`,
    `## Composants et budget\n\n${r.components.slice(0, 10).map((c) => `- ${c.qty} × ${c.name}`).join("\n") || "_À compléter._"}\n\n${budget(r.components).split("\n").at(-1) ?? ""}`,
    `## Calculs et simulations\n\n${r.calcs.slice(0, 6).map((c) => `- ${c.calc_kind} : ${Object.values(c.outputs?.outputs ?? {}).slice(0, 2).map((o) => `${o.label} = ${o.value} ${o.unit ?? ""}`).join(" ; ")}`).join("\n") || "_Aucun calcul enregistré._"}\n\n${r.sims.length} simulation(s) enregistrée(s).`,
    `## Résultats\n\n${firstLines(p.results)}`,
    `## Avancement\n\n${done}/${r.tasks.length} tâche(s) terminée(s).`,
    `## Conclusion et perspectives\n\n${firstLines(p.conclusion)}`,
  ];
  return `---\nmarp: true\n---\n\n${slides.join("\n\n---\n\n")}\n`;
}
