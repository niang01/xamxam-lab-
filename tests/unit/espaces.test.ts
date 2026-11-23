import { describe, expect, it } from "vitest";
import { checkDiagram, bomOf, diagramSvg, nextLabel, pinPoint, type Diagram } from "@/lib/diagram";
import { coldRoom, solarBattery, tank } from "@/lib/scenarios";
import { massReport, volumeM3 } from "@/lib/assembly";
import { LIBRARY, DISCIPLINE_LABEL } from "@/lib/library";
import { TEMPLATES, LEVELS, instantiate } from "@/lib/project-templates";

const block = (id: string, label: string, pins: string[], x = 0, params: Record<string, string> = {}) => ({ id, label, name: label, symbol: "X", pins, x, y: 0, rot: 0 as const, params, component_id: null });

describe("Bibliothèque et modèles", () => {
  it("12 disciplines couvertes, aucun doublon, paramètres sans valeur inventée", () => {
    expect(new Set(LIBRARY.map((c) => c.discipline))).toEqual(new Set(Object.keys(DISCIPLINE_LABEL)));
    expect(LIBRARY.length).toBeGreaterThanOrEqual(120);
    expect(new Set(LIBRARY.map((c) => c.name)).size).toBe(LIBRARY.length);
    for (const c of LIBRARY) { expect(c.description.length).toBeGreaterThan(10); for (const p of c.params) expect(Object.keys(p).sort()).toEqual(["key", "label", "unit"]); }
  });
  it("chaque modèle de projet n'utilise que des composants de la bibliothèque ; niveaux complets", () => {
    const names = new Set(LIBRARY.map((c) => c.name));
    for (const t of TEMPLATES) for (const [n] of t.components) expect(names.has(n), `${t.key}: ${n}`).toBe(true);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);
    for (const l of LEVELS) expect(instantiate(TEMPLATES[0], l.key).methodology.length).toBeGreaterThan(40);
    expect(instantiate(TEMPLATES[0], "startup").tasks).toContain("Modèle économique (Business Model Canvas)");
  });
});

describe("Schémas 2D", () => {
  const d: Diagram = { discipline: "iot", blocks: [block("a", "MCU1", ["3V3", "GND", "GPIO"]), block("b", "K1", ["VCC", "GND", "IN"], 300, { u_coil: "" })], wires: [{ a: { block: "a", pin: 0 }, b: { block: "b", pin: 0 } }, { a: { block: "a", pin: 1 }, b: { block: "b", pin: 1 } }], notes: [] };
  it("vérification : broches libres, paramètres vides, liaisons invalides, doublons", () => {
    const c = checkDiagram(d);
    expect(c.errors).toEqual([]); expect(c.nets).toBe(2);
    expect(c.warnings).toEqual(expect.arrayContaining(["Broche non raccordée : MCU1.GPIO", "Broche non raccordée : K1.IN", "K1 : 1 paramètre(s) sans valeur"]));
    const bad = checkDiagram({ ...d, wires: [...d.wires, { a: { block: "a", pin: 0 }, b: { block: "a", pin: 0 } }, { a: { block: "z", pin: 0 }, b: { block: "a", pin: 0 } }, { a: { block: "b", pin: 0 }, b: { block: "a", pin: 0 } }] });
    expect(bad.errors).toEqual(expect.arrayContaining(["Liaison d'une broche sur elle-même (MCU1.3V3)", "Liaison vers un bloc inexistant"]));
    expect(bad.warnings.join(" ")).toMatch(/Liaison en double/);
  });
  it("géométrie des broches avec rotation, nomenclature, repères, export SVG échappé", () => {
    const b = block("a", "MCU1", ["1", "2"]);
    const [x0, y0] = pinPoint(b, 0); const [x1] = pinPoint({ ...b, rot: 180 }, 0);
    expect(x0).toBeLessThan(0); expect(x1).toBe(-x0); expect(y0).toBe(0);
    expect(bomOf({ ...d, blocks: [...d.blocks, { ...block("c", "K2", ["1"]), name: "K1" }] }).find((l) => l.name === "K1")!.qty).toBe(2);
    expect(nextLabel(d, "K")).toBe("K2");
    const svg = diagramSvg({ ...d, notes: [{ x: 0, y: 0, text: "<script>" }] }, "Essai & <test>");
    expect(svg).toContain("&lt;script&gt;"); expect(svg).not.toContain("<script>"); expect(svg).toContain("Essai &amp; &lt;test&gt;");
  });
});

