import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";
import { CLEARANCES } from "@/lib/profiles";

type Ctx = { params: Promise<{ id: string }> };

/** Habilitation nominative : justificatif obligatoire (référence de formation, autorisation, attestation), date d'expiration facultative. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const a = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ kind: z.enum(CLEARANCES), evidence: z.string().trim().min(3).max(500), valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }));
  await sql(`INSERT INTO clearances(user_id, kind, evidence, valid_until, granted_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id, kind) DO UPDATE SET evidence=EXCLUDED.evidence, valid_until=EXCLUDED.valid_until, granted_by=EXCLUDED.granted_by, created_at=now()`, [id, b.kind, b.evidence, b.valid_until ?? null, a.id]);
  await notify(id, "clearance", `Habilitation accordée : ${b.kind}`, b.valid_until ? `Valable jusqu'au ${b.valid_until}` : null, "/settings");
  await audit(a.id, "human", "clearance.grant", { kind: "user", id }, b);
  return ok({ ok: true });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const a = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const kind = z.enum(CLEARANCES).parse(new URL(req.url).searchParams.get("kind"));
  await sql("DELETE FROM clearances WHERE user_id=$1 AND kind=$2", [id, kind]);
  // Retrait d'une habilitation : préautorisations de niveau 5 de cette personne révoquées.
  await sql("UPDATE automations SET preauthorized=false, preauthorized_by=NULL WHERE preauthorized_by=$1", [id]);
  await audit(a.id, "human", "clearance.revoke", { kind: "user", id }, { kind });
  return ok({ ok: true });
});
