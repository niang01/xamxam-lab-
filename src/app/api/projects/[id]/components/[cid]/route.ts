import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { componentLine } from "@/server/schemas";

type Ctx = { params: Promise<{ id: string; cid: string }> };

export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx); const cid = await uuidParam(ctx, "cid");
  await requireProject(id, u, "editor");
  const b = await readInput(req, componentLine.partial());
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(b)) if (v !== undefined) { vals.push(v); sets.push(`${k}=$${vals.length}`); }
  if (!sets.length) return ok({ ok: true });
  vals.push(cid, id);
  const r = await sql(`UPDATE project_components SET ${sets.join(", ")} WHERE id=$${vals.length - 1} AND project_id=$${vals.length} RETURNING id`, vals);
  if (!r.length) throw new ApiFailure(404, "Ligne introuvable", "err.notFound");
  return ok({ ok: true });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx); const cid = await uuidParam(ctx, "cid");
  await requireProject(id, u, "editor");
  await sql("DELETE FROM project_components WHERE id=$1 AND project_id=$2", [cid, id]);
  return ok({ ok: true });
});
