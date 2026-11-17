/** Fichiers de traduction CSV (séparateur « ; », guillemets doublés) — fonctions pures, testées. */
export function csvEscape(v: string) {
  const s = v.replace(/\r?\n/g, "\\n");
  // Protection contre l'injection de formules dans un tableur.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[;"']/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** Retire l'apostrophe de protection et restaure les retours à la ligne. */
export const csvUnescape = (v: string) => v.replace(/^'(?=[=+\-@])/, "").replace(/\\n/g, "\n");
