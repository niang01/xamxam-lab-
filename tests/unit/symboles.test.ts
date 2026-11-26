/** Symboles conventionnels (CEI 60617, ISO 1219, ISA 5.1) : géométrie, choix par le nom, rendu SVG / PDF / DXF. */
import { describe, expect, it } from "vitest";
import { GLYPHS, glyphFor, placeGlyph } from "@/lib/symbols";
import { LIBRARY } from "@/lib/library";
import { GENERATORS, resolveParams } from "@/lib/schematics-gen";
import { blockGlyph, diagramSvg, type Diagram } from "@/lib/diagram";
import { diagramDxf, diagramPdf } from "@/lib/diagram-print";

const gen = (kind: string): Diagram => { const g = GENERATORS.find((x) => x.kind === kind)!; return g.build(resolveParams(g, {}).values).diagram; };

describe("Symboles normalisés", () => {
  it("chaque symbole tient dans son cadre, polylignes valides, norme citée", () => {
    expect(Object.keys(GLYPHS).length).toBeGreaterThanOrEqual(60);
    for (const [k, g] of Object.entries(GLYPHS)) {
      expect(g.norm, k).toMatch(/CEI|ISO|ISA|Usage/);
      for (const l of g.lines) { expect(l.length, k).toBeGreaterThanOrEqual(2); for (const [x, y] of l) { expect(Math.abs(x), k).toBeLessThanOrEqual(32); expect(Math.abs(y), k).toBeLessThanOrEqual(22); } }
    }
  });
  it("le nom prime sur le code ambigu : Q = transistor ou sectionneur, V = source ou vanne", () => {
    expect(glyphFor("Transistor NPN", "Q")!.key).toBe("npn");
    expect(glyphFor("Sectionneur porte-fusibles", "Q")!.key).toBe("fuse_disconnector");
    expect(glyphFor("Source de tension", "V")!.key).toBe("vsource");
    expect(glyphFor("Vanne manuelle", "V")!.key).toBe("valve");
    expect(glyphFor("Disjoncteur différentiel", "QF")!.key).toBe("rcd");
    expect(glyphFor("Arrêt d'urgence", "S")!.key).toBe("emergency");
    expect(glyphFor("Driver de moteur pas à pas", "DRV")).toBeNull();
    expect(glyphFor("Automate programmable (API)", "PLC")).toBeNull();   // élément fonctionnel rectangulaire
  });
  it("bulle ISA : le repère de l'instrument est inscrit", () => {
    const g = glyphFor("Capteur de pH", "SPH")!;
    expect(g.key).toBe("instrument"); expect(g.texts.map((t) => t.s)).toContain("SPH");
  });
  it("bibliothèque : familles cohérentes (aucune erreur de famille)", () => {
    for (const i of LIBRARY) {
      const k = glyphFor(i.name, i.symbol)?.key ?? null;
      if (/^disjoncteur/i.test(i.name)) expect(["breaker", "rcd"], i.name).toContain(k);
      if (/^pompe/i.test(i.name)) expect(k, i.name).toBe("pump");
      if (k === "battery") expect(i.name, i.name).toMatch(/^Batterie/);
      if (k === "pump") expect(i.name).toMatch(/^(Pompe|Circulateur)/);
      if (/^Moteur asynchrone triphas/.test(i.name)) expect(k).toBe("motor3");
    }
    const covered = LIBRARY.filter((i) => glyphFor(i.name, i.symbol)).length;
    expect(covered / LIBRARY.length).toBeGreaterThan(0.55);
  });
  it("rotation : borne droite (30, 0) tournée de 90° → (0, 30)", () => {
    const p = placeGlyph({ key: "x", title: "", norm: "", lines: [[[30, 0], [0, 0]]], texts: [] }, 0, 0, 90);
    expect(p.lines[0][0][0]).toBeCloseTo(0); expect(p.lines[0][0][1]).toBeCloseTo(30);
  });
  it("schéma de démarrage : symboles dans le SVG, la planche PDF et le DXF (calque SYMBOLES)", () => {
    const d = gen("demarrage_direct");
    const keys = d.blocks.map((b) => blockGlyph(b)?.glyph.key);
    expect(keys).toEqual(expect.arrayContaining(["breaker", "coil", "thermal_relay", "motor3"]));
    const svg = diagramSvg(d);
    expect(svg).toContain('data-symbol="motor3"'); expect(svg).toContain("Moteur asynchrone triphasé (CEI 60617)");
    const dxf = diagramDxf(d);
    expect(dxf).toContain("SYMBOLES"); expect((dxf.match(/\nSYMBOLES\n/g) ?? []).length).toBeGreaterThan(50);
    const meta = { size: "A3", orientation: "landscape", margin: 10, project: "", title: "Démarrage", number: "E-01", designer: "", date: "2026-11-26" } as const;
    expect(Buffer.from(diagramPdf(d, meta).pdf).toString("latin1")).toContain("(M)");
  });
});
