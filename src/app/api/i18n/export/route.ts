import { ok, endpoint, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";
import { MESSAGES, MSG_KEYS } from "@/lib/i18n/messages";
import { csvEscape } from "@/lib/i18n/csv";

/** Export de toutes les clés (référence française et anglaise, texte actuel, statut) pour les traducteurs. */
export const GET = endpoint(async (req) => {
  await mustBeAdmin(req);
  const sp = new URL(req.url).searchParams;
  const lang = sp.get("lang") === "wo" ? "wo" : "wo";
  const rows = await sql<{ key: string; text: string; status: string }>("SELECT key, text, status FROM translations WHERE lang=$1", [lang]);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const glossary = rows.filter((r) => r.key.startsWith("gloss.") && !(r.key in MESSAGES));
  const entries = [...MSG_KEYS.map((k) => ({ key: k, fr: MESSAGES[k].fr, en: MESSAGES[k].en, text: byKey.get(k)?.text ?? "", status: byKey.get(k)?.status ?? "missing" })),
    ...glossary.map((g) => ({ key: g.key, fr: g.key.slice(6), en: "", text: g.text, status: g.status }))];
  if (sp.get("format") === "csv") {
    const csv = ["key;fr;en;wo;status", ...entries.map((e) => [e.key, e.fr, e.en, e.text, e.status].map(csvEscape).join(";"))].join("\n");
    return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="xamxam-${lang}.csv"`, "Cache-Control": "no-store" } });
  }
  return ok({ lang, entries });
});
