/** Analyse d'un document extrait : exercices, données, calculs de la plateforme, contrôles, rapport. */
import { CALCS } from "../calc";
import { checkAnswers, crossChecks, planFor, splitExercises, steps, type CalcOutput, type Quantity } from "@/lib/docs/analyze";

export interface ExerciseReport {
  title: string; excerpt: string; questions: { label: string; text: string }[];
  extracted: Quantity[]; hypotheses: string[];
  calculation: { kind: string; description: string; reason: string; input: Record<string, unknown> } | null;
  result: CalcOutput | null; steps: string[]; checks: string[]; answers: ReturnType<typeof checkAnswers>;
  missing: string[]; humanReview: string[];
}
export interface DocReport { generatedAt: string; engine: string; exercises: ExerciseReport[]; tables: number; warnings: string[]; humanReview: string[] }

export const ENGINE = "Aláji IA — analyse déterministe v1 (registre de calculs testé)";

export function analyseText(text: string, tables: string[][][], warnings: string[] = []): DocReport {
  const blocks = splitExercises(text);
  const exercises: ExerciseReport[] = blocks.map((b) => {
    const plan = planFor(b);
    const hypotheses = b.data.filter((q) => q.hypothesis).map((q) => q.hypothesis!);
    let result: CalcOutput | null = null;
    const missing: string[] = [];
    if (plan) {
      if ("system" in plan.input && plan.input.system == null) { missing.push("régime monophasé ou triphasé (non indiqué dans l'énoncé)"); plan.input.system = undefined; }
      if (plan.kind === "voltage_drop" && plan.input.conductor == null) missing.push("nature de l'âme du câble (cuivre ou aluminium)");
      if (!missing.length) {
        const def = (CALCS as unknown as Record<string, { schema: { safeParse: (x: unknown) => { success: boolean; data?: unknown; error?: { issues: { path: PropertyKey[] }[] } } }; run: (x: unknown) => CalcOutput }>)[plan.kind];
        const parsed = def.schema.safeParse(plan.input);
        if (parsed.success) result = def.run(parsed.data);
        else missing.push(...parsed.error!.issues.map((i) => `${i.path.join(".")} (non trouvé dans l'énoncé)`));
      }
    }
    if (result) missing.push(...result.missing);
    const humanReview: string[] = [];
    if (!plan && b.questions.length) humanReview.push("Aucun calcul reconnu automatiquement pour ces questions : réponse à rédiger (ou fournisseur d'IA à configurer) et à faire valider.");
    if (hypotheses.length) humanReview.push("Des unités ont été interprétées : vérifier les hypothèses.");
    if (b.questions.some((q) => /schéma|dessine|représente|draw/i.test(q.text))) humanReview.push("Un schéma est demandé : utiliser « Générer un schéma » ou l'éditeur 2D, puis le faire valider.");
    return {
      title: b.title, excerpt: b.text.slice(0, 600), questions: b.questions, extracted: b.data, hypotheses,
      calculation: plan ? { kind: plan.kind, description: CALCS[plan.kind as keyof typeof CALCS].description, reason: plan.reason, input: plan.input } : null,
      result, steps: plan && result ? steps(b, plan, result) : [], checks: crossChecks(b, plan, result), answers: checkAnswers(b.answers, result),
      missing, humanReview,
    };
  });
  const humanReview = ["Résultats produits par des calculs déterministes testés ; ils dépendent de la lecture correcte de l'énoncé : relire les données extraites avant toute utilisation (examen, installation réelle)."];
  if (warnings.some((w) => /OCR/.test(w))) humanReview.push("Texte issu d'une reconnaissance optique : vérifier chaque chiffre et chaque unité.");
  return { generatedAt: new Date().toISOString(), engine: ENGINE, exercises, tables: tables.length, warnings, humanReview };
}

/** Rapport lisible (Markdown) : extrait / hypothèses / calculs / contrôles / à valider. */
export function reportMarkdown(filename: string, r: DocReport, tables: string[][][]): string {
  const L: string[] = [`# Rapport d'analyse — ${filename}`, `${r.engine} · ${new Date(r.generatedAt).toLocaleString("fr-FR")}`, ""];
  if (r.warnings.length) L.push("## Avertissements de lecture", ...r.warnings.map((w) => `- ${w}`), "");
  r.exercises.forEach((e, i) => {
    L.push(`## ${i + 1}. ${e.title}`);
    if (e.questions.length) L.push("### Questions identifiées", ...e.questions.map((q) => `- ${q.label}) ${q.text}`));
    L.push("### Informations extraites du document", ...(e.extracted.length ? e.extracted.map((q) => `- ${q.raw}${q.dim !== "unknown" ? ` → ${q.si} (${q.dim})` : ""}`) : ["- Aucune donnée chiffrée reconnue"]));
    if (e.hypotheses.length) L.push("### Hypothèses (à confirmer)", ...e.hypotheses.map((h) => `- ${h}`));
    if (e.calculation) L.push("### Résolution (résultats calculés)", `- Calcul : ${e.calculation.description} — choisi car ${e.calculation.reason}`, ...e.steps.map((s) => `- ${s}`));
    if (e.missing.length) L.push("### Données manquantes (non inventées)", ...e.missing.map((m) => `- ${m}`));
    if (e.checks.length) L.push("### Contrôles", ...e.checks.map((c) => `- ${c}`));
    if (e.answers.length) L.push("### Correction des réponses du document", ...e.answers.map((a) => `- ${a.given} → ${a.verdict}${a.computed ? ` (calculé : ${a.computed}${a.deviationPct != null ? `, écart ${a.deviationPct} %` : ""})` : ""}`));
    if (e.humanReview.length) L.push("### À valider par une personne", ...e.humanReview.map((h) => `- ${h}`));
    L.push("");
  });
  if (tables.length) L.push(`## Tableaux extraits : ${tables.length} (voir l'export Excel)`, "");
  L.push("## Validation humaine", ...r.humanReview.map((h) => `- ${h}`));
  return L.join("\n");
}
