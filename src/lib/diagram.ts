/**
 * Schémas 2D multidisciplines (plans électriques, câblage IoT, hydraulique, froid, réseau…) : blocs issus de la
 * bibliothèque, broches, liaisons, annotations. Fonctions pures : géométrie, vérification, nomenclature, export SVG.
 * Ce n'est PAS un simulateur : la simulation électronique se fait dans l'Electronics Lab (ngspice),
 * les scénarios temporels dans le Studio 4D.
 */
import { z } from "zod";
import { glyphFor, placeGlyph, type Glyph, type Pt } from "./symbols";

export const blockSchema = z.object({
  id: z.string().min(1).max(40), component_id: z.string().uuid().nullable().optional(), name: z.string().min(1).max(120),
  symbol: z.string().max(12), label: z.string().max(40), pins: z.array(z.string().max(40)).max(60),
  x: z.number().finite(), y: z.number().finite(), rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  params: z.record(z.string().max(40), z.string().max(80)).default({}),
  meta: z.array(z.object({ key: z.string().max(40), label: z.string().max(80), unit: z.string().max(20) })).max(40).optional(),
  layer: z.string().max(30).optional(),
});
export const endSchema = z.object({ block: z.string().max(40), pin: z.number().int().min(0).max(59) });
export const diagramSchema = z.object({
  discipline: z.string().max(30).default("general"),
  blocks: z.array(blockSchema).max(300),
  wires: z.array(z.object({ a: endSchema, b: endSchema, label: z.string().max(40).optional() })).max(1000),
  notes: z.array(z.object({ x: z.number().finite(), y: z.number().finite(), text: z.string().max(300) })).max(100).default([]),
  /** Cotes : segment mesuré et texte (vide = longueur × échelle). */
  dims: z.array(z.object({ x1: z.number().finite(), y1: z.number().finite(), x2: z.number().finite(), y2: z.number().finite(), text: z.string().max(40).optional() })).max(300).optional(),
  /** Échelle du dessin : millimètres réels par unité du plan (plans d'implantation cotés). */
  scale: z.number().positive().max(1e6).optional(),
  hidden_layers: z.array(z.string().max(30)).max(30).optional(),
});
export type Diagram = z.infer<typeof diagramSchema>;
export type Block = z.infer<typeof blockSchema>;

export const BLOCK_W = 120;
export const PIN_STEP = 20;
/** Hauteur d'un bloc : broches réparties à gauche (première moitié) et à droite (seconde moitié). */
export const blockHeight = (b: Pick<Block, "pins">) => Math.max(60, Math.ceil(Math.max(1, b.pins.length) / 2) * PIN_STEP + 30);

/** Position absolue de la broche `i` (rotation autour du centre du bloc). */
export function pinPoint(b: Block, i: number): [number, number] {
  const h = blockHeight(b);
  const left = Math.ceil(b.pins.length / 2);
  const side = i < left ? -1 : 1;
  const row = i < left ? i : i - left;
  const lx = side * (BLOCK_W / 2 + 10), ly = -h / 2 + 30 + row * PIN_STEP;
  const r = (b.rot * Math.PI) / 180;
  return [Math.round(b.x + lx * Math.cos(r) - ly * Math.sin(r)), Math.round(b.y + lx * Math.sin(r) + ly * Math.cos(r))];
}

/** Symbole conventionnel placé dans un bloc (centre décalé vers le haut, rotation du bloc), ou null. */
export const GLYPH_DY = -6, GLYPH_SCALE = 0.9;
export function blockGlyph(b: Block): { glyph: Glyph; lines: Pt[][]; texts: Glyph["texts"] } | null {
  const glyph = glyphFor(b.name, b.symbol);
  if (!glyph) return null;
  const p = placeGlyph(glyph, 0, GLYPH_DY, b.rot, GLYPH_SCALE);
  const sh = ([x, y]: Pt): Pt => [Math.round((b.x + x) * 100) / 100, Math.round((b.y + y) * 100) / 100];
  return { glyph, lines: p.lines.map((l) => l.map(sh)), texts: p.texts.map((t) => { const [x, y] = sh([t.x, t.y]); return { ...t, x, y }; }) };
}

export interface Check { errors: string[]; warnings: string[]; nets: number }

