/**
 * Impression des schémas : planche PDF VECTORIELLE au format ISO 216 (A4 à A1, portrait ou paysage) avec cartouche
 * (projet, titre, numéro de plan, date, concepteur, échelle, format, légende) et export DXF (AutoCAD R12, ASCII)
 * lisible par les logiciels de CAO (LibreCAD, QCAD, AutoCAD…). Le dessin reste modifiable dans l'éditeur 2D : ces
 * fichiers sont des sorties, l'original éditable est le schéma XAM-XAM LAB (JSON versionné).
 */
import { BLOCK_W, blockHeight, bomOf, dimText, layerOf, pinPoint, visibleDiagram, type Block, type Diagram } from "./diagram";
import { pdfStr, winAnsi } from "./docs/export";

export const SHEETS = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841] } as const;
export type SheetSize = keyof typeof SHEETS;
export interface PrintMeta { size: SheetSize; orientation: "portrait" | "landscape"; margin: number; project: string; title: string; number: string; designer: string; date: string }

const PT = 72 / 25.4;
const ascii0 = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_"); // points par millimètre

function rectCorners(b: Block): [number, number][] {
  const h = blockHeight(b), r = (b.rot * Math.PI) / 180;
  return [[-BLOCK_W / 2, -h / 2], [BLOCK_W / 2, -h / 2], [BLOCK_W / 2, h / 2], [-BLOCK_W / 2, h / 2]].map(([x, y]) => [b.x + x * Math.cos(r) - y * Math.sin(r), b.y + x * Math.sin(r) + y * Math.cos(r)]);
}
function wirePath(d: Diagram, w: Diagram["wires"][number]): [number, number][] | null {
  const a = d.blocks.find((b) => b.id === w.a.block), b = d.blocks.find((x) => x.id === w.b.block);
  if (!a || !b) return null;
  const [x1, y1] = pinPoint(a, w.a.pin), [x2, y2] = pinPoint(b, w.b.pin), mx = Math.round((x1 + x2) / 2);
  return [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
}
export function bounds(d: Diagram) {
  const pts: [number, number][] = [...(d.dims ?? []).flatMap((c) => [[c.x1, c.y1], [c.x2, c.y2]] as [number, number][]), ...d.blocks.flatMap(rectCorners), ...d.blocks.flatMap((b) => b.pins.map((_, i) => pinPoint(b, i))), ...d.notes.map((n) => [n.x, n.y] as [number, number]), ...d.notes.map((n) => [n.x + n.text.length * 6, n.y] as [number, number])];
  if (!pts.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX: Math.min(...pts.map((p) => p[0])) - 20, minY: Math.min(...pts.map((p) => p[1])) - 20, maxX: Math.max(...pts.map((p) => p[0])) + 20, maxY: Math.max(...pts.map((p) => p[1])) + 20 };
}

/** Planche PDF vectorielle d'un schéma. Renvoie aussi l'échelle appliquée (mm par unité du schéma). */
export function diagramPdf(full: Diagram, m: PrintMeta): { pdf: Uint8Array; mmPerUnit: number } {
  const d = visibleDiagram(full);
  const [a, b] = SHEETS[m.size];
  const [W, H] = m.orientation === "landscape" ? [b, a] : [a, b]; // mm
  const titleH = 32, legendW = 70;
  const area = { x: m.margin, y: m.margin + titleH + 4, w: W - 2 * m.margin - legendW - 4, h: H - 2 * m.margin - titleH - 4 };
  const bb = bounds(d);
  const k = Math.min(area.w / (bb.maxX - bb.minX), area.h / (bb.maxY - bb.minY));
  // coordonnées schéma → points PDF (origine en bas à gauche)
  const X = (x: number) => (area.x + (x - bb.minX) * k) * PT, Y = (y: number) => (H - (area.y + (y - bb.minY) * k)) * PT;
  // Origine du dessin : y du haut de la zone ; on place le dessin en haut de la zone utile.
  const Yd = (y: number) => (H - m.margin - (y - bb.minY) * k) * PT;
  const ops: string[] = ["0.6 w 0 0 0 RG"];
  const txt = (x: number, y: number, s: string, size: number, bold = false) => ops.push(`BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfStr(winAnsi(s))} Tj ET`);
  const line = (pts: [number, number][]) => ops.push(`${pts.map(([x, y], i) => `${x.toFixed(2)} ${y.toFixed(2)} ${i ? "l" : "m"}`).join(" ")} S`);
  // Cadre de la planche
  ops.push(`${(m.margin * PT).toFixed(2)} ${(m.margin * PT).toFixed(2)} ${((W - 2 * m.margin) * PT).toFixed(2)} ${((H - 2 * m.margin) * PT).toFixed(2)} re S`);
  const fs = Math.max(4, Math.min(9, 9 * k * 1.2));
  // Liaisons
  ops.push("0.05 0.45 0.56 RG 0.8 w");
  for (const w of d.wires) { const p = wirePath(d, w); if (p) { line(p.map(([x, y]) => [X(x), Yd(y)])); if (w.label) txt(X((p[1][0] + p[2][0]) / 2) + 2, Yd((p[1][1] + p[2][1]) / 2), w.label, fs * 0.8); } }
  // Blocs
  ops.push("0 0 0 RG 0.6 w");
  for (const bl of d.blocks) {
    const c = rectCorners(bl).map(([x, y]) => [X(x), Yd(y)] as [number, number]);
    line([...c, c[0]]);
    txt(X(bl.x) - (bl.label.length * fs * 0.3), Yd(bl.y) + fs * 0.2, bl.label, fs, true);
    txt(X(bl.x) - (Math.min(bl.name.length, 24) * fs * 0.22), Yd(bl.y) - fs, bl.name.slice(0, 24), fs * 0.75);
    bl.pins.forEach((p, i) => { const [px, py] = pinPoint(bl, i); ops.push(`${(X(px) - 1).toFixed(2)} ${(Yd(py) - 1).toFixed(2)} 2 2 re f`); txt(X(px) + 2, Yd(py) + 2, p, fs * 0.6); });
  }
  for (const n of d.notes) txt(X(n.x), Yd(n.y), n.text.slice(0, 120), fs * 0.85);
  // Cotes
  ops.push("0.71 0.33 0.04 RG 0.5 w");
  for (const c of d.dims ?? []) {
    line([[X(c.x1), Yd(c.y1)], [X(c.x2), Yd(c.y2)]]);
    for (const [x, y] of [[c.x1, c.y1], [c.x2, c.y2]]) ops.push(`${(X(x) - 1.5).toFixed(2)} ${(Yd(y) - 1.5).toFixed(2)} 3 3 re f`);
    txt(X((c.x1 + c.x2) / 2), Yd((c.y1 + c.y2) / 2) + 2, dimText(d, c), fs * 0.8);
  }
  ops.push("0 0 0 RG");
  // Cartouche (bas, pleine largeur utile)
  const cx = m.margin, cy = m.margin, cw = W - 2 * m.margin;
  ops.push(`${(cx * PT).toFixed(2)} ${(cy * PT).toFixed(2)} ${(cw * PT).toFixed(2)} ${(titleH * PT).toFixed(2)} re S`);
  const cols = [0, 0.4, 0.62, 0.8].map((f) => cx + f * cw);
  for (const c of cols.slice(1)) line([[c * PT, cy * PT], [c * PT, (cy + titleH) * PT]]);
  const mmPerUnit = k;
  const cells: [number, string, string][] = [[cols[0], "Projet", m.project], [cols[1], "Plan n°", m.number], [cols[2], "Date", m.date], [cols[3], "Concepteur", m.designer]];
  for (const [x, l, v] of cells) { txt((x + 2) * PT, (cy + titleH - 6) * PT, l, 6); txt((x + 2) * PT, (cy + titleH - 13) * PT, v.slice(0, 60), 9, true); }
  txt((cx + 2) * PT, (cy + 10) * PT, m.title.slice(0, 110), 11, true);
  txt((cols[2] + 2) * PT, (cy + 4) * PT, `Format ${m.size} ${m.orientation === "landscape" ? "paysage" : "portrait"} — échelle : 1 unité du schéma = ${mmPerUnit.toFixed(3)} mm — XAM-XAM LAB`, 6);
  // Légende (colonne de droite)
  const lx = W - m.margin - legendW, ly = H - m.margin;
  ops.push(`${(lx * PT).toFixed(2)} ${((m.margin + titleH + 4) * PT).toFixed(2)} ${(legendW * PT).toFixed(2)} ${((H - 2 * m.margin - titleH - 4) * PT).toFixed(2)} re S`);
  txt((lx + 2) * PT, (ly - 6) * PT, "Légende / nomenclature", 7, true);
  let yy = ly - 12;
  for (const it of bomOf(d)) { if (yy < m.margin + titleH + 8) { txt((lx + 2) * PT, yy * PT, "…", 6); break; } txt((lx + 2) * PT, yy * PT, `${it.labels.join(", ").slice(0, 18)} : ${it.name.slice(0, 30)} (${it.qty})`, 5.5); yy -= 4.5; }
  void X; void Y;
  const content = ops.join("\n");
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Kids [5 0 R] /Count 1 >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objs[5] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(W * PT).toFixed(2)} ${(H * PT).toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`;
  objs[6] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = Buffer.byteLength(out, "latin1"); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { pdf: new Uint8Array(Buffer.from(out, "latin1")), mmPerUnit };
}

/** Export DXF R12 (ASCII) : calques BLOCS, LIAISONS, TEXTES, NOTES ; axe Y inversé (repère CAO). */
export function diagramDxf(full: Diagram, title = ""): string {
  const d = visibleDiagram(full);
  const blockLayers = [...new Set(d.blocks.map((b) => ascii0(layerOf(b)).toUpperCase().replace(/[^A-Z0-9_-]/g, "_")))];
  const L: string[] = [];
  const g = (code: number, v: string | number) => L.push(String(code), typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : v);
  const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
  const lineE = (layer: string, [x1, y1]: [number, number], [x2, y2]: [number, number]) => { g(0, "LINE"); g(8, layer); g(10, x1); g(20, -y1); g(30, 0); g(11, x2); g(21, -y2); g(31, 0); };
  const textE = (layer: string, x: number, y: number, h: number, s: string) => { g(0, "TEXT"); g(8, layer); g(10, x); g(20, -y); g(30, 0); g(40, h); g(1, ascii(s)); };
  g(0, "SECTION"); g(2, "HEADER"); g(9, "$ACADVER"); g(1, "AC1009"); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES"); g(0, "TABLE"); g(2, "LAYER"); g(70, 4);
  for (const [name, color] of [["BLOCS", 7], ["LIAISONS", 4], ["TEXTES", 3], ["NOTES", 2], ["COTES", 1], ...blockLayers.map((n) => [`BLOCS_${n}`, 7] as const)]) { g(0, "LAYER"); g(2, name); g(70, 0); g(62, color); g(6, "CONTINUOUS"); }
  g(0, "ENDTAB"); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");
  for (const b of d.blocks) {
    const c = rectCorners(b);
    const lay = `BLOCS_${ascii0(layerOf(b)).toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}`;
    for (let i = 0; i < 4; i++) lineE(lay, c[i], c[(i + 1) % 4]);
    textE("TEXTES", b.x - BLOCK_W / 2 + 6, b.y, 10, b.label);
    textE("TEXTES", b.x - BLOCK_W / 2 + 6, b.y + 14, 6, b.name.slice(0, 40));
    b.pins.forEach((p, i) => { const [px, py] = pinPoint(b, i); textE("TEXTES", px + 2, py - 2, 4, p); });
  }
  for (const w of d.wires) { const p = wirePath(d, w); if (p) for (let i = 0; i < p.length - 1; i++) lineE("LIAISONS", p[i], p[i + 1]); }
  for (const n of d.notes) textE("NOTES", n.x, n.y, 6, n.text.slice(0, 200));
  for (const c of d.dims ?? []) { lineE("COTES", [c.x1, c.y1], [c.x2, c.y2]); textE("COTES", (c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2 - 4, 6, dimText(d, c)); }
  if (title) { const bb = bounds(d); textE("TEXTES", bb.minX, bb.minY - 10, 12, title); }
  g(0, "ENDSEC"); g(0, "EOF");
  return L.join("\n") + "\n";
}
