import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";
import { audit } from "@/server/audit";
import { projectSchema } from "@/server/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const role = await requireProject(id, u, "viewer");
  const project = await sqlOne("SELECT p.*, u.display_name AS owner_name FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=$1", [id]);
  const [members, tasks, schematics, calcs, sims, devices, components] = await Promise.all([
    sql("SELECT m.user_id, m.role, u.display_name, u.email FROM project_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=$1 ORDER BY m.role", [id]),
    sql("SELECT t.*, u.display_name AS assignee_name FROM project_tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.project_id=$1 ORDER BY t.created_at", [id]),
    sql("SELECT id, lab, title, version, updated_at FROM schematics WHERE project_id=$1 ORDER BY updated_at DESC", [id]),
    sql("SELECT id, calc_kind, nature, initiated_by, missing, created_at FROM calc_runs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100", [id]),
    sql("SELECT id, engine, engine_version, kind, analysis, status, initiated_by, created_at FROM simulations WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100", [id]),
    sql("SELECT id, name, hardware, environment, last_seen FROM devices WHERE project_id=$1", [id]),
    sql("SELECT id, component_id, name, qty, unit_price, currency, supplier, note FROM project_components WHERE project_id=$1 ORDER BY created_at", [id]),
  ]);
  return ok({ project, role, members, tasks, schematics, calcs, sims, devices, components });
});

export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "editor");
  const b = await readInput(req, projectSchema.partial());
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(b)) { if (v !== undefined) { vals.push(v); sets.push(`${k}=$${vals.length}`); } }
  if (sets.length) { vals.push(id); await sql(`UPDATE projects SET ${sets.join(", ")}, updated_at=now() WHERE id=$${vals.length}`, vals); }
  await audit(u.id, "human", "project.update", { kind: "project", id }, { fields: Object.keys(b) });
  return ok({ ok: true });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "owner");
  await audit(u.id, "human", "project.delete", { kind: "project", id });
  await sql("DELETE FROM projects WHERE id=$1", [id]);
  return ok({ ok: true });
});
