/**
 * Essai gratuit (90 jours) et licences — validation exclusivement côté serveur.
 *
 * - Essai : une ligne par compte (`trials`), dates fixées par le serveur à partir de l'activation du compte
 *   (date de création), protégées par une étiquette HMAC : une date modifiée directement en base est détectée
 *   (« intégrité rompue » → accès refusé et signalé à l'administrateur).
 * - Clés : 125 bits aléatoires, format XXL-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX (alphabet sans caractères ambigus) ;
 *   seule l'empreinte SHA-256 est stockée, avec les 4 derniers caractères pour l'identification.
 * - Partage abusif : nombre de postes (seats) par licence ; une activation de plus est refusée.
 * - Aucun paiement n'est encaissé ici : l'attribution est faite par l'administrateur (ou, plus tard, par un
 *   module de paiement qui appellera `issueLicences`).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql, sqlOne } from "./db";
import { sha256 } from "./security/crypto";
import { integrityKey } from "./keys";

export const TRIAL_DAYS = 90;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symboles, sans I, O, 0, 1

function tag(parts: (string | number | null)[]): string {
  const key = integrityKey();
  return createHmac("sha256", key).update(parts.map((p) => String(p ?? "")).join("|")).digest("base64url");
}
function sameTag(a: string | null, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const iso = (d: string | Date) => new Date(d).toISOString();

export function generateLicenceKey(): string {
  const bytes = randomBytes(16);
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5 && out.length < 25) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return `XXL-${out.match(/.{5}/g)!.join("-")}`;
}
export const normalizeKey = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^XXL/, "");
export const keyHash = (k: string) => sha256(`xxl:${normalizeKey(k)}`);

export function trialTag(userId: string, start: string, end: string) { return tag(["trial", userId, iso(start), iso(end)]); }
export function licenceTag(l: { id: string; status: string; seats: number; activated_at: string | null; expires_at: string | null }) {
  return tag(["licence", l.id, l.status, l.seats, l.activated_at ? iso(l.activated_at) : null, l.expires_at ? iso(l.expires_at) : null]);
}

/** Crée l'essai s'il n'existe pas (début = activation du compte). */
export async function ensureTrial(userId: string): Promise<void> {
  const u = await sqlOne<{ created_at: string }>("SELECT created_at FROM users WHERE id=$1", [userId]);
  if (!u) return;
  const start = iso(u.created_at);
  const end = new Date(new Date(start).getTime() + TRIAL_DAYS * 86400_000).toISOString();
  await sql("INSERT INTO trials(user_id, started_at, ends_at, integrity) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO NOTHING", [userId, start, end, trialTag(userId, start, end)]);
}

/** Prolongation par l'administrateur (journalisée). */
export async function extendTrial(userId: string, days: number, actorId: string) {
  await ensureTrial(userId);
  const t = (await sql<{ started_at: string; ends_at: string }>("SELECT started_at, ends_at FROM trials WHERE user_id=$1", [userId]))[0];
  const base = Math.max(new Date(t.ends_at).getTime(), Date.now());
  const end = new Date(base + days * 86400_000).toISOString();
  await sql("UPDATE trials SET ends_at=$2, integrity=$3 WHERE user_id=$1", [userId, end, trialTag(userId, t.started_at, end)]);
  forgetEntitlements();
  await logEvent(null, userId, actorId, "trial.extend", { days, ends_at: end });
}

export async function logEvent(licenceId: string | null, userId: string | null, actorId: string | null, action: string, details: Record<string, unknown> = {}) {
  await sql("INSERT INTO licence_events(licence_id, user_id, actor_id, action, details) VALUES ($1,$2,$3,$4,$5)", [licenceId, userId, actorId, action, JSON.stringify(details)]);
}

export type AccessState = "admin" | "trial" | "licensed" | "expired" | "tampered";
export interface Entitlement {
  state: AccessState; allowed: boolean;
  trial: { started_at: string; ends_at: string; days_left: number; intact: boolean } | null;
  licence: { id: string; plan: string; plan_name: string; key_hint: string; expires_at: string; organization: string | null; days_left: number; max_devices: number | null } | null;
}