describe("Studio 4D (bilans de conservation)", () => {
  it("énergie solaire : production = ∫ irradiance, bilan nul, paramètres manquants signalés", () => {
    const r = solarBattery({ pvKwc: 1, dailyIrradiationKwhM2: 6, performanceRatio: 1, sunriseH: 6, sunsetH: 18, batteryKwh: 5, socInitPct: 50, socMinPct: 20, chargeEff: 0.9, loadW: 100, days: 3, stepMin: 5 });
    expect(r.missing).toEqual([]);
    expect(r.summary.pv.value / 3).toBeCloseTo(6, 1); // 1 kWc × 6 kWh/m²/j × PR 1
    expect(r.summary.load.value).toBeCloseTo(7.2, 6);
    expect(r.balance!.residual).toBeLessThan(1e-6);
    expect(Math.min(...r.series!.soc_pct)).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(solarBattery({ pvKwc: null, dailyIrradiationKwhM2: 6, performanceRatio: 1, sunriseH: 6, sunsetH: 18, batteryKwh: 5, socInitPct: 50, socMinPct: 20, chargeEff: 0.9, loadW: null, days: 1, stepMin: 15 }).missing).toEqual(["pvKwc", "loadW ou loadProfileW"]);
  });
  it("réservoir : bilan de volume nul, pompage limité à la plage horaire, déficit compté", () => {
    const r = tank({ volumeM3: 10, levelInitPct: 50, pumpFlowM3h: 3, pumpOnBelowPct: 30, pumpOffAbovePct: 95, demandM3h: 0.6, pumpHoursStart: 8, pumpHoursEnd: 17, days: 2, stepMin: 10 });
    expect(r.balance!.residual).toBeLessThan(1e-9);
    const s = r.series!;
    s.t.forEach((t, i) => { if (s.pump[i]) expect(t % 24 >= 8 && t % 24 < 17).toBe(true); });
    const dry = tank({ volumeM3: 1, levelInitPct: 10, pumpFlowM3h: 0.1, pumpOnBelowPct: 30, pumpOffAbovePct: 95, demandM3h: 1, pumpHoursStart: 8, pumpHoursEnd: 9, days: 1, stepMin: 10 });
    expect(dry.summary.shortage.value).toBeGreaterThan(0); expect(dry.balance!.residual).toBeLessThan(1e-9);
  });
  it("chambre froide : sans froid, tend vers la température d'équilibre ; coupure → remontée", () => {
    const off = coldRoom({ uaWK: 20, heatCapacityKJK: 500, tOutC: 35, tInitC: 5, setpointC: 3, differentialK: 2, coolingW: 0, internalW: 0, outageStartH: null, outageEndH: null, hours: 300, stepMin: 5 });
    expect(off.summary.tMax.value).toBeGreaterThan(34.5); // τ = C/UA ≈ 6,9 h
    expect(off.balance!.residual).toBeLessThan(1e-6);
    const cut = coldRoom({ uaWK: 25, heatCapacityKJK: 2000, tOutC: 35, tInitC: 4, setpointC: 3, differentialK: 2, coolingW: 1500, internalW: 100, outageStartH: 10, outageEndH: 16, hours: 48, stepMin: 5 });
    const s = cut.series!; const at = (h: number) => s.temp_c[s.t.findIndex((t) => t >= h)];
    expect(at(16)).toBeGreaterThan(at(10));
    expect(s.compressor[s.t.findIndex((t) => t >= 12)]).toBe(0);
  });
});

describe("Maquette 3D", () => {
  it("volumes exacts, masse et centre de gravité ; masse refusée sans matériau", () => {
    expect(volumeM3({ shape: "box", dims: [1000, 1000, 1000] })).toBe(1);
    expect(volumeM3({ shape: "cylinder", dims: [1000, 1000, 0] })).toBeCloseTo(Math.PI / 4, 12);
    expect(volumeM3({ shape: "sphere", dims: [1000, 0, 0] })).toBeCloseTo(Math.PI / 6, 12);
    const base = { id: "a", name: "A", shape: "box" as const, dims: [100, 100, 100] as [number, number, number], rot: [0, 0, 0] as [number, number, number], color: "#ffffff", hollow: false };
    const r = massReport({ parts: [{ ...base, pos: [0, 0, 0], density: 7850 }, { ...base, id: "b", name: "B", pos: [300, 0, 0], density: 7850 }] });
    expect(r.totalKg).toBeCloseTo(15.7, 6); expect(r.cog).toEqual([150, 0, 0]);
    expect(massReport({ parts: [{ ...base, pos: [0, 0, 0], density: null }] }).totalKg).toBeNull();
  });
});
