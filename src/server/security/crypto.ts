/**
 * Primitives cryptographiques de XAM-XAM LAB (Node.js crypto) :
 *  - mots de passe : scrypt, sel aléatoire de 16 octets, format « xxs1:<N>:<sel>:<empreinte> » ;
 *  - jetons : 32 octets aléatoires (base64url) ; seule leur empreinte SHA-256 est stockée ;
 *  - comparaisons à temps constant.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
