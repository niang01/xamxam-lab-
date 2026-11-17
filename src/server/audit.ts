/** Journal d'audit en ajout seul, chaîné par empreintes SHA-256 (toute modification d'une ligne casse la chaîne). */
import crypto from "node:crypto";
import { sql, sqlOne } from "./db";

export type ActorKind = "human" | "ai" | "device" | "system";

let chain: Promise<unknown> = Promise.resolve();

/** JSON canonique (clés triées) : JSONB réordonne les clés, l'empreinte doit rester stable. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

export function auditHash(prev: string | null, e: { actor_id: string | null; actor_kind: string; action: string; object_kind: string | null; object_id: string | null; details: unknown; created_at: string }) {
  return crypto.createHash("sha256").update(canonical([prev, e.actor_id, e.actor_kind, e.action, e.object_kind, e.object_id, e.details, e.created_at])).digest("hex");
}

export function audit(actorId: string | null, actorKind: ActorKind, action: string, object?: { kind: string; id: string } | null, details: Record<string, unknown> = {}) {
  // Sérialisé pour garantir un chaînage cohérent dans un même processus.
  const p = chain.then(async () => {
    const prev = await sqlOne<{ hash: string }>("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1");
    const created_at = new Date().toISOString();
    const e = { actor_id: actorId, actor_kind: actorKind, action, object_kind: object?.kind ?? null, object_id: object?.id ?? null, details, created_at };
    const hash = auditHash(prev?.hash ?? null, e);
    await sql(`INSERT INTO audit_log(actor_id, actor_kind, action, object_kind, object_id, details, prev_hash, hash, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [actorId, actorKind, action, e.object_kind, e.object_id, JSON.stringify(details), prev?.hash ?? null, hash, created_at]);
  });
  chain = p.catch(() => undefined);
  return p;
}

/** Vérifie l'intégrité de la chaîne ; renvoie l'identifiant de la première ligne altérée. */
export async function verifyAuditChain(): Promise<{ ok: boolean; checked: number; brokenAt: number | null }> {
  const rows = await sql<{ id: number; actor_id: string | null; actor_kind: string; action: string; object_kind: string | null; object_id: string | null; details: unknown; prev_hash: string | null; hash: string; created_at: string | Date }>(
    "SELECT * FROM audit_log ORDER BY id");
  let prev: string | null = null;
  for (const r of rows) {
    const created_at = new Date(r.created_at).toISOString();
    const h = auditHash(prev, { ...r, created_at });
    if (r.prev_hash !== prev || h !== r.hash) return { ok: false, checked: rows.length, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length, brokenAt: null };
}
