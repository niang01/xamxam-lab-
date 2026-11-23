import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { instantiate, templateByKey, TEMPLATES } from "@/lib/project-templates";

/** Modèles disponibles (structure seulement). */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  return ok({ items: TEMPLATES.map((t) => ({ key: t.key, title: t.title, domain: t.domain, summary: t.summary, components: t.components.length, tasks: t.tasks.length })) });
});

/** Création d'un projet structuré à partir d'un modèle : sections, nomenclature (sans prix), tâches. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({
    template_key: z.string().max(60), title: z.string().trim().min(2).max(160),
    level: z.enum(["memoire_technicien", "projet_bts", "projet_ingenieur", "recherche", "fin_formation", "startup"]),
  }));
  const t = templateByKey(b.template_key);
  if (!t) throw new ApiFailure(404, "Modèle introuvable", "err.notFound");
  const x = instantiate(t, b.level);
  const p = (await sql<{ id: string }>(`INSERT INTO projects(owner_id, title, description, objectives, specs, kind, level, template_key, methodology, architecture, programming, tests)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [u.id, b.title, t.summary, t.objectives, t.specs, x.kind, b.level, t.key, x.methodology, t.architecture, t.programming, t.tests]))[0];
  await sql("INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,'owner')", [p.id, u.id]);
  for (const [name, qty] of t.components) {
    await sql(`INSERT INTO project_components(project_id, component_id, name, qty) VALUES ($1, (SELECT id FROM components WHERE name=$2 AND mpn='generic' LIMIT 1), $2, $3)`, [p.id, name, qty]);
  }
  for (const title of x.tasks) await sql("INSERT INTO project_tasks(project_id, title, created_by) VALUES ($1,$2,$3)", [p.id, title, u.id]);
  await audit(u.id, "human", "project.create", { kind: "project", id: p.id }, { template: t.key, level: b.level });
  return ok({ id: p.id }, 201);
});
