/**
 * Mots de passe à usage unique basés sur le temps (TOTP, RFC 6238 sur HOTP, RFC 4226) — fonctions pures.
 * Paramètres compatibles avec toutes les applications d'authentification : HMAC-SHA-1, 6 chiffres, pas de 30 s.
 * Utilisé côté serveur uniquement (module node:crypto).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_S = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error(`Caractère base32 invalide : ${ch}`);
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226 § 5.3) : troncature dynamique du HMAC du compteur sur 8 octets. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm, secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const timeStep = (unixSeconds: number, period = TOTP_PERIOD_S) => Math.floor(unixSeconds / period);

export function totp(secret: Buffer, unixSeconds: number, digits = TOTP_DIGITS, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  return hotp(secret, timeStep(unixSeconds), digits, algorithm);
}

/**
 * Vérifie un code dans une fenêtre de ±`window` pas (décalage d'horloge du téléphone).
 * Renvoie le pas accepté, ou null. `afterStep` : dernier pas déjà utilisé (anti-rejeu : un code ne sert qu'une fois).
 */
export function verifyTotp(secret: Buffer, code: string, unixSeconds: number, opts: { window?: number; afterStep?: number | null } = {}): number | null {
  const candidate = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return null;
  const now = timeStep(unixSeconds);
  const w = opts.window ?? 1;
  for (let step = now - w; step <= now + w; step++) {
    if (opts.afterStep != null && step <= opts.afterStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(candidate))) return step;
  }
  return null;
}

/** URI « otpauth » lue par les applications d'authentification (QR code). */
export function otpauthUri(secretBase32: string, account: string, issuer = "XAM-XAM LAB"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_S) });
  return `otpauth://totp/${label}?${q}`;
}

/** Codes de secours lisibles : 10 caractères en deux groupes (ex. « K7Q2M-9XA4T »), alphabet sans caractères ambigus. */
export function formatRecoveryCode(bytes: Uint8Array): string {
  const s = base32Encode(bytes).replace(/[01]/g, "").slice(0, 10).padEnd(10, "Z");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z2-7]/g, "");
