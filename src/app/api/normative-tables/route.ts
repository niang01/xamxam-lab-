import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

/** Tableaux normatifs saisis par un ingénieur depuis la norme achetée (référence et validateur obligatoires). */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  return ok({ items: await sql("SELECT id, standard, table_ref, description, data, validated_by_name, created_at FROM normative_tables ORDER BY created_at DESC") });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeAdmin(req);
  const b = await readInput(req, z.object({
    standard: z.string().trim().min(2).max(120), table_ref: z.string().trim().min(1).max(120), description: z.string().trim().min(3).max(300),
    validated_by_name: z.string().trim().min(2).max(120),
    rows: z.array(z.object({ s: z.number().positive(), iz: z.number().positive() })).min(1).max(60),
  }));
  const r = (await sql<{ id: string }>("INSERT INTO normative_tables(standard, table_ref, description, data, entered_by, validated_by_name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [b.standard, b.table_ref, b.description, JSON.stringify({ rows: b.rows }), u.id, b.validated_by_name]))[0];
  await audit(u.id, "human", "normative_table.create", { kind: "normative_table", id: r.id }, { standard: b.standard, ref: b.table_ref });
  return ok({ id: r.id }, 201);
});
