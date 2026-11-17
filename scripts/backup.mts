/** Sauvegarde : npm run db:backup [-- fichier.json] (base définie par DATABASE_URL ou PGLITE_DIR). */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getDb, closeDb } from "../src/server/db";
import { exportBackup } from "../src/server/backup";

const file = process.argv[2] ?? `backups/xamxam-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const db = await getDb();
const b = await exportBackup(db);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(b));
console.log(`Sauvegarde écrite : ${file} (${Object.entries(b.tables).map(([t, r]) => `${t}=${r.length}`).filter((x) => !x.endsWith("=0")).join(", ")}) · SHA-256 ${b.checksum}`);
await closeDb();
