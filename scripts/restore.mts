/** Restauration dans une base NEUVE : npm run db:restore -- fichier.json */
import { readFileSync } from "node:fs";
import { getDb, closeDb } from "../src/server/db";
import { restoreBackup } from "../src/server/backup";
import { verifyAuditChain } from "../src/server/audit";

const file = process.argv[2];
if (!file) { console.error("Usage : npm run db:restore -- <fichier.json>"); process.exit(1); }
const db = await getDb();
try {
  const counts = await restoreBackup(db, JSON.parse(readFileSync(file, "utf8")));
  const chain = await verifyAuditChain();
  console.log(`Restauration terminée : ${Object.entries(counts).filter(([, n]) => n).map(([t, n]) => `${t}=${n}`).join(", ")}`);
  console.log(`Chaîne d'audit : ${chain.ok ? `intègre (${chain.checked} entrées)` : `ALTÉRÉE à l'entrée ${chain.brokenAt}`}`);
} catch (e) { console.error(`Restauration refusée : ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
await closeDb();
