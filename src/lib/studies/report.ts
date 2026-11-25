/** Rapport d'étude : Markdown (affichage, Word, PDF) et feuilles Excel. Les valeurs sont celles du moteur. */
import type { Input, Software, StudyResult } from "./types";

const fmt = (v: number | string, unit?: string) => `${typeof v === "number" ? v.toLocaleString("fr-FR") : v}${unit ? ` ${unit}` : ""}`;

export function inputLines(sw: Software, input: Input): string[][] {
  const out: string[][] = [];
  for (const sec of sw.sections) for (const f of sec.fields) {
    const v = input[f.key];
    if (f.type === "rows") {
      const list = Array.isArray(v) ? v as Record<string, unknown>[] : [];
      list.forEach((r, i) => out.push([`${f.label} ${i + 1}`, (f.cols ?? []).map((c) => `${c.label} : ${r[c.key] ?? "—"}${c.unit && r[c.key] != null && r[c.key] !== "" ? ` ${c.unit}` : ""}`).join(" ; ")]));
    } else if (f.type === "months") {
      const list = Array.isArray(v) ? v : [];
      out.push([`${f.label}${f.unit ? ` (${f.unit})` : ""}`, list.length ? list.map((x, i) => `M${i + 1} : ${x ?? "—"}`).join(" ; ") : "— (non saisi)"]);
    } else out.push([f.label, v == null || v === "" ? "— (non saisi)" : `${f.options?.find((o) => o.v === v)?.l ?? v}${f.unit ? ` ${f.unit}` : ""}`]);
  }
  return out;
}

export function studyMarkdown(sw: Software, title: string, input: Input, r: StudyResult): string {
  const L: string[] = [`# ${title}`, "", `Logiciel : ${sw.title}`, `Nature : calcul (moteur testé de XAM-XAM LAB) — à faire vérifier par une personne compétente avant réalisation.`, ""];
  L.push("## 1. Données saisies", "", "| Donnée | Valeur |", "|---|---|", ...inputLines(sw, input).map(([a, b]) => `| ${a} | ${b.replace(/\|/g, "/")} |`), "");
  if (r.missing.length) L.push("## Données manquantes (calculs non effectués)", "", ...r.missing.map((m) => `- ${m}`), "");
  if (r.summary.length) L.push("## 2. Synthèse", "", ...r.summary.map((s) => `- **${s.label}** : ${fmt(s.value, s.unit)}`), "");
  if (r.steps.length) {
    L.push("## 3. Calculs détaillés", "");
    for (const s of r.steps) {
      L.push(`### ${s.title}${s.ok === false ? " — ⚠ non conforme" : ""}`, "", "| Grandeur | Valeur | Méthode |", "|---|---|---|", ...s.lines.map((l) => `| ${l.label} | ${fmt(l.value, l.unit)} | ${l.formula ?? ""} |`), "");
      if (s.note) L.push(s.note, "");
    }
  }
  if (r.warnings.length) L.push("## Alertes", "", ...r.warnings.map((w) => `- ${w}`), "");
  if (r.bom.length) L.push("## 4. Nomenclature", "", "| Désignation | Quantité | Unité | Caractéristiques |", "|---|---|---|---|", ...r.bom.map((b) => `| ${b.name} | ${fmt(b.qty)} | ${b.unit} | ${b.spec} |`), "", "Prix : aucun prix n'est inventé. Les offres réelles sont consultables dans la boutique.", "");
  if (r.assumptions.length) L.push("## Hypothèses", "", ...r.assumptions.map((a) => `- ${a}`), "");
  if (r.references.length) L.push("## Références", "", ...r.references.map((a) => `- ${a}`), "");
  return L.join("\n");
}

export function studySheets(sw: Software, input: Input, r: StudyResult) {
  return [
    { name: "Données", rows: [["Donnée", "Valeur"], ...inputLines(sw, input)] },
    { name: "Calculs", rows: [["Étape", "Grandeur", "Valeur", "Unité", "Méthode"], ...r.steps.flatMap((s) => s.lines.map((l) => [s.title, l.label, String(l.value), l.unit ?? "", l.formula ?? ""]))] },
    { name: "Nomenclature", rows: [["Désignation", "Quantité", "Unité", "Caractéristiques"], ...r.bom.map((b) => [b.name, String(b.qty), b.unit, b.spec])] },
  ];
}
