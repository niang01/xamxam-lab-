import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { sql } from "@/server/db";
import { activateByKey, entitlement, TRIAL_DAYS } from "@/server/licensing";
import { audit } from "@/server/audit";

/** État de l'accès du compte : essai, licence, historique. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const e = await entitlement(u.id, u.is_admin);
  const history = await sql(
    `SELECT e.action, e.created_at, l.key_hint FROM licence_events e LEFT JOIN licences l ON l.id=e.licence_id WHERE e.user_id=$1 ORDER BY e.id DESC LIMIT 50`, [u.id]);
  return ok({ ...e, trial_days: TRIAL_DAYS, history });
});

/** Activation d'une clé de licence. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, `licence-activate-${u.id}`, 10, 15 * 60_000);
  const b = await readInput(req, z.object({ key: z.string().trim().min(20, "Clé de licence trop courte").max(60) }));
  await activateByKey(b.key, u.id);
  await audit(u.id, "human", "licence.activate", { kind: "user", id: u.id });
  return ok({ ok: true, ...(await entitlement(u.id, u.is_admin)) });
});