const daysLeft = (end: string) => Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400_000));

const cache = new Map<string, { at: number; value: Entitlement }>();
/** À appeler après toute modification d'essai ou de licence. */
export function forgetEntitlements() { cache.clear(); }

/** Vérification avec mémoire courte (60 s) pour les contrôles d'accès de chaque requête. */
export async function cachedEntitlement(userId: string, isAdmin: boolean): Promise<Entitlement> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = await entitlement(userId, isAdmin);
  cache.set(userId, { at: Date.now(), value });
  return value;
}

export async function entitlement(userId: string, isAdmin: boolean): Promise<Entitlement> {
  await ensureTrial(userId);
  const t = await sqlOne<{ started_at: string; ends_at: string; integrity: string }>("SELECT started_at, ends_at, integrity FROM trials WHERE user_id=$1", [userId]);
  const trialIntact = !!t && sameTag(t.integrity, trialTag(userId, t.started_at, t.ends_at));
  const trial = t ? { started_at: iso(t.started_at), ends_at: iso(t.ends_at), days_left: daysLeft(t.ends_at), intact: trialIntact } : null;

  const lics = await sql<{ id: string; status: string; seats: number; activated_at: string | null; expires_at: string | null; integrity: string | null; key_hint: string; organization: string | null; code: string; name: string; max_devices: number | null }>(
    `SELECT l.id, l.status, l.seats, l.activated_at, l.expires_at, l.integrity, l.key_hint, l.organization, p.code, p.name, COALESCE(l.max_devices, p.max_devices) AS max_devices
       FROM licence_activations a JOIN licences l ON l.id=a.licence_id JOIN licence_plans p ON p.id=l.plan_id
      WHERE a.user_id=$1 AND a.deactivated_at IS NULL AND l.status='active' AND l.expires_at > now()
      ORDER BY l.expires_at DESC`, [userId]);
  const valid = lics.find((l) => sameTag(l.integrity, licenceTag(l)));
  const licence = valid ? { id: valid.id, plan: valid.code, plan_name: valid.name, key_hint: valid.key_hint, expires_at: iso(valid.expires_at!), organization: valid.organization, days_left: daysLeft(valid.expires_at!), max_devices: valid.max_devices == null ? null : Number(valid.max_devices) } : null;

  if (isAdmin) return { state: "admin", allowed: true, trial, licence };
  if (licence) return { state: "licensed", allowed: true, trial, licence };
  if (lics.length && !valid) return { state: "tampered", allowed: false, trial, licence: null };
  if (t && !trialIntact) return { state: "tampered", allowed: false, trial, licence: null };
  if (trial && new Date(trial.ends_at).getTime() > Date.now()) return { state: "trial", allowed: true, trial, licence: null };
  return { state: "expired", allowed: false, trial, licence: null };
}

