/** Études de dimensionnement : exécution du moteur (données serveur résolues ici), enregistrement, accès. */
import { sql, sqlOne } from "./db";
import { ApiFailure } from "./api";
import type { User } from "./api";
import { softwareByKey } from "@/lib/studies";
import type { Input, StudyContext, StudyResult } from "@/lib/studies/types";

export async function contextFor(needs: string[] | undefined, tableId: string | null): Promise<StudyContext> {
  const ctx: StudyContext = {};
  if (needs?.includes("ampacity_table")) {
    const t = tableId ? await sqlOne<{ standard: string; table_ref: string; description: string; data: { rows: { s: number; iz: number }[] } }>("SELECT standard, table_ref, description, data FROM normative_tables WHERE id=$1", [tableId]) : null;
    ctx.ampacity = t ? { reference: `${t.standard} — ${t.table_ref} (${t.description})`, rows: t.data.rows } : null;
  }
  return ctx;
}

export async function runStudy(software: string, input: Input, tableId: string | null): Promise<StudyResult> {
  const sw = softwareByKey(software);
  if (!sw) throw new ApiFailure(404, "Logiciel inconnu", "err.notFound");
  return sw.run(input, await contextFor(sw.needs, tableId));
}

export async function myStudy(id: string, u: User) {
  const s = await sqlOne<{ id: string; user_id: string; project_id: string | null; software: string; title: string; inputs: Input; result: StudyResult; table_id: string | null; created_at: string; updated_at: string }>("SELECT * FROM studies WHERE id=$1", [id]);
  if (!s || s.user_id !== u.id) throw new ApiFailure(404, "Étude introuvable", "err.notFound");
  return s;
}
export const listStudies = (u: User) => sql("SELECT id, software, title, project_id, updated_at, (result->>'ok')::boolean AS ok FROM studies WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200", [u.id]);

/** Résumé d'une étude pour Aláji IA (contexte autorisé : l'étude appartient à l'utilisateur). */
export async function studyBrief(id: string, u: User): Promise<{ title: string; brief: string }> {
  const s = await myStudy(id, u);
  const sw = softwareByKey(s.software);
  const r = s.result;
  const L = [`Étude « ${s.title} » (${sw?.title.split(":")[0] ?? s.software}) — résultats du moteur de calcul :`];
  if (r.summary?.length) L.push(...r.summary.map((x) => `• ${x.label} : ${x.value}${x.unit ? ` ${x.unit}` : ""}`));
  const bad = (r.steps ?? []).filter((x) => x.ok === false).map((x) => x.title);
  if (bad.length) L.push(`Points non conformes : ${bad.join(" ; ")}.`);
  if (r.missing?.length) L.push(`Données manquantes (calculs non faits) : ${r.missing.slice(0, 8).join(" ; ")}.`);
  if (r.warnings?.length) L.push(`Alertes : ${r.warnings.slice(0, 6).join(" ; ")}.`);
  if (r.assumptions?.length) L.push(`Hypothèses : ${r.assumptions.slice(0, 4).join(" ; ")}.`);
  L.push("À faire vérifier par une personne compétente avant réalisation.");
  return { title: `étude « ${s.title} »`, brief: L.join("\n") };
}
