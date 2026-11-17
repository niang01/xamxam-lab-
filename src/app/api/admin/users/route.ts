import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

export const GET = endpoint(async (req) => {
  await mustBeAdmin(req);
  return ok({ items: await sql(`SELECT u.id, u.email, u.display_name, u.profile_kind, u.is_admin, u.status, u.autonomy_level, u.created_at,
    COALESCE((SELECT json_agg(json_build_object('kind', c.kind, 'valid_until', c.valid_until, 'evidence', c.evidence)) FROM clearances c WHERE c.user_id=u.id), '[]') AS clearances
    FROM users u ORDER BY u.created_at DESC LIMIT 500`) });
});

/** Désactivation / réactivation (révocation immédiate des sessions). */
export const PATCH = endpoint(async (req) => {
  const a = await mustBeAdmin(req);
  const b = await readInput(req, z.object({ id: z.string().uuid(), status: z.enum(["active", "disabled"]) }));
  if (b.id === a.id) throw new ApiFailure(400, "Impossible de se désactiver soi-même", "err.forbidden");
  await sql("UPDATE users SET status=$2, session_version=session_version+1 WHERE id=$1", [b.id, b.status]);
  await audit(a.id, "human", "account.status", { kind: "user", id: b.id }, { status: b.status });
  return ok({ ok: true });
});
