import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { audit } from "@/server/audit";
import { plcSchema } from "@/lib/plc/schemas";

/** Programmes d'automate (Ladder, Grafcet) : table schematics, lab = 'ladder' | 'grafcet', versions conservées. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ items: await sql(`SELECT s.id, s.title, s.lab AS kind, s.version, s.updated_at, s.project_id FROM schematics s
    WHERE s.lab IN ('ladder','grafcet') AND (s.owner_id=$1 OR s.project_id IN (SELECT project_id FROM project_members WHERE user_id=$1)) ORDER BY s.updated_at DESC LIMIT 200`, [u.id]) });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ project_id: z.string().uuid().nullable().optional(), title: z.string().trim().min(1).max(160) }).and(plcSchema));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const s = (await sql<{ id: string }>("INSERT INTO schematics(project_id, owner_id, lab, title, graph) VALUES ($1,$2,$3,$4,$5) RETURNING id", [b.project_id ?? null, u.id, b.kind, b.title, JSON.stringify(b.program)]))[0];
  await sql("INSERT INTO schematic_versions(schematic_id, version, graph, message, created_by) VALUES ($1,1,$2,'Création',$3)", [s.id, JSON.stringify(b.program), u.id]);
  await audit(u.id, "human", "plc.create", { kind: "schematic", id: s.id });
  return ok({ id: s.id, version: 1 }, 201);
});
