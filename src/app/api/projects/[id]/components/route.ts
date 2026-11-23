import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { budget } from "@/server/ai/analysis";
import { componentLine } from "@/server/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Nomenclature et budget prévisionnel (prix saisis par l'équipe ; ligne sans prix signalée). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "viewer");
  const items = await sql<{ name: string; qty: number; unit_price: number | null; currency: string }>("SELECT * FROM project_components WHERE project_id=$1 ORDER BY created_at", [id]);
  return ok({ items, budget_markdown: budget(items) });
});

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "editor");
  const b = await readInput(req, z.object({ items: z.array(componentLine).min(1).max(200) }));
  for (const c of b.items) {
    await sql("INSERT INTO project_components(project_id, component_id, name, qty, unit_price, currency, supplier, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, c.component_id ?? null, c.name, c.qty, c.unit_price ?? null, c.currency, c.supplier ?? null, c.note ?? null]);
  }
  await sql("UPDATE projects SET updated_at=now() WHERE id=$1", [id]);
  return ok({ added: b.items.length }, 201);
});
