/**
 * Extraction de texte et de tableaux des formats Office Open XML (DOCX, XLSX, PPTX) — archives ZIP de fichiers XML.
 * Fonctions pures (fflate), sans exécution de macro ni accès réseau. Les formats binaires anciens (DOC, XLS, PPT)
 * ne sont pas pris en charge : l'utilisateur est invité à les enregistrer au format récent.
 */
import { unzipSync, strFromU8 } from "fflate";

export interface Extracted { text: string; tables: string[][][]; pages: number | null; warnings: string[] }

const MAX_ENTRY = 40 * 1024 * 1024;
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");

function unzip(buf: Uint8Array, want: (name: string) => boolean): Record<string, string> {
  let total = 0;
  const files = unzipSync(buf, { filter: (f) => { if (!want(f.name)) return false; total += f.originalSize; if (f.originalSize > MAX_ENTRY || total > 4 * MAX_ENTRY) throw new Error("Archive trop volumineuse une fois décompressée"); return true; } });
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strFromU8(v)]));
}
const texts = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => decode(m[1]));

/** Word (.docx) : paragraphes et tableaux. */
export function extractDocx(buf: Uint8Array): Extracted {
  const f = unzip(buf, (n) => n === "word/document.xml");
  const xml = f["word/document.xml"];
  if (!xml) throw new Error("Fichier Word invalide (word/document.xml absent)");
  const tables: string[][][] = [];
  for (const tbl of xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []) {
    tables.push((tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((tr) => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => texts(tc, "w:t").join("").trim())));
  }
  const paragraphs = (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map((p) => texts(p.replace(/<w:tab\/>/g, "<w:t>\t</w:t>"), "w:t").join(""));
  return { text: paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim(), tables, pages: null, warnings: [] };
}

/** Excel (.xlsx) : chaque feuille devient un tableau (valeurs, pas les formules). */
export function extractXlsx(buf: Uint8Array): Extracted {
  const f = unzip(buf, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = (f["xl/sharedStrings.xml"]?.match(/<si>[\s\S]*?<\/si>/g) ?? []).map((si) => texts(si, "t").join(""));
  const names = [...(f["xl/workbook.xml"] ?? "").matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decode(m[1]));
  const sheets = Object.keys(f).filter((n) => n.startsWith("xl/worksheets/")).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!sheets.length) throw new Error("Classeur Excel invalide (aucune feuille)");
  const col = (ref: string) => ref.replace(/\d+/g, "").split("").reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const tables: string[][][] = [];
  const lines: string[] = [];
  sheets.forEach((s, k) => {
    const rows: string[][] = [];
    for (const row of f[s].match(/<row[ >][\s\S]*?<\/row>/g) ?? []) {
      const cells: string[] = [];
      for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
        const ref = c.match(/r="([A-Z]+\d+)"/)?.[1]; const type = c.match(/t="(\w+)"/)?.[1];
        const v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? texts(c, "t").join("");
        const value = type === "s" ? shared[Number(v)] ?? "" : decode(v ?? "");
        if (ref) cells[col(ref)] = value;
      }
      rows.push(Array.from(cells, (x) => x ?? ""));
    }
    tables.push(rows);
    lines.push(`# Feuille ${names[k] ?? k + 1}`, ...rows.map((r) => r.join("\t")));
  });
  return { text: lines.join("\n"), tables, pages: null, warnings: ["Excel : valeurs enregistrées dans le fichier (les formules ne sont pas recalculées)."] };
}

/** PowerPoint (.pptx) : texte de chaque diapositive, dans l'ordre. */
export function extractPptx(buf: Uint8Array): Extracted {
  const f = unzip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slides = Object.keys(f).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!slides.length) throw new Error("Présentation PowerPoint invalide (aucune diapositive)");
  const text = slides.map((s, i) => [`# Diapositive ${i + 1}`, ...(f[s].match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []).map((p) => texts(p, "a:t").join("")).filter(Boolean)].join("\n")).join("\n\n");
  return { text, tables: [], pages: slides.length, warnings: [] };
}

/** DXF (texte ASCII) : calques, entités et textes annotés. */
export function extractDxf(src: string): Extracted {
  const lines = src.split(/\r?\n/).map((l) => l.trim());
  const counts = new Map<string, number>(); const layers = new Set<string>(); const notes: string[] = [];
  let inEntities = false;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i], val = lines[i + 1];
    if (code === "2" && val === "ENTITIES") inEntities = true;
    if (code === "0" && val === "ENDSEC") inEntities = false;
    if (inEntities && code === "0") counts.set(val, (counts.get(val) ?? 0) + 1);
    if (code === "8") layers.add(val);
    if (code === "1" && inEntities) notes.push(val);
  }
  if (!counts.size) throw new Error("Fichier DXF illisible (section ENTITIES absente)");
  return { text: [`Entités : ${[...counts].map(([k, v]) => `${k} × ${v}`).join(", ")}`, `Calques : ${[...layers].join(", ")}`, ...notes.map((n) => `Texte : ${n}`)].join("\n"), tables: [[["Entité", "Nombre"], ...[...counts].map(([k, v]) => [k, String(v)])]], pages: null, warnings: ["DXF : inventaire des entités et des textes ; la géométrie n'est pas interprétée."] };
}

/** STL (binaire ou ASCII) : nombre de triangles et encombrement. */
export function extractStl(buf: Uint8Array): Extracted {
  const head = strFromU8(buf.slice(0, Math.min(buf.length, 512)));
  const pts: number[][] = [];
  let tri = 0;
  if (/^\s*solid/.test(head) && strFromU8(buf.slice(0, Math.min(buf.length, 4096))).includes("facet")) {
    const s = strFromU8(buf);
    for (const m of s.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) pts.push([Number(m[1]), Number(m[2]), Number(m[3])]);
    tri = pts.length / 3;
  } else {
    if (buf.length < 84) throw new Error("Fichier STL trop court");
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    tri = dv.getUint32(80, true);
    if (84 + tri * 50 > buf.length) throw new Error("Fichier STL binaire tronqué");
    for (let t = 0; t < tri; t++) for (let v = 0; v < 3; v++) { const o = 84 + t * 50 + 12 + v * 12; pts.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]); }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  const size = max.map((v, k) => +(v - min[k]).toFixed(3));
  return { text: `Maillage STL : ${tri} triangles ; encombrement ${size.join(" × ")} (unités du fichier).`, tables: [[["Axe", "Min", "Max"], ...["X", "Y", "Z"].map((a, k) => [a, String(min[k]), String(max[k])])]], pages: null, warnings: [] };
}
