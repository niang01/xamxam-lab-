/**
 * Base de données XAM-XAM LAB.
 *  - PostgreSQL 16 si DATABASE_URL est défini (production) ;
 *  - sinon PGlite (PostgreSQL compilé en WebAssembly) dans PGLITE_DIR, ou en mémoire pour les tests.
 * Les migrations `db/migrations/NNNN_*.sql` sont appliquées une seule fois, chacune dans une transaction,
 * et inscrites dans `xx_migrations`.
 */
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { env } from "./env";
import { seed } from "./seed";
import { loadServerKeys } from "./keys";

export type Row = Record<string, unknown>;
export interface Queryable { query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
export interface Db extends Queryable { driver: "postgres" | "pglite" | "pglite-memory"; exec(sql: string): Promise<void>; close(): Promise<void> }

/** Types renvoyés en valeurs JS simples : DATE → « AAAA-MM-JJ », BIGINT et NUMERIC → number. */
const TYPE_DATE = 1082, TYPE_INT8 = 20, TYPE_NUMERIC = 1700;

async function openPglite(dir: string | null): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dir) mkdirSync(dir, { recursive: true });
  const parsers = { [TYPE_DATE]: (v: string) => v, [TYPE_INT8]: Number, [TYPE_NUMERIC]: Number };
  const pg = dir ? new PGlite(dir, { parsers }) : new PGlite({ parsers });
  await pg.waitReady;
  return {
    driver: dir ? "pglite" : "pglite-memory",
    query: async <T,>(sql: string, params: unknown[] = []) => ({ rows: (await pg.query<T>(sql, params)).rows }),
    exec: async (sql) => { await pg.exec(sql); },
    close: () => pg.close(),
  };
}

/**
 * Paramètres TLS explicites (indépendants des interprétations de « sslmode » selon les versions de pg) :
 * sslmode=require|verify-ca|verify-full → TLS AVEC vérification du certificat (hébergeurs publics : Neon, etc.) ;
 * DB_TLS_ALLOW_SELF_SIGNED=true seulement pour un serveur interne à certificat auto-signé. Sans sslmode : pas de TLS
 * (réseau privé Docker). channel_binding=require → liaison de canal SCRAM-SHA-256-PLUS.
 */
export function postgresConnection(url: string): { connectionString: string; ssl?: { rejectUnauthorized: boolean }; enableChannelBinding?: boolean } {
  const u = new URL(url);
  const mode = u.searchParams.get("sslmode");
  const binding = u.searchParams.get("channel_binding");
  u.searchParams.delete("sslmode"); u.searchParams.delete("channel_binding");
  const tls = mode != null && ["require", "verify-ca", "verify-full"].includes(mode);
  return {
    connectionString: u.toString(),
    ...(tls ? { ssl: { rejectUnauthorized: process.env.DB_TLS_ALLOW_SELF_SIGNED !== "true" } } : {}),
    ...(binding === "require" ? { enableChannelBinding: true } : {}),
  };
}

async function openPostgres(url: string): Promise<Db> {
  const pg = await import("pg");
  pg.types.setTypeParser(TYPE_DATE, (v: string) => v);
  pg.types.setTypeParser(TYPE_INT8, Number);
  pg.types.setTypeParser(TYPE_NUMERIC, Number);
  const pool = new pg.Pool({ max: Number(process.env.DB_POOL_SIZE ?? 10), ...postgresConnection(url) });
  return {
    driver: "postgres",
    query: async <T,>(sql: string, params: unknown[] = []) => ({ rows: (await pool.query(sql, params)).rows as T[] }),
    exec: async (sql) => { await pool.query(sql); },
    close: () => pool.end(),
  };
}

export const migrationsDir = () => join(/* turbopackIgnore: true */ process.cwd(), "db", "migrations");

export async function migrate(db: Db): Promise<string[]> {
  await db.exec("CREATE TABLE IF NOT EXISTS xx_migrations (file TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const done = new Set((await db.query<{ file: string }>("SELECT file FROM xx_migrations")).rows.map((r) => r.file));
  const pending = readdirSync(migrationsDir()).filter((f) => /^\d{4}_.+\.sql$/.test(f) && !done.has(f)).sort();
  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir(), file), "utf8");
    await db.exec(`BEGIN;\n${sql}\nINSERT INTO xx_migrations(file) VALUES ('${file.replace(/'/g, "")}');\nCOMMIT;`);
  }
  return pending;
}

export function openDb(): Promise<Db> {
  if (env.dbDriver === "postgres") {
    if (!env.databaseUrl) throw new Error("DATABASE_URL est requis avec DB_DRIVER=postgres");
    return openPostgres(env.databaseUrl);
  }
  return openPglite(env.dbDriver === "pglite-memory" ? null : env.pgliteDir);
}

const holder = globalThis as unknown as { __xamxamDb?: Promise<Db> };

/** Connexion partagée du processus ; migrations et données de référence appliquées à la première ouverture. */
export function getDb(): Promise<Db> {
  holder.__xamxamDb ??= (async () => { const db = await openDb(); await migrate(db); await seed(db); await loadServerKeys(db); return db; })()
    .catch((e) => { holder.__xamxamDb = undefined; throw e; });
  return holder.__xamxamDb;
}

export async function closeDb() {
  const p = holder.__xamxamDb;
  holder.__xamxamDb = undefined;
  if (p) await (await p).close().catch(() => undefined);
}

/** Exécute une requête paramétrée et renvoie toutes les lignes. */
export async function sql<T = Row>(text: string, params: unknown[] = []): Promise<T[]> { return (await (await getDb()).query<T>(text, params)).rows; }
/** Première ligne du résultat, ou null. */
export async function sqlOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> { return (await sql<T>(text, params))[0] ?? null; }
