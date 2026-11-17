import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { projectSchema } from "@/server/schemas";


export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const rows = await sql(`SELECT p.id, p.title, p.kind, p.visibility, p.updated_at, p.owner_id, u.display_name AS owner_name,
      CASE WHEN p.owner_id=$1 THEN 'owner' ELSE (SELECT role FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1) END AS role
    FROM projects p JOIN users u ON u.id=p.owner_id
    WHERE p.owner_id=$1 OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1)
    ORDER BY p.updated_at DESC`, [u.id]);
  return ok({ items: rows });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, projectSchema);
  const p = (await sql<{ id: string }>(`INSERT INTO projects(owner_id, title, description, objectives, problem, specs, kind, visibility, autonomy_level)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [u.id, b.title, b.description ?? null, b.objectives ?? null, b.problem ?? null, b.specs ?? null, b.kind, b.visibility, b.autonomy_level ?? null]))[0];
  await sql("INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,'owner')", [p.id, u.id]);
  await audit(u.id, "human", "project.create", { kind: "project", id: p.id }, { title: b.title });
  return ok({ id: p.id }, 201);
});
