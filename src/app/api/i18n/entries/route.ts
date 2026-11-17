import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

/** Brouillons à relire (validateurs wolof et administrateurs). */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  if (!u.is_admin && !u.clearances.includes("validateur_traduction_wo")) throw new ApiFailure(403, "Réservé aux validateurs", "err.forbidden");
  return ok({ items: await sql("SELECT key, text, status, updated_at FROM translations WHERE lang='wo' AND status<>'validated' ORDER BY key LIMIT 1000") });
});

/** Validation ligne à ligne par un locuteur natif habilité (nom du validateur enregistré). */
export const PATCH = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  if (!u.is_admin && !u.clearances.includes("validateur_traduction_wo")) throw new ApiFailure(403, "Réservé aux validateurs", "err.forbidden");
  const b = await readInput(req, z.object({ key: z.string().max(120), text: z.string().trim().min(1).max(5000), validate: z.boolean() }));
  await sql(`UPDATE translations SET text=$2, status=$3, validated_by=$4, validated_at=CASE WHEN $3='validated' THEN now() ELSE NULL END, updated_at=now() WHERE lang='wo' AND key=$1`,
    [b.key, b.text, b.validate ? "validated" : "draft", b.validate ? u.display_name : null]);
  await audit(u.id, "human", "i18n.validate", { kind: "translation", id: b.key }, { validated: b.validate });
  return ok({ ok: true });
});
