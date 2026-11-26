/**
 * Exports de rapports sans service externe : Word (.docx, OOXML), Excel (.xlsx, OOXML) et PDF (texte, polices
 * standard). Entrée : lignes de type Markdown simple (# titres, - listes, texte) et tableaux.
 */
import { strToU8, zipSync } from "fflate";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

export function toDocx(title: string, markdown: string, tables: string[][][] = []): Uint8Array {
  const para = (text: string, style?: string, bold = false) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  const body: string[] = [para(title, "Title")];
  for (const l of markdown.split("\n")) {
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) body.push(para(h[2].replace(/\*\*/g, ""), `Heading${h[1].length}`));
    else if (/^\s*[-•]\s+/.test(l)) body.push(para(`• ${l.replace(/^\s*[-•]\s+/, "").replace(/\*\*/g, "")}`));
    else body.push(para(l.replace(/\*\*/g, ""), undefined, /^\*\*.*\*\*$/.test(l.trim())));
  }
  for (const t of tables) {
    body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join("")}</w:tblBorders></w:tblPr>${t.map((r) => `<w:tr>${r.map((c) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${esc(c ?? "")}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`, para(""));
  }
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${[["Title", 36], ["Heading1", 30], ["Heading2", 26], ["Heading3", 24]].map(([id, sz]) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`).join("")}</w:styles>`;
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "word/styles.xml": strToU8(styles),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`),
  });
}

const colName = (i: number) => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** Classeur Excel : une feuille par tableau (nombres reconnus comme tels). */
export function toXlsx(sheets: { name: string; rows: string[][] }[]): Uint8Array {
  const list = sheets.length ? sheets : [{ name: "Vide", rows: [] }];
  const sheetXml = (rows: string[][]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
    const ref = `${colName(ci)}${ri + 1}`; const v = (c ?? "").trim();
    return /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list.map((s, i) => `<sheet name="${esc(s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Feuille${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`),
  };
  list.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows)); });
  return zipSync(files);
}

// --------------------------------------------------------------- PDF (texte, Helvetica, codage WinAnsi)
const WIN: Record<string, number> = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c };
export function winAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if (WIN[ch] !== undefined) out.push(WIN[ch]);
    else if (c >= 32 && c < 127 || c >= 160 && c <= 255) out.push(c);
    else out.push(...[...(({ "Ω": "Ohm", "φ": "phi", "η": "eta", "√": "racine ", "²": "2", "³": "3", "≈": "~", "≤": "<=", "≥": ">=", "≠": "!=", "×": "x", "·": ".", "µ": "u", "Δ": "Delta ", "✓": "[OK]", "⚠": "[!]", "✗": "[X]" } as Record<string, string>)[ch] ?? "?")].map((x) => x.charCodeAt(0)));
  }
  return out;
}
export const pdfStr = (bytes: number[]) => "(" + bytes.map((b) => (b === 40 || b === 41 || b === 92 ? "\\" + String.fromCharCode(b) : b < 32 || b > 126 ? "\\" + b.toString(8).padStart(3, "0") : String.fromCharCode(b))).join("") + ")";

/** PDF A4 multi-pages (texte seul, coupure des lignes à ~95 caractères). */
export function toPdf(title: string, markdown: string): Uint8Array {
  const wrap = (s: string, n: number) => { const out: string[] = []; let cur = ""; for (const w of s.split(/\s+/)) { if ((cur + " " + w).trim().length > n) { if (cur) out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } out.push(cur); return out; };
  const items: { text: string; size: number; bold: boolean }[] = [{ text: title, size: 16, bold: true }, { text: "", size: 10, bold: false }];
  for (const l of markdown.split("\n")) {
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) items.push({ text: "", size: 6, bold: false }, ...wrap(h[2].replace(/\*\*/g, ""), 70).map((t) => ({ text: t, size: h[1].length === 1 ? 13 : 11.5, bold: true })));
    else for (const t of wrap(l.replace(/\*\*/g, "").replace(/^\s*-\s+/, "• "), 95)) items.push({ text: t, size: 10, bold: false });
  }
  const pages: string[] = []; let y = 800, cur: string[] = [];
  for (const it of items) {
    const lh = it.size * 1.35;
    if (y - lh < 50) { pages.push(cur.join("\n")); cur = []; y = 800; }
    y -= lh;
    if (it.text) cur.push(`BT /${it.bold ? "F2" : "F1"} ${it.size} Tf 50 ${y.toFixed(1)} Td ${pdfStr(winAnsi(it.text))} Tj ET`);
  }
  pages.push(cur.join("\n"));
  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, i) => {
    const id = pageIds[i];
    objs[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objs[id + 1] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  });
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = Buffer.byteLength(out, "latin1"); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
