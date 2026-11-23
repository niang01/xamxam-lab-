/** Données d'un projet pour son rapport (route /api/projects/[id]/report et outil d'Aláji IA). */
import { sql, sqlOne } from "./db";

export async function projectReportData(id: string) {
  const project = await sqlOne<{ title: string; kind: string; level: string | null; description: string | null; problem: string | null; objectives: string | null; specs: string | null;
    methodology: string | null; architecture: string | null; programming: string | null; tests: string | null; results: string | null; conclusion: string | null; owner_name: string }>(
    "SELECT p.*, u.display_name AS owner_name FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=$1", [id]);
  if (!project) throw new Error("Projet introuvable");
  return {
    project,
    tasks: await sql<{ title: string; status: string; due_date: string | null }>("SELECT title, status, due_date FROM project_tasks WHERE project_id=$1 ORDER BY created_at", [id]),
    calcs: await sql<{ calc_kind: string; outputs: never; missing: string[]; created_at: string }>("SELECT calc_kind, outputs, missing, created_at FROM calc_runs WHERE project_id=$1 ORDER BY created_at", [id]),
    sims: await sql<{ engine_version: string | null; analysis: unknown; status: string; created_at: string }>("SELECT engine_version, analysis, status, created_at FROM simulations WHERE project_id=$1 ORDER BY created_at", [id]),
    measures: await sql<{ device: string; metric: string; unit: string | null; n: number; min: number; max: number; avg: number }>(`SELECT d.name AS device, m.metric, m.unit, COUNT(*)::int AS n, MIN(m.value) AS min, MAX(m.value) AS max, AVG(m.value) AS avg
      FROM measurements m JOIN devices d ON d.id=m.device_id WHERE d.project_id=$1 AND m.quality='valid' GROUP BY d.name, m.metric, m.unit ORDER BY d.name, m.metric`, [id]),
    components: await sql<{ name: string; qty: number; unit_price: number | null; currency: string; note: string | null }>("SELECT name, qty, unit_price, currency, note FROM project_components WHERE project_id=$1 ORDER BY created_at", [id]),
  };
}
