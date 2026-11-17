/**
 * Jetons de session XAM-XAM LAB : « xx1.<charge base64url>.<HMAC-SHA256 base64url> ».
 * Web Crypto uniquement (utilisable dans proxy.ts et dans les routes). `ver` = version de session du compte :
 * l'incrémenter (désactivation, nouveau mot de passe) révoque immédiatement tous les jetons existants.
 */
export const SESSION_COOKIE = "xx_session";
const PREFIX = "xx1";

export interface SessionPayload { sub: string; exp: number; ver: number }

const utf8 = new TextEncoder();
const toB64u = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

const keys = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string) {
  let k = keys.get(secret);
  if (!k) { k = crypto.subtle.importKey("raw", utf8.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); keys.set(secret, k); }
  return k;
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = toB64u(utf8.encode(JSON.stringify(payload)));
  const signed = `${PREFIX}.${body}`;
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), utf8.encode(signed)));
  return `${signed}.${toB64u(mac)}`;
}

export async function verifySession(token: string | null | undefined, secret: string | null): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64u(parts[2]) as BufferSource, utf8.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(parts[1]))) as Partial<SessionPayload>;
    if (typeof p.sub !== "string" || typeof p.exp !== "number" || typeof p.ver !== "number" || p.exp * 1000 < Date.now()) return null;
    return p as SessionPayload;
  } catch { return null; }
}
