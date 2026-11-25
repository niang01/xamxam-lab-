/**
 * Appareils autorisés : chaque navigateur reçoit un identifiant aléatoire (cookie httpOnly) dont seule l'empreinte
 * est stockée. Avec une licence limitée à N appareils, un appareil supplémentaire est refusé tant que l'utilisateur
 * (ou l'administrateur) n'a pas retiré un appareil existant. Les administrateurs et l'essai gratuit ne sont pas limités.
 */
import { sha256 } from "./security/crypto";
import { sql, sqlOne } from "./db";
import { readCookie } from "./api";

const DEVICE_COOKIE = "xx_device";
const seen = new Map<string, number>();

export function deviceHashOf(req: Request): string | null {
  const v = readCookie(req, DEVICE_COOKIE);
  return v && /^[\w-]{20,64}$/.test(v) ? sha256(`device:${v}`) : null;
}
const labelOf = (req: Request) => (req.headers.get("user-agent") ?? "navigateur inconnu").replace(/[^\w ()./;:,-]/g, "").slice(0, 120);

/** Enregistre l'appareil ; renvoie false si la limite d'appareils de la licence est atteinte. */
export async function checkDevice(req: Request, userId: string, maxDevices: number | null): Promise<boolean> {
  const hash = deviceHashOf(req);
  if (!hash) return maxDevices == null; // pas d'identifiant d'appareil : accepté seulement sans limite
  const key = `${userId}:${hash}:${maxDevices ?? "-"}`;
  const last = seen.get(key);
  if (last && Date.now() - last < 10 * 60_000) return true;
  const row = await sqlOne<{ revoked_at: string | null }>("SELECT revoked_at FROM user_devices WHERE user_id=$1 AND device_hash=$2", [userId, hash]);
  if (row && !row.revoked_at) { await sql("UPDATE user_devices SET last_seen=now() WHERE user_id=$1 AND device_hash=$2", [userId, hash]); seen.set(key, Date.now()); return true; }
  if (maxDevices != null) {
    const n = Number((await sqlOne<{ n: number }>("SELECT COUNT(*)::int n FROM user_devices WHERE user_id=$1 AND revoked_at IS NULL", [userId]))!.n);
    if (n >= maxDevices) return false;
  }
  await sql(`INSERT INTO user_devices(user_id, device_hash, label) VALUES ($1,$2,$3) ON CONFLICT (user_id, device_hash) DO UPDATE SET revoked_at=NULL, last_seen=now(), label=$3`, [userId, hash, labelOf(req)]);
  seen.set(key, Date.now());
  return true;
}
export function forgetDevices() { seen.clear(); }
