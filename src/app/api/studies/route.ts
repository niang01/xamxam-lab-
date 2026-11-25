import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { requireProject } from "@/server/access";
import { SOFTWARE, softwareDef } from "@/lib/studies";
import { listStudies, runStudy } from "@/server/studies";

/** Logiciels disponibles, études de l'utilisateur, tableaux normatifs enregistrés. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const tables = await sql("SELECT id, standard, table_ref, description, validated_by_name FROM normative_tables ORDER BY standard, table_ref");
  return ok({ software: SOFTWARE.map(softwareDef), items: await listStudies(u), tables });
});

const body = z.object({
  software: z.string().max(60), input: z.record(z.string().max(60), z.unknown()), table_id: z.string().uuid().nullable().default(null),
  save: z.boolean().default(false), title: z.string().trim().min(2).max(160).optional(), project_id: z.string().uuid().nullable().default(null),
});

/** Calcul (et enregistrement si `save`) : le moteur testé fait tout le calcul ; rien n'est supposé. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, body);
  if (JSON.stringify(b.input).length > 200_000) throw new Error("Données trop volumineuses");
  const result = await runStudy(b.software, b.input, b.table_id);
  if (!b.save) return ok({ result });
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const row = (await sql<{ id: string }>("INSERT INTO studies(user_id, project_id, software, title, inputs, result, table_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [u.id, b.project_id, b.software, b.title ?? "Étude sans titre", JSON.stringify(b.input), JSON.stringify(result), b.table_id]))[0];
  await audit(u.id, "human", "study.create", { kind: "study", id: row.id }, { software: b.software });
  return ok({ id: row.id, result }, 201);
});
