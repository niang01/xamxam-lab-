import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { automationSpec } from "@/lib/automation";
import { audit } from "@/server/audit";
import { can } from "@/lib/profiles";
import { confirmBlockers } from "@/lib/commands";
import type { DeviceRow } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, userId: string) {
  const a = await sqlOne<{ id: string; owner_id: string; spec: unknown; dry_run: unknown; enabled: boolean }>("SELECT * FROM automations WHERE id=$1", [id]);
  if (!a || a.owner_id !== userId) throw new ApiFailure(404, "Scénario introuvable", "err.notFound");
  return a;
}

/**
 * Activation (essai à blanc préalable obligatoire) et préautorisation de niveau 5 : réservée au propriétaire de niveau
 * d'autonomie 5, autorisé à confirmer des commandes, avec l'habilitation exigée par l'environnement de l'appareil cible.
 */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const a = await load(id, u.id);
  const b = await readInput(req, z.object({ enabled: z.boolean().optional(), preauthorized: z.boolean().optional() }));
  if (b.enabled && !a.dry_run) throw new ApiFailure(409, "Essai à blanc obligatoire avant activation", "auto.dryRunFirst");
  if (b.preauthorized) {
    const s = automationSpec.parse(a.spec);
    if (s.action.kind !== "command") throw new ApiFailure(400, "Préautorisation sans objet pour une simple notification", "err.invalid");
    if (u.autonomy_level < 5) throw new ApiFailure(403, "La préautorisation exige le niveau d'autonomie 5 (Paramètres)", "auto.level5");
    const d = await sqlOne<DeviceRow>("SELECT * FROM devices WHERE id=$1", [s.action.device_id]);
    if (!d) throw new ApiFailure(404, "Appareil introuvable", "err.notFound");
    const bl = confirmBlockers(d, s.action.action, { clearances: u.clearances, canConfirm: can(u.profile_kind, u.is_admin, "confirm_commands") });
    if (bl.length) throw new ApiFailure(403, `Préautorisation refusée : ${bl.join(" ; ")}`, "cmd.confirmBlocked", bl);
  }
  await sql(`UPDATE automations SET enabled=COALESCE($2,enabled), preauthorized=COALESCE($3,preauthorized),
    preauthorized_by=CASE WHEN $3::boolean IS TRUE THEN $4::uuid WHEN $3::boolean IS FALSE THEN NULL ELSE preauthorized_by END WHERE id=$1`,
    [id, b.enabled ?? null, b.preauthorized ?? null, u.id]);
  await audit(u.id, "human", "automation.update", { kind: "automation", id }, b);
  return ok({ ok: true });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await load(id, u.id);
  await sql("DELETE FROM automations WHERE id=$1", [id]);
  await audit(u.id, "human", "automation.delete", { kind: "automation", id });
  return ok({ ok: true });
});
