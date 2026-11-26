/**
 * Import de produits par fichier CSV (vendeurs partenaires) : chaque ligne devient une annonce publiée dans un rayon.
 * Colonnes (en-tête obligatoire, séparateur « ; » ou « , ») :
 *   titre ; rayon ; categorie ; etat ; prix_fcfa ; stock ; remise ; marque ; reference ; description ; fiche_url
 * Prix et stock vides = « prix sur demande » / stock non déclaré : rien n'est complété à la place du vendeur.
 */
import { listingInput, MARKET_CATEGORIES, MARKET_CONDITIONS, MARKET_DELIVERY, type ListingInput } from "./market";
import { SECTION_KEYS } from "./shop";

export const IMPORT_COLUMNS = ["titre", "rayon", "categorie", "etat", "prix_fcfa", "stock", "remise", "marque", "reference", "description", "fiche_url"] as const;

export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell.trim()); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some((x) => x)) rows.push(row); row = []; cell = ""; } else cell += c;
  }
  row.push(cell.trim()); if (row.some((x) => x)) rows.push(row);
  return rows;
}

export interface ImportLine { line: number; ok: boolean; errors: string[]; listing?: ListingInput; section?: string; datasheet_url?: string | null }

export function importRows(text: string): { lines: ImportLine[]; header_errors: string[] } {
  const rows = parseCsv(text);
  if (!rows.length) return { lines: [], header_errors: ["fichier vide"] };
  const head = rows[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_"));
  const missing = ["titre", "rayon", "categorie"].filter((c) => !head.includes(c));
  if (missing.length) return { lines: [], header_errors: [`colonnes obligatoires absentes : ${missing.join(", ")}`] };
  const col = (r: string[], n: string) => { const i = head.indexOf(n); return i < 0 ? "" : (r[i] ?? "").trim(); };
  const intOrNull = (s: string) => (s === "" ? null : Number(s.replace(/[\s  ]/g, "").replace(",", ".")));
  return {
    header_errors: [],
    lines: rows.slice(1, 501).map((r, k) => {
      const errors: string[] = [];
      const section = col(r, "rayon");
      if (!(SECTION_KEYS as readonly string[]).includes(section)) errors.push(`rayon inconnu « ${section} » (valeurs : ${SECTION_KEYS.join(", ")})`);
      const cat = col(r, "categorie"); if (!(MARKET_CATEGORIES as readonly string[]).includes(cat)) errors.push(`catégorie inconnue « ${cat} »`);
      const cond = col(r, "etat") || "na"; if (!(MARKET_CONDITIONS as readonly string[]).includes(cond)) errors.push(`état inconnu « ${cond} »`);
      const delivery = col(r, "remise").split(/[|/]/).map((x) => x.trim()).filter(Boolean);
      for (const d of delivery) if (!(MARKET_DELIVERY as readonly string[]).includes(d)) errors.push(`mode de remise inconnu « ${d} »`);
      const price = intOrNull(col(r, "prix_fcfa")), qty = intOrNull(col(r, "stock"));
      if (price != null && !Number.isInteger(price)) errors.push("prix non entier");
      if (qty != null && !Number.isInteger(qty)) errors.push("stock non entier");
      const fiche = col(r, "fiche_url") || null;
      if (fiche && !/^https:\/\//.test(fiche)) errors.push("fiche technique : lien https requis");
      const specs = [["Marque", col(r, "marque")], ["Référence", col(r, "reference")]].filter(([, v]) => v).map(([name, value]) => ({ name, value }));
      const parsed = errors.length ? null : listingInput.safeParse({ title: col(r, "titre"), description: col(r, "description"), category: cat, condition: cond, price_xof: price, quantity: qty, delivery, specs, status: "published" });
      if (parsed && !parsed.success) errors.push(...parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`));
      return { line: k + 2, ok: !errors.length, errors, ...(parsed?.success ? { listing: parsed.data, section, datasheet_url: fiche } : {}) };
    }),
  };
}
