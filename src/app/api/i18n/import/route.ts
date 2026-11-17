import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";
import { MESSAGES } from "@/lib/i18n/messages";
import { csvUnescape, parseCsv } from "@/lib/i18n/csv";
import { audit } from "@/server/audit";

/**
 * Import d'un fichier fourni par l'exploitant (décision du 16/11/2026) : les cellules remplies sont VALIDÉES
 * automatiquement (« Fichier importé par l'administrateur », inscrit au journal), ou importées en brouillon à relire.
 * Clés acceptées : clés de l'interface, et « gloss.<terme> » (glossaire scientifique). Paramètres {x} conservés obligatoirement.
 */
export const POST = endpoint(async (req) => {
  const u = await mustBeAdmin(req);
  const b = await readInput(req, z.object({ lang: z.literal("wo"), format: z.enum(["csv", "json"]), content: z.string().max(5_000_000), mode: z.enum(["validated", "draft"]) }));
  let pairs: { key: string; text: string }[] = [];
  if (b.format === "json") {
    const d = JSON.parse(b.content) as { entries?: { key: string; text?: string; wo?: string }[] };
    pairs = (d.entries ?? []).map((e) => ({ key: e.key, text: (e.text ?? e.wo ?? "").trim() }));
  } else {
    const rows = parseCsv(b.content.replace(/^﻿/, ""));
    const head = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
    const ki = head.indexOf("key"), wi = head.indexOf("wo") >= 0 ? head.indexOf("wo") : head.indexOf("text");
    pairs = rows.slice(1).map((r) => ({ key: (r[ki] ?? "").trim(), text: csvUnescape((r[wi] ?? "").trim()) }));
  }
  const rejected: string[] = []; let imported = 0;
  for (const p of pairs) {
    if (!p.text) continue;
    const known = p.key in MESSAGES;
    if (!known && !/^gloss\.[\p{L}\p{N} '’-]{1,80}$/u.test(p.key)) { rejected.push(`${p.key} : clé inconnue`); continue; }
    if (known) {
      const need = [...new Set((MESSAGES[p.key as keyof typeof MESSAGES].fr.match(/\{\w+\}/g) ?? []))];
      const missing = need.filter((x) => !p.text.includes(x));
      if (missing.length) { rejected.push(`${p.key} : paramètre(s) ${missing.join(", ")} absent(s)`); continue; }
    }
    await sql(`INSERT INTO translations(lang, key, text, status, validated_by, validated_at) VALUES ('wo',$1,$2,$3,$4,$5)
      ON CONFLICT (lang, key) DO UPDATE SET text=EXCLUDED.text, status=EXCLUDED.status, validated_by=EXCLUDED.validated_by, validated_at=EXCLUDED.validated_at, updated_at=now()`,
      [p.key, p.text.slice(0, 5000), b.mode, b.mode === "validated" ? "Fichier importé par l'administrateur" : null, b.mode === "validated" ? new Date().toISOString() : null]);
    imported++;
  }
  await audit(u.id, "human", "i18n.import", null, { lang: b.lang, mode: b.mode, imported, rejected: rejected.length, note: b.mode === "validated" ? "Fichier importé par l'administrateur" : "brouillon à relire" });
  return ok({ imported, rejected });
});
