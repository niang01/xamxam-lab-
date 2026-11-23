/**
 * Comptes : administrateur principal, jetons à usage unique (réinitialisation, vérification d'adresse),
 * verrouillage après échecs de connexion.
 *
 * Initialisation du premier administrateur (aucun mot de passe codé en dur) :
 *  1. voie normale — l'adresse figure dans XX_ADMIN_EMAILS : le compte est administrateur à l'inscription,
 *     ou promu à sa prochaine connexion s'il existait déjà ;
 *  2. voie de secours, seulement tant qu'AUCUN administrateur n'existe — un code d'initialisation est écrit dans
 *     les journaux du serveur (visibles uniquement par le propriétaire de l'hébergement) à chaque démarrage ;
 *     saisi sur /installation par un compte connecté, il le rend administrateur. Il devient inutilisable dès
 *     qu'un administrateur existe.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql, sqlOne } from "./db";
import { env } from "./env";
import { audit } from "./audit";
import { randomToken, sha256 } from "./security/crypto";
import { cachedSessionSecret } from "./keys";

export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;

/** Promotion d'un compte dont l'adresse est déclarée dans XX_ADMIN_EMAILS. */
export async function promoteConfiguredAdmin(userId: string, email: string): Promise<boolean> {
  if (!env.adminEmails.includes(email.toLowerCase())) return false;
  const rows = await sql<{ id: string }>("UPDATE users SET is_admin=true, profile_kind='administrator', updated_at=now() WHERE id=$1 AND is_admin=false RETURNING id", [userId]);
  if (rows.length) await audit(userId, "system", "account.admin.promote", { kind: "user", id: userId }, { via: "XX_ADMIN_EMAILS" });
  return rows.length > 0;
}

export async function adminExists(): Promise<boolean> {
  return !!(await sqlOne("SELECT 1 FROM users WHERE is_admin AND status='active' LIMIT 1"));
}

/** Code d'initialisation stable pour une clé de session donnée (HMAC), au format XXXX-XXXX-XXXX-XXXX-XXXX. */
export function adminSetupCode(): string | null {
  const secret = cachedSessionSecret();
  if (!secret) return null;
  const raw = createHmac("sha256", secret).update("xamxam-admin-setup-v1").digest("base64url").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
  return raw.match(/.{4}/g)!.join("-");
}

let announced = false;
/** Écrit le code dans les journaux du serveur, une fois par démarrage, tant qu'aucun administrateur n'existe. */
export async function announceAdminSetup(): Promise<void> {
  if (announced) return;
  announced = true;
  if (await adminExists()) return;
  const code = adminSetupCode();
  if (!code) return;
  console.log(`[xamxam] Aucun administrateur. ${env.adminEmails.length ? "Adresses autorisées par XX_ADMIN_EMAILS : créez le compte avec l'une d'elles. " : ""}Code d'initialisation de l'administrateur principal : ${code} — à saisir sur /installation après connexion. Ce code ne fonctionne plus dès qu'un administrateur existe.`);
}

export async function claimAdmin(userId: string, code: string): Promise<void> {
  const expected = adminSetupCode();
  const given = code.trim().toUpperCase();
  const a = Buffer.from(given), b = Buffer.from(expected ?? "");
  if (await adminExists()) throw Object.assign(new Error("Un administrateur existe déjà : demandez-lui les droits."), { code: "exists" });
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) throw Object.assign(new Error("Code d'initialisation incorrect"), { code: "bad" });
  await sql("UPDATE users SET is_admin=true, profile_kind='administrator', updated_at=now() WHERE id=$1", [userId]);
  await audit(userId, "human", "account.admin.bootstrap", { kind: "user", id: userId }, { via: "setup_code" });
}

export type TokenKind = "password_reset" | "email_verify";
const LIFETIME_H: Record<TokenKind, number> = { password_reset: 1, email_verify: 48 };

/** Crée un jeton à usage unique ; renvoie la valeur en clair (à transmettre une seule fois). */
export async function issueToken(kind: TokenKind, userId: string, createdBy: string | null = null, hours = LIFETIME_H[kind]): Promise<{ token: string; expires_at: string }> {
  // Un seul jeton valide par compte et par usage.
  await sql("UPDATE auth_tokens SET used_at=now() WHERE user_id=$1 AND kind=$2 AND used_at IS NULL", [userId, kind]);
  const token = randomToken(32);
  const row = (await sql<{ expires_at: string }>(
    `INSERT INTO auth_tokens(kind, user_id, token_hash, expires_at, created_by) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval, $5) RETURNING expires_at`,
    [kind, userId, sha256(token), String(hours), createdBy]))[0];
  return { token, expires_at: new Date(row.expires_at).toISOString() };
}

/** Consomme un jeton (usage unique) ; renvoie l'identifiant du compte, ou null s'il est invalide, expiré ou déjà utilisé. */
export async function consumeToken(kind: TokenKind, token: string): Promise<string | null> {
  const row = await sqlOne<{ user_id: string }>(
    "UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1 AND kind=$2 AND used_at IS NULL AND expires_at > now() RETURNING user_id", [sha256(token), kind]);
  return row?.user_id ?? null;
}
