import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireDevice, requireProject } from "@/server/access";
import { capabilitiesSchema } from "@/server/schemas";
import { audit } from "@/server/audit";
import { expireCommands } from "@/server/iot";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, false);
  await expireCommands();
  const commands = await sql("SELECT c.*, u.display_name AS confirmed_by_name FROM device_commands c LEFT JOIN users u ON u.id=c.confirmed_by WHERE device_id=$1 ORDER BY created_at DESC LIMIT 50", [d.id]);
  const metrics = await sql("SELECT metric, unit, COUNT(*)::int n, MAX(ts) last FROM measurements WHERE device_id=$1 GROUP BY metric, unit ORDER BY metric", [d.id]);
  return ok({ device: d, commands, metrics, now: new Date().toISOString() });
});

/** Modification (propriétaire) : capacités et durées maximales, environnement, état (désactiver = révoquer l'accès). */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, true);
  const b = await readInput(req, z.object({ name: z.string().trim().min(2).max(80).optional(), status: z.enum(["active", "disabled"]).optional(), environment: z.enum(["virtual", "bench", "real"]).optional(), capabilities: capabilitiesSchema.optional(), project_id: z.string().uuid().nullable().optional() }));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  await sql(`UPDATE devices SET name=COALESCE($2,name), status=COALESCE($3,status), environment=COALESCE($4,environment), capabilities=COALESCE($5,capabilities),
    project_id=CASE WHEN $6::boolean THEN $7::uuid ELSE project_id END WHERE id=$1`,
    [d.id, b.name ?? null, b.status ?? null, b.environment ?? null, b.capabilities ? JSON.stringify(b.capabilities) : null, b.project_id !== undefined, b.project_id ?? null]);
  if (b.status === "disabled") await sql("UPDATE device_commands SET status='cancelled' WHERE device_id=$1 AND status IN ('proposed','confirmed')", [d.id]);
  await audit(u.id, "human", "device.update", { kind: "device", id: d.id }, b);
  return ok({ ok: true });
});
