import { ok, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

/** Rapport de projet : sections séparées par nature (calculé / simulé / mesuré), chaque élément avec sa source. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "viewer");
  const project = await sqlOne("SELECT p.*, u.display_name AS owner_name FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=$1", [id]);
  const calcs = await sql("SELECT calc_kind, inputs, outputs, missing, initiated_by, created_at FROM calc_runs WHERE project_id=$1 ORDER BY created_at", [id]);
  const sims = await sql("SELECT engine, engine_version, kind, analysis, status, input_hash, errors, initiated_by, created_at, input FROM simulations WHERE project_id=$1 ORDER BY created_at", [id]);
  const measures = await sql(`SELECT d.name AS device, d.environment, m.metric, m.unit, COUNT(*)::int AS n, MIN(m.value) AS min, MAX(m.value) AS max, AVG(m.value) AS avg, MIN(m.ts) AS first, MAX(m.ts) AS last
    FROM measurements m JOIN devices d ON d.id=m.device_id WHERE d.project_id=$1 AND m.quality='valid' GROUP BY d.name, d.environment, m.metric, m.unit ORDER BY d.name, m.metric`, [id]);
  const simulated = await sqlOne<{ n: number }>("SELECT COUNT(*)::int n FROM measurements m JOIN devices d ON d.id=m.device_id WHERE d.project_id=$1 AND m.quality='simulated'", [id]);
  const tasks = await sql("SELECT title, status, due_date FROM project_tasks WHERE project_id=$1 ORDER BY created_at", [id]);
  return ok({ generated_at: new Date().toISOString(), project, calcs, sims, measures, simulatedReadings: simulated?.n ?? 0, tasks });
});
