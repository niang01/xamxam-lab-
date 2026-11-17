import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "editor");
  const b = await readInput(req, z.object({ title: z.string().trim().min(1).max(300), assignee_id: z.string().uuid().nullable().optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }));
  const t = (await sql<{ id: string }>("INSERT INTO project_tasks(project_id, title, assignee_id, due_date, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id", [id, b.title, b.assignee_id ?? null, b.due_date ?? null, u.id]))[0];
  await sql("UPDATE projects SET updated_at=now() WHERE id=$1", [id]);
  return ok({ id: t.id }, 201);
});