/** Émission de clés (affichées une seule fois). */
export async function issueLicences(o: { plan_id: string; count: number; organization: string | null; seats: number | null; note: string | null; actorId: string }): Promise<{ id: string; key: string }[]> {
  const plan = await sqlOne<{ id: string; seats: number; duration_days: number; active: boolean }>("SELECT id, seats, duration_days, active FROM licence_plans WHERE id=$1", [o.plan_id]);
  if (!plan) throw Object.assign(new Error("Catégorie de licence introuvable"), { status: 404 });
  if (!plan.active) throw Object.assign(new Error("Catégorie de licence désactivée"), { status: 409 });
  const out: { id: string; key: string }[] = [];
  for (let i = 0; i < o.count; i++) {
    const key = generateLicenceKey();
    const row = (await sql<{ id: string }>(
      `INSERT INTO licences(plan_id, key_hash, key_hint, organization, seats, duration_days, note, issued_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [plan.id, keyHash(key), key.slice(-4), o.organization, o.seats ?? plan.seats, plan.duration_days, o.note, o.actorId]))[0];
    await logEvent(row.id, null, o.actorId, "licence.issue", { organization: o.organization });
    out.push({ id: row.id, key });
  }
  return out;
}

export class LicenceError extends Error { constructor(readonly status: number, message: string, readonly key: string) { super(message); } }

async function activate(licenceId: string, userId: string, actorId: string) {
  const l = (await sql<{ id: string; status: string; seats: number; duration_days: number; activated_at: string | null; expires_at: string | null; integrity: string | null }>(
    "SELECT id, status, seats, duration_days, activated_at, expires_at, integrity FROM licences WHERE id=$1 FOR UPDATE", [licenceId]))[0];
  if (!l) throw new LicenceError(404, "Licence introuvable", "lic.err.notFound");
  if (l.status === "revoked") throw new LicenceError(409, "Cette licence a été révoquée", "lic.err.revoked");
  if (l.status === "suspended") throw new LicenceError(409, "Cette licence est suspendue : contactez l'administrateur", "lic.err.suspended");
  if (l.status === "active" && !sameTag(l.integrity, licenceTag(l))) throw new LicenceError(409, "Licence altérée : contactez l'administrateur", "lic.err.tampered");
  if (l.expires_at && new Date(l.expires_at).getTime() <= Date.now()) throw new LicenceError(409, "Cette licence a expiré", "lic.err.expired");
  if (await sqlOne("SELECT 1 FROM licence_activations WHERE licence_id=$1 AND user_id=$2 AND deactivated_at IS NULL", [licenceId, userId])) throw new LicenceError(409, "Licence déjà active sur ce compte", "lic.err.already");
  const used = Number((await sql<{ n: number }>("SELECT count(*)::int AS n FROM licence_activations WHERE licence_id=$1 AND deactivated_at IS NULL", [licenceId]))[0].n);
  if (used >= l.seats) throw new LicenceError(409, `Tous les postes de cette licence sont utilisés (${l.seats})`, "lic.err.seats");
  if (l.status === "issued") {
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + l.duration_days * 86400_000).toISOString();
    const next = { id: l.id, status: "active", seats: l.seats, activated_at: now, expires_at: exp };
    await sql("UPDATE licences SET status='active', activated_at=$2, expires_at=$3, integrity=$4 WHERE id=$1", [l.id, now, exp, licenceTag(next)]);
  }
  await sql("INSERT INTO licence_activations(licence_id, user_id, by_user) VALUES ($1,$2,$3)", [licenceId, userId, actorId]);
  forgetEntitlements();
  await logEvent(licenceId, userId, actorId, "licence.activate", {});
}

/** Activation par l'utilisateur avec sa clé. */
export async function activateByKey(key: string, userId: string) {
  const l = await sqlOne<{ id: string }>("SELECT id FROM licences WHERE key_hash=$1", [keyHash(key)]);
  if (!l) {
    await logEvent(null, userId, userId, "licence.activate.refused", { reason: "unknown_key" });
    throw new LicenceError(404, "Clé de licence inconnue", "lic.err.notFound");
  }
  await activate(l.id, userId, userId);
}

/** Attribution manuelle par l'administrateur. */
export const assignLicence = (licenceId: string, userId: string, actorId: string) => activate(licenceId, userId, actorId);

export async function revokeLicence(licenceId: string, actorId: string, reason: string | null) {
  const rows = await sql("UPDATE licences SET status='revoked', revoked_at=now(), integrity=NULL WHERE id=$1 AND status<>'revoked' RETURNING id", [licenceId]);
  if (!rows.length) throw new LicenceError(404, "Licence introuvable ou déjà révoquée", "lic.err.notFound");
  await sql("UPDATE licence_activations SET deactivated_at=now() WHERE licence_id=$1 AND deactivated_at IS NULL", [licenceId]);
  forgetEntitlements();
  await logEvent(licenceId, null, actorId, "licence.revoke", { reason });
}

export async function deactivateSeat(licenceId: string, userId: string, actorId: string) {
  const rows = await sql("UPDATE licence_activations SET deactivated_at=now() WHERE licence_id=$1 AND user_id=$2 AND deactivated_at IS NULL RETURNING id", [licenceId, userId]);
  if (!rows.length) throw new LicenceError(404, "Aucune activation ouverte pour ce compte", "lic.err.notFound");
  forgetEntitlements();
  await logEvent(licenceId, userId, actorId, "licence.deactivate", {});
}

/** Renouvellement : prolonge l'échéance de `days` jours (à partir de l'échéance actuelle ou d'aujourd'hui). */
export async function renewLicence(licenceId: string, days: number, actorId: string) {
  const l = await sqlOne<{ id: string; status: string; seats: number; activated_at: string | null; expires_at: string | null; integrity: string | null; duration_days: number }>(
    "SELECT id, status, seats, activated_at, expires_at, integrity, duration_days FROM licences WHERE id=$1", [licenceId]);
  if (!l) throw new LicenceError(404, "Licence introuvable", "lic.err.notFound");
  if (l.status === "revoked") throw new LicenceError(409, "Licence révoquée", "lic.err.revoked");
  if (l.status === "issued") {
    await sql("UPDATE licences SET duration_days=duration_days+$2 WHERE id=$1", [licenceId, days]);
  } else {
    if (!sameTag(l.integrity, licenceTag(l))) throw new LicenceError(409, "Licence altérée : renouvellement refusé", "lic.err.tampered");
    const base = Math.max(new Date(l.expires_at!).getTime(), Date.now());
    const exp = new Date(base + days * 86400_000).toISOString();
    await sql("UPDATE licences SET expires_at=$2, integrity=$3 WHERE id=$1", [licenceId, exp, licenceTag({ ...l, expires_at: exp })]);
  }
  forgetEntitlements();
  await logEvent(licenceId, null, actorId, "licence.renew", { days });
}

/** Suspension réversible (l'intégrité est vérifiée avant, recalculée à la reprise). */
export async function suspendLicence(licenceId: string, actorId: string, reason: string | null) {
  const l = await sqlOne<{ id: string; status: string; seats: number; activated_at: string | null; expires_at: string | null; integrity: string | null }>("SELECT id, status, seats, activated_at, expires_at, integrity FROM licences WHERE id=$1", [licenceId]);
  if (!l || l.status !== "active") throw new LicenceError(409, "Seule une licence active peut être suspendue", "lic.err.notActive");
  if (!sameTag(l.integrity, licenceTag(l))) throw new LicenceError(409, "Licence altérée : contactez l'administrateur", "lic.err.tampered");
  // L'étiquette couvre le statut : remettre « active » directement en base est détecté comme une altération.
  await sql("UPDATE licences SET status='suspended', integrity=$2 WHERE id=$1", [licenceId, licenceTag({ ...l, status: "suspended" })]);
  forgetEntitlements();
  await logEvent(licenceId, null, actorId, "licence.suspend", { reason });
}
export async function resumeLicence(licenceId: string, actorId: string) {
  const l = await sqlOne<{ id: string; status: string; seats: number; activated_at: string | null; expires_at: string | null; integrity: string | null }>("SELECT id, status, seats, activated_at, expires_at, integrity FROM licences WHERE id=$1", [licenceId]);
  if (!l || l.status !== "suspended") throw new LicenceError(409, "Licence non suspendue", "lic.err.notSuspended");
  if (!sameTag(l.integrity, licenceTag(l))) throw new LicenceError(409, "Licence altérée : contactez l'administrateur", "lic.err.tampered");
  await sql("UPDATE licences SET status='active', integrity=$2 WHERE id=$1", [licenceId, licenceTag({ ...l, status: "active" })]);
  forgetEntitlements();
  await logEvent(licenceId, null, actorId, "licence.resume", {});
}

/** Routes accessibles sans essai ni licence valide (compte, licence, guides, authentification, administration). */
export const LICENCE_FREE_PREFIXES = ["/api/me", "/api/auth/", "/api/licence", "/api/guides", "/api/admin/", "/api/notifications", "/api/i18n/", "/api/installation"];
export const licenceFree = (pathname: string) => LICENCE_FREE_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
