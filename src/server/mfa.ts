/** Double authentification (TOTP) : activation, vérification avec anti-rejeu, codes de secours, défis de connexion. */
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { sql, sqlOne } from "./db";
import { ApiFailure } from "./api";
import { decryptSecret, encryptSecret, randomToken, sha256 } from "./security/crypto";
import { base32Encode, formatRecoveryCode, normalizeRecoveryCode, otpauthUri, verifyTotp } from "@/lib/totp";

const PURPOSE = "totp";
const RECOVERY_COUNT = 10;
const CHALLENGE_TTL_S = 300;
const CHALLENGE_MAX_ATTEMPTS = 5;

type MfaRow = { secret_enc: string; enabled: boolean; last_step: string | number | null };

export async function mfaState(userId: string) {
  const r = await sqlOne<{ enabled: boolean; enabled_at: string | null; remaining: number }>(`SELECT COALESCE(m.enabled, false) AS enabled, m.enabled_at,
      (SELECT COUNT(*)::int FROM user_recovery_codes c WHERE c.user_id=$1 AND c.used_at IS NULL) AS remaining
    FROM (SELECT $1::uuid AS id) u LEFT JOIN user_mfa m ON m.user_id=u.id`, [userId]);
  return { enabled: !!r?.enabled, enabled_at: r?.enabled_at ?? null, recovery_remaining: r?.remaining ?? 0 };
}

export const isMfaEnabled = async (userId: string) => (await mfaState(userId)).enabled;

/** Prépare l'activation : nouveau secret (non actif tant qu'un premier code n'a pas été vérifié). */
export async function beginSetup(userId: string, email: string) {
  if (await isMfaEnabled(userId)) throw new ApiFailure(409, "Double authentification déjà active", "mfa.err.already");
  const secret = randomBytes(20);
  const b32 = base32Encode(secret);
  await sql(`INSERT INTO user_mfa(user_id, secret_enc, enabled) VALUES ($1,$2,false)
    ON CONFLICT (user_id) DO UPDATE SET secret_enc=EXCLUDED.secret_enc, enabled=false, enabled_at=NULL, last_step=NULL`, [userId, encryptSecret(secret, PURPOSE)]);
  const uri = otpauthUri(b32, email);
  const qr = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return { secret: b32.replace(/(.{4})/g, "$1 ").trim(), uri, qr };
}

/** Vérifie un code TOTP et le consomme (un même pas ne peut servir deux fois). */
async function consumeTotp(userId: string, code: string, requireEnabled: boolean): Promise<boolean> {
  const m = await sqlOne<MfaRow>("SELECT secret_enc, enabled, last_step FROM user_mfa WHERE user_id=$1", [userId]);
  if (!m || (requireEnabled && !m.enabled)) return false;
  const step = verifyTotp(decryptSecret(m.secret_enc, PURPOSE), code, Date.now() / 1000, { afterStep: m.last_step === null ? null : Number(m.last_step) });
  if (step === null) return false;
  const won = await sql("UPDATE user_mfa SET last_step=$2 WHERE user_id=$1 AND (last_step IS NULL OR last_step < $2) RETURNING 1", [userId, step]);
  return won.length === 1;
}

async function consumeRecovery(userId: string, code: string): Promise<boolean> {
  const hash = sha256(normalizeRecoveryCode(code));
  const r = await sql("UPDATE user_recovery_codes SET used_at=now() WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING 1", [userId, hash]);
  return r.length === 1;
}

async function newRecoveryCodes(userId: string): Promise<string[]> {
  await sql("DELETE FROM user_recovery_codes WHERE user_id=$1", [userId]);
  const codes = Array.from({ length: RECOVERY_COUNT }, () => formatRecoveryCode(randomBytes(8)));
  for (const c of codes) await sql("INSERT INTO user_recovery_codes(user_id, code_hash) VALUES ($1,$2)", [userId, sha256(normalizeRecoveryCode(c))]);
  return codes;
}

/** Active après vérification d'un premier code ; renvoie les codes de secours (affichés une seule fois). */
export async function enable(userId: string, code: string): Promise<string[]> {
  if (await isMfaEnabled(userId)) throw new ApiFailure(409, "Double authentification déjà active", "mfa.err.already");
  if (!(await consumeTotp(userId, code, false))) throw new ApiFailure(400, "Code incorrect", "mfa.err.code");
  await sql("UPDATE user_mfa SET enabled=true, enabled_at=now() WHERE user_id=$1", [userId]);
  return newRecoveryCodes(userId);
}

/** Second facteur : code TOTP ou code de secours (à usage unique). */
export async function verifySecondFactor(userId: string, input: { code?: string | null; recovery_code?: string | null }): Promise<"totp" | "recovery" | null> {
  if (input.code && (await consumeTotp(userId, input.code, true))) return "totp";
  if (input.recovery_code && (await consumeRecovery(userId, input.recovery_code))) return "recovery";
  return null;
}

export async function disable(userId: string) {
  await sql("DELETE FROM user_mfa WHERE user_id=$1", [userId]);
  await sql("DELETE FROM user_recovery_codes WHERE user_id=$1", [userId]);
}

export const regenerateRecovery = newRecoveryCodes;

export async function createChallenge(userId: string): Promise<string> {
  await sql("DELETE FROM mfa_challenges WHERE user_id=$1 OR expires_at < now()", [userId]);
  const token = randomToken();
  await sql(`INSERT INTO mfa_challenges(token_hash, user_id, expires_at) VALUES ($1,$2, now() + make_interval(secs => $3))`, [sha256(token), userId, CHALLENGE_TTL_S]);
  return token;
}

/** Défi valide (non expiré, essais restants) → identifiant de l'utilisateur ; chaque appel compte un essai. */
export async function useChallenge(token: string): Promise<{ userId: string; hash: string } | null> {
  const hash = sha256(token);
  const c = await sqlOne<{ user_id: string }>(`UPDATE mfa_challenges SET attempts=attempts+1
    WHERE token_hash=$1 AND expires_at > now() AND attempts < $2 RETURNING user_id`, [hash, CHALLENGE_MAX_ATTEMPTS]);
  return c ? { userId: c.user_id, hash } : null;
}

export const endChallenge = (hash: string) => sql("DELETE FROM mfa_challenges WHERE token_hash=$1", [hash]);
