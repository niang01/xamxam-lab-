/**
 * Sauvegarde et restauration de XAM-XAM LAB (format JSON portable : PostgreSQL ⇄ PGlite).
 * - Export : toutes les tables métier, dans l'ordre des dépendances, avec la liste des migrations appliquées.
 * - Restauration : uniquement dans une base sans compte utilisateur (jamais d'écrasement de données existantes),
 *   en une transaction, puis réalignement des compteurs (BIGSERIAL) et contrôle de la chaîne d'audit.
 */
import crypto from "node:crypto";
import type { Db } from "./db";
import { canonical } from "./audit";

/**
 * Ordre d'insertion compatible avec les clés étrangères. Exclues : visioconférence et défis de connexion (éphémères).
 * Le secret TOTP reste chiffré : la restauration exige la même XX_ENCRYPTION_KEY (ou SESSION_SECRET).
 */
export const BACKUP_TABLES = [
  "users", "clearances", "projects", "project_members", "project_tasks", "project_messages", "schematics", "schematic_versions",
  "calc_runs", "normative_tables", "components", "simulations", "ai_agents", "ai_conversations", "ai_messages", "ai_steps", "ai_memory",
  "devices", "measurements", "device_commands", "automations", "automation_runs", "rc_sessions", "rc_events", "geo_requests", "geo_observations",
  "courses", "enrollments", "certificates", "eco_items", "eco_links",
  "market_listings", "market_inquiries", "market_messages", "market_favorites", "market_reports",
  "user_mfa", "user_recovery_codes",
  "translations", "notifications", "settings", "audit_log",
] as const;
const SERIAL: [string, string][] = [["measurements", "id"], ["rc_events", "id"], ["audit_log", "id"]];

export interface Backup { format: "xamxam-backup-v1"; created_at: string; migrations: string[]; tables: Record<string, Record<string, unknown>[]>; checksum: string }

const digest = (tables: Backup["tables"]) => crypto.createHash("sha256").update(canonical(tables)).digest("hex");

export async function exportBackup(db: Db): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const t of BACKUP_TABLES) tables[t] = (await db.query<Record<string, unknown>>(`SELECT * FROM ${t}`)).rows.map((r) => JSON.parse(JSON.stringify(r)));
  const migrations = (await db.query<{ file: string }>("SELECT file FROM xx_migrations ORDER BY file")).rows.map((r) => r.file);
  return { format: "xamxam-backup-v1", created_at: new Date().toISOString(), migrations, tables, checksum: digest(tables) };
}

export async function restoreBackup(db: Db, b: Backup): Promise<Record<string, number>> {
  if (b?.format !== "xamxam-backup-v1") throw new Error("Format de sauvegarde inconnu");
  if (digest(b.tables) !== b.checksum) throw new Error("Empreinte de la sauvegarde invalide : fichier altéré ou incomplet");
  const applied = (await db.query<{ file: string }>("SELECT file FROM xx_migrations")).rows.map((r) => r.file);
  const missing = b.migrations.filter((m) => !applied.includes(m));
  if (missing.length) throw new Error(`Base cible en retard (migrations manquantes : ${missing.join(", ")})`);
  const users = (await db.query<{ n: number }>("SELECT COUNT(*)::int n FROM users")).rows[0].n;
  if (users > 0) throw new Error("La base cible contient déjà des comptes : restauration refusée (aucun écrasement)");
  const counts: Record<string, number> = {};
  await db.exec("BEGIN");
  try {
    for (const t of [...BACKUP_TABLES].reverse()) await db.query(`DELETE FROM ${t}`); // données de référence de la base neuve (composants)
    for (const t of BACKUP_TABLES) {
      const rows = b.tables[t] ?? [];
      for (const r of rows) await db.query(`INSERT INTO ${t} SELECT * FROM jsonb_populate_record(NULL::${t}, $1::jsonb)`, [JSON.stringify(r)]);
      counts[t] = rows.length;
    }
    for (const [t, c] of SERIAL) await db.query(`SELECT setval(pg_get_serial_sequence('${t}','${c}'), GREATEST(COALESCE((SELECT MAX(${c}) FROM ${t}), 0), 1), (SELECT COUNT(*) > 0 FROM ${t}))`);
    await db.exec("COMMIT");
  } catch (e) { await db.exec("ROLLBACK"); throw e; }
  return counts;
}
