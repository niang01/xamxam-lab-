import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { sql } from "@/server/db";
import { activateByKey, entitlement, TRIAL_DAYS } from "@/server/licensing";
import { audit } from "@/server/audit";
import { deviceHashOf, forgetDevices } from "@/server/devices";

/** État de l'accès du compte : essai, licence, historique. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const e = await entitlement(u.id, u.is_admin);
  const history = await sql(
    `SELECT e.action, e.created_at, l.key_hint FROM licence_events e LEFT JOIN licences l ON l.id=e.licence_id WHERE e.user_id=$1 ORDER BY e.id DESC LIMIT 50`, [u.id]);
  const devices = await sql("SELECT id, label, first_seen, last_seen FROM user_devices WHERE user_id=$1 AND revoked_at IS NULL ORDER BY last_seen DESC", [u.id]);
  return ok({ ...e, trial_days: TRIAL_DAYS, history, devices, this_device: deviceHashOf(req) ? (await sql<{ id: string }>("SELECT id FROM user_devices WHERE user_id=$1 AND device_hash=$2", [u.id, deviceHashOf(req)]))[0]?.id ?? null : null });
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

/** Retrait d'un de mes appareils (libère une place pour un autre appareil). */
export const DELETE = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const id = new URL(req.url).searchParams.get("device") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return ok({ ok: false });
  await sql("UPDATE user_devices SET revoked_at=now() WHERE id=$1 AND user_id=$2", [id, u.id]);
  forgetDevices();
  await audit(u.id, "human", "device.revoke", { kind: "device", id });
  return ok({ ok: true });
});