/** Vérification : liaisons vers des blocs ou broches inexistants, boucles sur une même broche, doublons, broches libres. */
export function checkDiagram(d: Diagram): Check {
  const errors: string[] = [], warnings: string[] = [];
  const byId = new Map(d.blocks.map((b) => [b.id, b]));
  const ids = new Set<string>();
  for (const b of d.blocks) { if (ids.has(b.id)) errors.push(`Identifiant de bloc en double : ${b.id}`); ids.add(b.id); }
  const labels = new Map<string, number>();
  for (const b of d.blocks) labels.set(b.label, (labels.get(b.label) ?? 0) + 1);
  for (const [l, n] of labels) if (l && n > 1) warnings.push(`Repère « ${l} » utilisé ${n} fois`);
  const seen = new Set<string>();
  const used = new Set<string>();
  // Union-find pour compter les équipotentielles / liaisons.
  const parent = new Map<string, string>();
  const find = (k: string): string => { const p = parent.get(k) ?? k; if (p === k) return k; const r = find(p); parent.set(k, r); return r; };
  for (const w of d.wires) {
    const ba = byId.get(w.a.block), bb = byId.get(w.b.block);
    if (!ba || !bb) { errors.push("Liaison vers un bloc inexistant"); continue; }
    if (w.a.pin >= ba.pins.length || w.b.pin >= bb.pins.length) { errors.push(`Liaison vers une broche inexistante (${ba.label} / ${bb.label})`); continue; }
    const ka = `${w.a.block}:${w.a.pin}`, kb = `${w.b.block}:${w.b.pin}`;
    if (ka === kb) { errors.push(`Liaison d'une broche sur elle-même (${ba.label}.${ba.pins[w.a.pin]})`); continue; }
    const key = [ka, kb].sort().join("|");
    if (seen.has(key)) warnings.push(`Liaison en double : ${ba.label}.${ba.pins[w.a.pin]} — ${bb.label}.${bb.pins[w.b.pin]}`);
    seen.add(key); used.add(ka); used.add(kb);
    parent.set(find(ka), find(kb));
  }
  for (const b of d.blocks) b.pins.forEach((p, i) => { if (!used.has(`${b.id}:${i}`)) warnings.push(`Broche non raccordée : ${b.label}.${p}`); });
  for (const b of d.blocks) { const empty = Object.entries(b.params).filter(([, v]) => !v.trim()).length; if (empty) warnings.push(`${b.label} : ${empty} paramètre(s) sans valeur`); }
  const nets = new Set([...used].map(find)).size;
  return { errors, warnings, nets };
}

