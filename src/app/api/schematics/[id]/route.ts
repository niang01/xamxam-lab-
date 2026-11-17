import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { graphSchema } from "@/server/schemas";
import { requireSchematic } from "@/server/schematics";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const s = await requireSchematic(id, u, false);
  const v = new URL(req.url).searchParams.get("version");
  const versions = await sql<{ version: number; message: string | null; created_at: string; graph?: unknown }>("SELECT version, message, created_at FROM schematic_versions WHERE schematic_id=$1 ORDER BY version DESC", [id]);
  if (v) {
    const row = (await sql<{ graph: unknown }>("SELECT graph FROM schematic_versions WHERE schematic_id=$1 AND version=$2", [id, Number(v)]))[0];
    if (!row) throw new ApiFailure(404, "Version introuvable", "err.notFound");
    return ok({ ...s, graph: row.graph, viewing_version: Number(v), versions });
  }
  return ok({ ...s, versions });
});

/** Enregistre une nouvelle version (le contrôle de version optimiste évite d'écraser une modification concurrente). */
export const PUT = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const s = await requireSchematic(id, u, true);
  const b = await readInput(req, z.object({ graph: graphSchema, message: z.string().trim().max(300).nullable().optional(), base_version: z.number().int().positive(), title: z.string().trim().min(1).max(160).optional() }));
  if (b.base_version !== s.version) throw new ApiFailure(409, `Le schéma a été modifié entre-temps (version ${s.version}). Rechargez-le avant d'enregistrer.`, "sch.conflict");
  const next = s.version + 1;
  await sql("UPDATE schematics SET graph=$1, version=$2, title=COALESCE($3,title), updated_at=now() WHERE id=$4", [JSON.stringify(b.graph), next, b.title ?? null, id]);
  await sql("INSERT INTO schematic_versions(schematic_id, version, graph, message, created_by) VALUES ($1,$2,$3,$4,$5)", [id, next, JSON.stringify(b.graph), b.message ?? null, u.id]);
  return ok({ version: next });
});
