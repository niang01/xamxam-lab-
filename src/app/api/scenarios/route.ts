import { createHash } from "node:crypto";
import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { SCENARIOS, type ScenarioKey } from "@/lib/scenarios";

const ENGINE_VERSION = "xamxam-4d 1.0 (Euler explicite)";

/** Exécute un scénario 4D et l'enregistre (table simulations, nature : simulation numérique). */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ model: z.enum(Object.keys(SCENARIOS) as [ScenarioKey, ...ScenarioKey[]]), input: z.record(z.string(), z.unknown()), project_id: z.string().uuid().nullable().optional() }));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const def = SCENARIOS[b.model];
  const parsed = def.schema.safeParse(b.input);
  if (!parsed.success) throw new ApiFailure(400, "Paramètres invalides", "err.invalid", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  const t0 = Date.now();
  const result = (def.run as (i: unknown) => ReturnType<typeof SCENARIOS.tank.run>)(parsed.data);
  const input = JSON.stringify(parsed.data);
  const status = result.missing.length ? "failed" : "done";
  const row = (await sql<{ id: string }>(`INSERT INTO simulations(project_id, user_id, engine, engine_version, kind, analysis, input, input_hash, status, result, errors, duration_ms)
    VALUES ($1,$2,'xamxam-4d',$3,'numerical_solver',$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [b.project_id ?? null, u.id, ENGINE_VERSION, b.model, input, createHash("sha256").update(input).digest("hex"), status, JSON.stringify({ scenario: result }),
      JSON.stringify(result.missing.map((m) => `Paramètre manquant : ${m}`)), Date.now() - t0]))[0];
  return ok({ id: row.id, engine_version: ENGINE_VERSION, ...result });
});
