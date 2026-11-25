import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { softwareByKey, softwareDef } from "@/lib/studies";
import { myStudy, runStudy } from "@/server/studies";


type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await myStudy(await uuidParam(ctx), u);
  return ok({ study: s, software: softwareDef(softwareByKey(s.software)!) });
});

/** Modification : nouvelles données → nouveau calcul ; ou rattachement à un projet. */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await myStudy(await uuidParam(ctx), u);
  const b = await readInput(req, z.object({ title: z.string().trim().min(2).max(160).optional(), input: z.record(z.string().max(60), z.unknown()).optional(), table_id: z.string().uuid().nullable().optional(), project_id: z.string().uuid().nullable().optional() }));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const input = b.input ?? s.inputs, tableId = b.table_id !== undefined ? b.table_id : s.table_id;
  const result = await runStudy(s.software, input, tableId);
  await sql("UPDATE studies SET title=$2, inputs=$3, result=$4, table_id=$5, project_id=$6, updated_at=now() WHERE id=$1",
    [s.id, b.title ?? s.title, JSON.stringify(input), JSON.stringify(result), tableId, b.project_id !== undefined ? b.project_id : s.project_id]);
  return ok({ result });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await myStudy(await uuidParam(ctx), u);
  await sql("DELETE FROM studies WHERE id=$1", [s.id]);
  return ok({ ok: true });
});

/** Envoi de la nomenclature vers un projet (budget, boutique). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await myStudy(await uuidParam(ctx), u);
  const b = await readInput(req, z.object({ project_id: z.string().uuid() }));
  await requireProject(b.project_id, u, "editor");
  const ids = await sql<{ id: string; name: string }>("SELECT id, name FROM components WHERE mpn='generic' AND name = ANY($1)", [s.result.bom.map((l) => l.name)]);
  for (const l of s.result.bom) {
    await sql("INSERT INTO project_components(project_id, component_id, name, qty, note) VALUES ($1,$2,$3,$4,$5)",
      [b.project_id, ids.find((x) => x.name === l.name)?.id ?? null, l.name, Math.max(l.qty, 0.001), `${l.spec}${l.unit !== "u" ? ` (${l.unit})` : ""} — étude « ${s.title} »`.slice(0, 500)]);
  }
  await sql("UPDATE studies SET project_id=$2, updated_at=now() WHERE id=$1", [s.id, b.project_id]);

  return ok({ added: s.result.bom.length }, 201);
});
