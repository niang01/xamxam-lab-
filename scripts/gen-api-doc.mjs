// Génère docs/API.md à partir des fichiers route.ts de src/app/api : méthodes exportées et commentaires de documentation.
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src", "app", "api");
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === "route.ts") files.push(p); } };
walk(root);

const PUBLIC = new Set(["auth/register", "auth/login", "auth/logout", "auth/me", "i18n/catalog", "health", "public/certificates/[id]", "public/portfolio/[id]"]);
const groups = new Map();
for (const f of files) {
  const rel = path.relative(root, path.dirname(f)).split(path.sep).join("/");
  const src = fs.readFileSync(f, "utf8");
  const methods = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  const docs = {};
  for (const m of methods) {
    const i = src.indexOf(`export const ${m}`);
    const before = src.slice(0, i).trimEnd();
    const doc = before.endsWith("*/") ? before.slice(before.lastIndexOf("/**") + 3, -2).replace(/^\s*\*\s?/gm, "").replace(/\s+/g, " ").trim() : "";
    docs[m] = doc;
  }
  const access = rel.startsWith("device/") ? "jeton d'appareil (Bearer)" : PUBLIC.has(rel) ? "public" : src.includes("mustBeAdmin(") ? "administrateur" : "session";
  const g = rel.split("/")[0];
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push({ rel, methods, docs, access });
}

let out = `# API de XAM-XAM LAB\n\nDocument généré par \`npm run docs:api\` (${files.length} routes). Toutes les réponses sont en JSON ; les erreurs ont la forme \`{ "error": "message", "key": "clé traduisible", "details": … }\`. Les corps sont validés (zod) : données invalides → 400 avec le détail des champs. Session : cookie \`xx_session\` (httpOnly) obtenu par \`POST /api/auth/login\`. Appareils : en-tête \`Authorization: Bearer <jeton>\`.\n`;
for (const [g, items] of groups) {
  out += `\n## ${g}\n\n| Méthode | Chemin | Accès | Description |\n|---|---|---|---|\n`;
  for (const it of items) for (const m of it.methods) out += `| ${m} | \`/api/${it.rel}\` | ${it.access} | ${(it.docs[m] || "").replace(/\|/g, "\\|")} |\n`;
}
fs.writeFileSync(path.join(process.cwd(), "docs", "API.md"), out);
console.log(`docs/API.md : ${files.length} routes`);
