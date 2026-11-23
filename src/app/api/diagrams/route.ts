import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { audit } from "@/server/audit";
import { diagramSchema } from "@/lib/diagram";

/** Schémas 2D multidisciplines (table schematics, lab = 'diagram', versions conservées). */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ items: await sql(`SELECT s.id, s.title, s.version, s.updated_at, s.project_id, p.title AS project_title, s.graph->>'discipline' AS discipline FROM schematics s LEFT JOIN projects p ON p.id=s.project_id
    WHERE s.lab='diagram' AND (s.owner_id=$1 OR s.project_id IN (SELECT project_id FROM project_members WHERE user_id=$1)) ORDER BY s.updated_at DESC LIMIT 200`, [u.id]) });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ project_id: z.string().uuid().nullable().optional(), title: z.string().trim().min(1).max(160), graph: diagramSchema }));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const s = (await sql<{ id: string }>("INSERT INTO schematics(project_id, owner_id, lab, title, graph) VALUES ($1,$2,'diagram',$3,$4) RETURNING id", [b.project_id ?? null, u.id, b.title, JSON.stringify(b.graph)]))[0];
  await sql("INSERT INTO schematic_versions(schematic_id, version, graph, message, created_by) VALUES ($1,1,$2,'Création',$3)", [s.id, JSON.stringify(b.graph), u.id]);
  await audit(u.id, "human", "diagram.create", { kind: "schematic", id: s.id });
  return ok({ id: s.id, version: 1 }, 201);
});
