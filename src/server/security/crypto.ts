/**
 * Primitives cryptographiques de XAM-XAM LAB (Node.js crypto) :
 *  - mots de passe : scrypt, sel aléatoire de 16 octets, format « xxs1:<N>:<sel>:<empreinte> » ;
 *  - jetons : 32 octets aléatoires (base64url) ; seule leur empreinte SHA-256 est stockée ;
 *  - comparaisons à temps constant.
 */
import { encryptionMasters } from "../keys";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export class ConfigError extends Error {}

const SCRYPT = { N: 1 << 14, r: 8, p: 1, keylen: 64 } as const;

export const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export const randomToken = (size = 32) => randomBytes(size).toString("base64url");

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const digest = scryptSync(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["xxs1", SCRYPT.N, salt.toString("base64url"), digest.toString("base64url")].join(":");
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "xxs1") return false;
  const n = Number(parts[1]);
  if (!Number.isInteger(n) || n < 1024 || n > 1 << 20) return false;
  const expected = Buffer.from(parts[3], "base64url");
  const actual = scryptSync(password.normalize("NFKC"), Buffer.from(parts[2], "base64url"), expected.length, { N: n, r: SCRYPT.r, p: SCRYPT.p, maxmem: 256 * n * SCRYPT.r });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Chiffrement de données sensibles au repos (ex. secret TOTP) : AES-256-GCM, nonce aléatoire de 12 octets.
 * Clé dérivée par HKDF-SHA-256 de XX_ENCRYPTION_KEY (ou, à défaut, de SESSION_SECRET), avec un contexte par usage.
 * Format : « xxe1:<nonce>:<données>:<étiquette> » (base64url).
 */

function deriveKey(master: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, "xamxam-lab", `xx-data-key:${purpose}`, 32));
}

/** Clés candidates : XX_ENCRYPTION_KEY, sinon clé générée en base ; les anciennes restent utilisables en lecture. */
function dataKeys(purpose: string): Buffer[] {
  const masters = encryptionMasters();
  if (!masters.length) throw new ConfigError("Clé de chiffrement indisponible (XX_ENCRYPTION_KEY absent et base non ouverte)");
  return masters.map((m) => deriveKey(m, purpose));
}

export function encryptSecret(plain: Buffer, purpose: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKeys(purpose)[0], nonce);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return ["xxe1", nonce.toString("base64url"), data.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(":");
}

export function decryptSecret(stored: string, purpose: string): Buffer {
  const [tag, nonce, data, auth] = stored.split(":");
  if (tag !== "xxe1" || !nonce || !data || !auth) throw new Error("Format chiffré inconnu");
  let last: unknown = null;
  for (const key of dataKeys(purpose)) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
      decipher.setAuthTag(Buffer.from(auth, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("Déchiffrement impossible");
}
