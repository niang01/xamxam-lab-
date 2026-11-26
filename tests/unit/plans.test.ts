import { describe, expect, it } from "vitest";
import { diagramDxf, diagramPdf, SHEETS } from "@/lib/diagram-print";
import { generatorByKind, resolveParams } from "@/lib/schematics-gen";

const g = generatorByKind("demarrage_direct")!;
const d = g.build(resolveParams(g, {}).values).diagram;
const meta = { size: "A3" as const, orientation: "landscape" as const, margin: 10, project: "Atelier", title: "Démarrage direct", number: "E-01", designer: "Awa", date: "25/11/2026" };

describe("Impression des plans", () => {
  it("PDF : format ISO exact (A3 paysage), cartouche, légende, tracé vectoriel", () => {
    const { pdf, mmPerUnit } = diagramPdf(d, meta);
    const s = Buffer.from(pdf).toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain(`/MediaBox [0 0 ${(420 * 72 / 25.4).toFixed(2)} ${(297 * 72 / 25.4).toFixed(2)}]`);
    for (const x of ["(Plan n\\260)", "(E-01)", "(Atelier)", "(Awa)", "(25/11/2026)", "(L\\351gende / nomenclature)"]) expect(s).toContain(x);
    expect(s).toMatch(/ re S/); expect(s).toMatch(/ l S/); // rectangles et lignes vectoriels
    expect(mmPerUnit).toBeGreaterThan(0);
    for (const size of Object.keys(SHEETS) as (keyof typeof SHEETS)[]) {
      const p = Buffer.from(diagramPdf(d, { ...meta, size, orientation: "portrait" }).pdf).toString("latin1");
      expect(p).toContain(`/MediaBox [0 0 ${(SHEETS[size][0] * 72 / 25.4).toFixed(2)} ${(SHEETS[size][1] * 72 / 25.4).toFixed(2)}]`);
    }
  });
  it("DXF R12 : sections, calques, une LINE par côté de bloc et par segment de liaison", () => {
    const x = diagramDxf(d, "Démarrage direct");
    const lines = x.split("\n");
    expect(lines.length % 2).toBe(1); // paires code/valeur + fin de fichier
    expect(x).toContain("AC1009"); expect(x).toContain("LIAISONS"); expect(x.trim().endsWith("EOF")).toBe(true);
    // Lignes des calques blocs et liaisons (les symboles conventionnels ont leur propre calque SYMBOLES).
    const n = lines.filter((l, i) => i % 2 === 1 && l === "LINE" && lines[i + 2] !== "SYMBOLES").length;
    expect(n).toBe(d.blocks.length * 4 + d.wires.length * 3);
    expect(x).not.toMatch(/[^\x00-\x7f]/); // ASCII strict (accents translittérés)
  });
});

import { dimText, layersOf, visibleDiagram, diagramSvg } from "@/lib/diagram";
describe("Plans d'implantation : cotes, échelle, calques", () => {
  const withLayers = { ...d, scale: 20, dims: [{ x1: 0, y1: 0, x2: 300, y2: 0 }, { x1: 0, y1: 0, x2: 0, y2: 100, text: "Hauteur 2,5 m" }], blocks: d.blocks.map((b, i) => ({ ...b, layer: i % 2 ? "Commande" : "Puissance" })) };
  it("texte des cotes : saisi, sinon longueur × échelle", () => {
    expect(dimText(withLayers, withLayers.dims[0]).replace(/[  ]/g, " ")).toBe("6 000 mm");
    expect(dimText(withLayers, withLayers.dims[1])).toBe("Hauteur 2,5 m");
    expect(dimText({}, withLayers.dims[0])).toBe("300 u");
  });
  it("calques masqués absents des exports ; cotes présentes en SVG, PDF et DXF (calque COTES)", () => {
    expect(layersOf(withLayers)).toEqual(["Puissance", "Commande"]);
    const hid = { ...withLayers, hidden_layers: ["Commande"] };
    expect(visibleDiagram(hid).blocks.every((b) => b.layer === "Puissance")).toBe(true);
    expect(visibleDiagram(hid).wires.every((w) => visibleDiagram(hid).blocks.some((b) => b.id === w.a.block))).toBe(true);
    expect(diagramSvg(withLayers)).toContain("6");
    expect(Buffer.from(diagramPdf(withLayers, meta).pdf).toString("latin1")).toContain("(Hauteur 2,5 m)");
    const x = diagramDxf(hid);
    expect(x).toContain("COTES"); expect(x).toContain("BLOCS_PUISSANCE"); expect(x).not.toContain("BLOCS_COMMANDE\n0\nLINE");
  });
});
