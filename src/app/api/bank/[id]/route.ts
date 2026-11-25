import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { bankById, bankToProject } from "@/lib/bank";
import { CODES } from "@/lib/bank/codes";

type Ctx = { params: Promise<{ id: string }> };
const get = async (ctx: Ctx) => { const id = (await ctx.params).id; const p = bankById(id); if (!p) throw new ApiFailure(404, "Projet de la banque introuvable", "err.notFound"); return p; };

/** Fiche complète (17 rubriques) + code source d'exemple. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const p = await get(ctx);
  const ids = await sql<{ name: string; id: string }>("SELECT name, id FROM components WHERE mpn='generic' AND name = ANY($1)", [p.components.map(([n]) => n)]);
  const favorite = !!(await sql("SELECT 1 FROM bank_favorites WHERE user_id=$1 AND bank_id=$2", [u.id, p.id])).length;
  return ok({ ...p, favorite, component_ids: Object.fromEntries(ids.map((r) => [r.name, r.id])), code_source: p.code ? CODES[p.code] : null });
});

/** Actions : enregistrer / retirer des favoris, réaliser (copie en projet personnel modifiable). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const p = await get(ctx);
  const b = await readInput(req, z.object({ action: z.enum(["favorite", "unfavorite", "realise"]) }));
  if (b.action === "favorite") { await sql("INSERT INTO bank_favorites(user_id, bank_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [u.id, p.id]); return ok({ ok: true }); }
  if (b.action === "unfavorite") { await sql("DELETE FROM bank_favorites WHERE user_id=$1 AND bank_id=$2", [u.id, p.id]); return ok({ ok: true }); }
  const x = bankToProject(p);
  const row = (await sql<{ id: string }>(`INSERT INTO projects(owner_id, title, kind, level, description, problem, objectives, specs, methodology, architecture, programming, tests, bank_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [u.id, x.title, x.kind, x.level, x.description, x.problem, x.objectives, x.specs, x.methodology, x.architecture, x.programming, x.tests, p.id]))[0];
  await sql("INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,'owner')", [row.id, u.id]);
  for (const [name, qty] of x.components) await sql("INSERT INTO project_components(project_id, component_id, name, qty) VALUES ($1, (SELECT id FROM components WHERE name=$2 AND mpn='generic' LIMIT 1), $2, $3)", [row.id, name, qty]);
  for (const t of x.tasks) await sql("INSERT INTO project_tasks(project_id, title, created_by) VALUES ($1,$2,$3)", [row.id, t.slice(0, 300), u.id]);
  await audit(u.id, "human", "project.create", { kind: "project", id: row.id }, { bank: p.id });
  return ok({ id: row.id }, 201);
});
