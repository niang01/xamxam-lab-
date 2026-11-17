import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const t = await sqlOne<{ project_id: string }>("SELECT project_id FROM project_tasks WHERE id=$1", [id]);
  if (!t) throw new ApiFailure(404, "Tâche introuvable", "err.notFound");
  return t;
}

export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const t = await load(id);
  await requireProject(t.project_id, u, "editor");
  const b = await readInput(req, z.object({ status: z.enum(["todo", "doing", "done"]) }));
  await sql("UPDATE project_tasks SET status=$1 WHERE id=$2", [b.status, id]);
  return ok({ ok: true });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const t = await load(id);
  await requireProject(t.project_id, u, "editor");
  await sql("DELETE FROM project_tasks WHERE id=$1", [id]);
  return ok({ ok: true });
});
