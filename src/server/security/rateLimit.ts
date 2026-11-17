/**
 * Limitation de débit par compteur à seau (token bucket) en mémoire du processus.
 * Pour plusieurs instances, remplacer par un magasin partagé (Redis). Clé = compartiment + adresse.
 */
interface Bucket { tokens: number; updated: number }
const buckets = new Map<string, Bucket>();

/** `max` requêtes par fenêtre `windowMs`, recharge continue. */
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  const refillPerMs = max / windowMs;
  const b = buckets.get(key) ?? { tokens: max, updated: now };
  b.tokens = Math.min(max, b.tokens + (now - b.updated) * refillPerMs);
  b.updated = now;
  if (b.tokens < 1) { buckets.set(key, b); return { ok: false, retryAfterS: Math.ceil((1 - b.tokens) / refillPerMs / 1000) }; }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 20_000) for (const [k, v] of buckets) if (now - v.updated > windowMs) buckets.delete(k);
  return { ok: true, retryAfterS: 0 };
}

/** Adresse du client : dernière valeur de X-Forwarded-For (ajoutée par le mandataire de confiance), sinon X-Real-IP. */
export function callerAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) { const list = forwarded.split(",").map((s) => s.trim()).filter(Boolean); if (list.length) return list[list.length - 1]; }
  return req.headers.get("x-real-ip")?.trim() || "local";
}
