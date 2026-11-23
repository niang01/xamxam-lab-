import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure, type User } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { projectRole } from "@/server/access";
import { diagramSchema, diagramSvg } from "@/lib/diagram";

type Ctx = { params: Promise<{ id: string }> };
type Row = { id: string; owner_id: string; project_id: string | null; title: string; version: number; graph: z.infer<typeof diagramSchema> };

async function load(id: string, u: User, write: boolean): Promise<Row> {
  const s = await sqlOne<Row>("SELECT id, owner_id, project_id, title, version, graph FROM schematics WHERE id=$1 AND lab='diagram'", [id]);
  if (!s) throw new ApiFailure(404, "Schéma introuvable", "err.notFound");
  if (s.owner_id === u.id) return s;
  const role = s.project_id ? await projectRole(s.project_id, u) : null;
  if (!role || (write && !["owner", "editor"].includes(role))) throw new ApiFailure(404, "Schéma introuvable", "err.notFound");
  return s;
}

/** Lecture (JSON) ou export SVG (?format=svg). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await load(await uuidParam(ctx), u, false);
  if (new URL(req.url).searchParams.get("format") === "svg") {
    return new Response(diagramSvg(s.graph, s.title), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="schema-${s.id.slice(0, 8)}.svg"`, "Cache-Control": "no-store" } });
  }
  const versions = await sql("SELECT version, message, created_at FROM schematic_versions WHERE schematic_id=$1 ORDER BY version DESC", [s.id]);
  return ok({ ...s, versions });
});

/** Nouvelle version (historique conservé). */
export const PUT = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await load(await uuidParam(ctx), u, true);
  const b = await readInput(req, z.object({ title: z.string().trim().min(1).max(160), graph: diagramSchema, message: z.string().max(200).optional() }));
  const v = s.version + 1;
  await sql("UPDATE schematics SET title=$2, graph=$3, version=$4, updated_at=now() WHERE id=$1", [s.id, b.title, JSON.stringify(b.graph), v]);
  await sql("INSERT INTO schematic_versions(schematic_id, version, graph, message, created_by) VALUES ($1,$2,$3,$4,$5)", [s.id, v, JSON.stringify(b.graph), b.message ?? null, u.id]);
  return ok({ id: s.id, version: v });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await load(await uuidParam(ctx), u, true);
  if (s.owner_id !== u.id) throw new ApiFailure(403, "Seul l'auteur peut supprimer ce schéma", "err.forbidden");
  await sql("DELETE FROM schematics WHERE id=$1", [s.id]);
  return ok({ ok: true });
});
