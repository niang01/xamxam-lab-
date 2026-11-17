import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { requireDevice } from "@/server/access";
import { automationSpec } from "@/lib/automation";
import { audit } from "@/server/audit";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const items = await sql(`SELECT a.*, (SELECT json_agg(r ORDER BY r.created_at DESC) FROM (SELECT outcome, trigger, created_at FROM automation_runs WHERE automation_id=a.id ORDER BY created_at DESC LIMIT 10) r) AS runs
    FROM automations a WHERE owner_id=$1 ORDER BY created_at DESC`, [u.id]);
  return ok({ items });
});

/** Création : le scénario est créé DÉSACTIVÉ ; l'essai à blanc est obligatoire avant activation. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ name: z.string().trim().min(2).max(120), project_id: z.string().uuid().nullable().optional(), spec: automationSpec }));
  await requireDevice(b.spec.trigger.device_id, u, false);
  if (b.spec.action.kind === "command") await requireDevice(b.spec.action.device_id, u, true);
  const a = (await sql<{ id: string }>("INSERT INTO automations(owner_id, project_id, name, spec) VALUES ($1,$2,$3,$4) RETURNING id", [u.id, b.project_id ?? null, b.name, JSON.stringify(b.spec)]))[0];
  await audit(u.id, "human", "automation.create", { kind: "automation", id: a.id }, { name: b.name });
  return ok({ id: a.id }, 201);
});