/** Nomenclature : regroupement par composant (bibliothèque) ou par nom. */
export function bomOf(d: Diagram): { component_id: string | null; name: string; qty: number; labels: string[] }[] {
  const m = new Map<string, { component_id: string | null; name: string; qty: number; labels: string[] }>();
  for (const b of d.blocks) {
    const k = b.component_id ?? `name:${b.name}`;
    const e = m.get(k) ?? { component_id: b.component_id ?? null, name: b.name, qty: 0, labels: [] };
    e.qty++; e.labels.push(b.label); m.set(k, e);
  }
  return [...m.values()];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Export SVG autonome (couleurs fixes, lisible à l'impression). */
export function diagramSvg(full: Diagram, title = ""): string {
  const d = visibleDiagram(full);
  const pts = d.blocks.flatMap((b) => [[b.x - 100, b.y - blockHeight(b) / 2 - 40], [b.x + 100, b.y + blockHeight(b) / 2 + 40]]).concat(d.notes.map((n) => [n.x + 200, n.y + 20])).concat((d.dims ?? []).flatMap((c) => [[c.x1, c.y1 - 20], [c.x2, c.y2 + 20]]));
  const minX = Math.min(0, ...pts.map((p) => p[0])), minY = Math.min(0, ...pts.map((p) => p[1]));
  const maxX = Math.max(400, ...pts.map((p) => p[0])), maxY = Math.max(300, ...pts.map((p) => p[1]));
  const byId = new Map(d.blocks.map((b) => [b.id, b]));
  const wires = d.wires.map((w) => {
    const a = byId.get(w.a.block), b = byId.get(w.b.block);
    if (!a || !b) return "";
    const [x1, y1] = pinPoint(a, w.a.pin), [x2, y2] = pinPoint(b, w.b.pin);
    const mx = Math.round((x1 + x2) / 2);
    return `<polyline points="${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="#0e7490" stroke-width="2"/>${w.label ? `<text x="${mx + 4}" y="${Math.round((y1 + y2) / 2)}" font-size="10" fill="#0e7490">${esc(w.label)}</text>` : ""}`;
  }).join("");
  const blocks = d.blocks.map((b) => {
    const h = blockHeight(b);
    const pins = b.pins.map((p, i) => { const [px, py] = pinPoint(b, i); return `<circle cx="${px}" cy="${py}" r="3" fill="#111"/><text x="${px}" y="${py - 5}" font-size="8" text-anchor="middle" fill="#333">${esc(p)}</text>`; }).join("");
    const gl = blockGlyph(b);
    const body = gl
      ? gl.lines.map((l) => `<polyline points="${l.map(([x, y]) => `${x},${y}`).join(" ")}" fill="none" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>`).join("")
        + gl.texts.map((t) => `<text x="${t.x}" y="${t.y}" font-size="${t.size}" text-anchor="middle">${esc(t.s)}</text>`).join("")
        + `<text x="${b.x}" y="${b.y + h / 2 - 6}" font-size="11" font-weight="bold" text-anchor="middle">${esc(b.label)}</text><title>${esc(`${b.name} — ${gl.glyph.title} (${gl.glyph.norm})`)}</title>`
      : `<text x="${b.x}" y="${b.y - 4}" font-size="12" font-weight="bold" text-anchor="middle">${esc(b.label)}</text><text x="${b.x}" y="${b.y + 12}" font-size="9" text-anchor="middle" fill="#444">${esc(b.name.slice(0, 22))}</text>`;
    return `<g data-symbol="${gl?.glyph.key ?? ""}"><rect x="${b.x - BLOCK_W / 2}" y="${b.y - h / 2}" width="${BLOCK_W}" height="${h}" rx="6" fill="#fff" stroke="${gl ? "#bbb" : "#111"}" stroke-width="${gl ? 0.8 : 1.5}" transform="rotate(${b.rot} ${b.x} ${b.y})"/>${body}${pins}</g>`;
  }).join("");
  const notes = d.notes.map((n) => `<text x="${n.x}" y="${n.y}" font-size="11" fill="#555">${esc(n.text)}</text>`).join("")
    + (d.dims ?? []).map((c) => `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="#b45309" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/><text x="${(c.x1 + c.x2) / 2}" y="${(c.y1 + c.y2) / 2 - 4}" font-size="10" text-anchor="middle" fill="#b45309">${esc(dimText(d, c))}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY - 30} ${maxX - minX} ${maxY - minY + 30}" font-family="sans-serif"><defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#b45309"/></marker></defs><rect x="${minX}" y="${minY - 30}" width="${maxX - minX}" height="${maxY - minY + 30}" fill="#fff"/>${title ? `<text x="${minX + 10}" y="${minY - 10}" font-size="14" font-weight="bold">${esc(title)}</text>` : ""}${wires}${blocks}${notes}</svg>`;
}

/** Texte d'une cote : texte saisi, sinon longueur × échelle (mm), sinon longueur en unités du plan. */
export function dimText(d: Pick<Diagram, "scale">, c: { x1: number; y1: number; x2: number; y2: number; text?: string }): string {
  if (c.text) return c.text;
  const l = Math.hypot(c.x2 - c.x1, c.y2 - c.y1);
  return d.scale ? `${Math.round(l * d.scale).toLocaleString("fr-FR")} mm` : `${Math.round(l)} u`;
}
export const layerOf = (b: Pick<Block, "layer">) => b.layer || "Général";
/** Calques du schéma (dans l'ordre d'apparition). */
export function layersOf(d: Diagram): string[] { return [...new Set(d.blocks.map(layerOf))]; }
/** Schéma restreint aux calques visibles (blocs masqués et liaisons qui les touchent retirés). */
export function visibleDiagram(d: Diagram): Diagram {
  const hidden = new Set(d.hidden_layers ?? []);
  if (!hidden.size) return d;
  const blocks = d.blocks.filter((b) => !hidden.has(layerOf(b))), ids = new Set(blocks.map((b) => b.id));
  return { ...d, blocks, wires: d.wires.filter((w) => ids.has(w.a.block) && ids.has(w.b.block)) };
}

/** Repère suivant pour un symbole (QF1, QF2…). */
export function nextLabel(d: Diagram, symbol: string): string {
  const prefix = symbol.replace(/[^A-Za-z]/g, "").toUpperCase() || "X";
  let n = 1;
  while (d.blocks.some((b) => b.label === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
