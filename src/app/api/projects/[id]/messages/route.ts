import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { notify } from "@/server/settings";

type Ctx = { params: Promise<{ id: string }> };

/** Messagerie de projet (Collaborative Engineering). `after` : messages postérieurs (actualisation périodique). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "viewer");
  const after = new URL(req.url).searchParams.get("after");
  const rows = await sql(`SELECT m.id, m.body, m.author_kind, m.created_at, u.display_name AS author FROM project_messages m LEFT JOIN users u ON u.id=m.author_id
    WHERE m.project_id=$1 AND ($2::timestamptz IS NULL OR m.created_at > $2::timestamptz) ORDER BY m.created_at ASC LIMIT 500`, [id, after]);
  return ok({ items: rows });
});

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "commenter");
  const b = await readInput(req, z.object({ body: z.string().trim().min(1).max(5000) }));
  const m = (await sql<{ id: string }>("INSERT INTO project_messages(project_id, author_id, body) VALUES ($1,$2,$3) RETURNING id", [id, u.id, b.body]))[0];
  const others = await sql<{ user_id: string }>("SELECT user_id FROM project_members WHERE project_id=$1 AND user_id<>$2", [id, u.id]);
  for (const o of others) await notify(o.user_id, "project.message", `${u.display_name} : nouveau message`, b.body.slice(0, 140), `/collab?projet=${id}`);
  return ok({ id: m.id }, 201);
});
