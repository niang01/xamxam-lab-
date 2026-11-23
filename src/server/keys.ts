/**
 * Clés du serveur XAM-XAM LAB.
 *
 * Priorité aux variables d'environnement (SESSION_SECRET, XX_ENCRYPTION_KEY). Si l'hébergeur ne les fournit pas
 * (cas d'un service Render créé à la main), une clé aléatoire de 48 octets est générée UNE fois, conservée dans la
 * table `server_keys` de la base PostgreSQL du projet (accès réservé au serveur), puis réutilisée à chaque démarrage :
 * les sessions et les secrets chiffrés survivent aux redémarrages. Aucune clé n'est jamais renvoyée par l'API.
 */
import { randomBytes } from "node:crypto";
import type { Db } from "./db";

export type KeySource = "environment" | "database" | "development" | "missing";
interface Loaded { session: string | null; encryption: string | null; sessionSource: KeySource; encryptionSource: KeySource; dbEncryption: string | null }

const holder = globalThis as unknown as { __xxKeys?: Loaded };
const DEV = "xamxam-dev-secret-not-for-production";
const envValue = (name: string) => { const v = process.env[name]; return v && v.length >= 16 ? v : null; };

async function stored(db: Db, name: string): Promise<string> {
  await db.query("INSERT INTO server_keys(name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", [name, randomBytes(48).toString("base64url")]);
  return (await db.query<{ value: string }>("SELECT value FROM server_keys WHERE name=$1", [name])).rows[0].value;
}

/** Charge (ou crée) les clés ; appelé par getDb() après les migrations. */
export async function loadServerKeys(db: Db): Promise<void> {
  await loadIntegrityKey(db);
  const production = process.env.NODE_ENV === "production";
  const envSession = envValue("SESSION_SECRET");
  const envEnc = envValue("XX_ENCRYPTION_KEY");
  // En développement et en test sans variable : valeur locale fixe (comportement antérieur, signalé dans /api/health).
  if (!production && !envSession) {
    holder.__xxKeys = { session: DEV, encryption: envEnc ?? DEV, sessionSource: "development", encryptionSource: envEnc ? "environment" : "development", dbEncryption: null };
    return;
  }
  const dbSession = envSession ? null : await stored(db, "session_secret");
  const dbEnc = await (async () => { try { return (await db.query<{ value: string }>("SELECT value FROM server_keys WHERE name='encryption_key'")).rows[0]?.value ?? null; } catch { return null; } })()
    ?? (envEnc ? null : await stored(db, "encryption_key"));
  holder.__xxKeys = {
    session: envSession ?? dbSession,
    sessionSource: envSession ? "environment" : "database",
    encryption: envEnc ?? dbEnc,
    encryptionSource: envEnc ? "environment" : "database",
    dbEncryption: dbEnc,
  };
}

/** Clé de signature des sessions (null tant que la base n'est pas ouverte en production). */
export function cachedSessionSecret(): string | null {
  const k = holder.__xxKeys;
  if (k) return k.session;
  const e = envValue("SESSION_SECRET");
  if (e) return e;
  return process.env.NODE_ENV === "production" ? null : DEV;
}

/** Clés maîtresses de chiffrement candidates, dans l'ordre d'essai (la première sert à chiffrer). */
export function encryptionMasters(): string[] {
  const k = holder.__xxKeys;
  const out: string[] = [];
  const e = envValue("XX_ENCRYPTION_KEY");
  if (e) out.push(e);
  if (k?.dbEncryption && !out.includes(k.dbEncryption)) out.push(k.dbEncryption);
  if (k?.encryption && !out.includes(k.encryption)) out.push(k.encryption);
  // Compatibilité : secrets chiffrés auparavant avec une clé dérivée de SESSION_SECRET.
  const s = envValue("SESSION_SECRET");
  if (s && !out.includes(s)) out.push(s);
  if (!out.length && process.env.NODE_ENV !== "production") out.push(DEV);
  return out;
}

export function keySources(): { session: KeySource; encryption: KeySource } {
  const k = holder.__xxKeys;
  if (k) return { session: k.sessionSource, encryption: k.encryptionSource };
  return { session: envValue("SESSION_SECRET") ? "environment" : process.env.NODE_ENV === "production" ? "missing" : "development", encryption: envValue("XX_ENCRYPTION_KEY") ? "environment" : "missing" };
}

/** Clé d'intégrité (essais et licences) : toujours générée et conservée en base, indépendante de l'environnement. */
export async function loadIntegrityKey(db: Db) {
  await db.query("INSERT INTO server_keys(name, value) VALUES ('integrity_key', $1) ON CONFLICT (name) DO NOTHING", [randomBytes(48).toString("base64url")]);
  integrity.key = (await db.query<{ value: string }>("SELECT value FROM server_keys WHERE name='integrity_key'")).rows[0].value;
}
const integrity = { get key() { return (globalThis as { __xxIntegrityKey?: string }).__xxIntegrityKey; }, set key(v: string | undefined) { (globalThis as { __xxIntegrityKey?: string }).__xxIntegrityKey = v; } };
export function integrityKey(): string {
  if (!integrity.key) throw new Error("Clé d'intégrité non chargée (base non ouverte)");
  return integrity.key;
}

/** Pour les tests : oublie les clés chargées. */
export function resetServerKeys() { holder.__xxKeys = undefined; }
