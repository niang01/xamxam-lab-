import { ok, endpoint } from "@/server/api";
import { sql } from "@/server/db";

/** Textes d'une langue nationale : UNIQUEMENT les traductions validées (jamais les brouillons ni les traductions automatiques non relues). */
export const GET = endpoint(async (req) => {
  const lang = new URL(req.url).searchParams.get("lang") ?? "wo";
  const rows = await sql<{ key: string; text: string }>("SELECT key, text FROM translations WHERE lang=$1 AND status='validated'", [lang]);
  return ok({ lang, entries: Object.fromEntries(rows.map((r) => [r.key, r.text])) });
});
