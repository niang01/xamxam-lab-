import { describe, expect, it } from "vitest";
import { SOFTWARE } from "@/lib/studies";
import { ELECTRICAL, nextRating } from "@/lib/studies/electrical";
import { studyMarkdown, studySheets } from "@/lib/studies/report";
import { generatorByKind, resolveParams } from "@/lib/schematics-gen";
import { LIBRARY } from "@/lib/library";

/** Tableau d'essai (données de TEST, non normatives) : sert uniquement à vérifier l'algorithme. */
const TEST_TABLE = { reference: "Tableau d'essai (test)", rows: [{ s: 1.5, iz: 15 }, { s: 2.5, iz: 21 }, { s: 4, iz: 28 }, { s: 6, iz: 36 }, { s: 10, iz: 50 }] };

describe("Logiciels de dimensionnement — socle", () => {
  it("registre : clés uniques, exemple complet, nomenclature limitée aux composants de la bibliothèque", () => {
    expect(new Set(SOFTWARE.map((s) => s.key)).size).toBe(SOFTWARE.length);
    const names = new Set(LIBRARY.map((c) => c.name));
    for (const sw of SOFTWARE) {
      const r = sw.run(sw.example, { ampacity: TEST_TABLE });
      expect(r.missing, sw.key).toEqual([]);
      for (const b of r.bom) expect(names.has(b.name), `${sw.key} : ${b.name}`).toBe(true);
      if (r.diagram) { const g = generatorByKind(r.diagram.kind)!; const p = resolveParams(g, r.diagram.params); expect(p.errors, sw.key).toEqual([]); expect(g.build(p.values).checks.every((c) => c.ok), sw.key).toBe(true); }
      expect(studyMarkdown(sw, "Essai", sw.example, r)).toContain("## 3. Calculs détaillés");
      expect(studySheets(sw, sw.example, r)).toHaveLength(3);
    }
  });
  it("aucune valeur supposée : champs vides → données manquantes, aucun calcul", () => {
    for (const sw of SOFTWARE) { const r = sw.run({}, { ampacity: null }); expect(r.ok).toBe(false); expect(r.missing.length).toBeGreaterThan(0); expect(r.bom).toEqual([]); }
  });
});

describe("Installation électrique", () => {
  const run = (patch: Record<string, unknown> = {}) => ELECTRICAL.run({ ...ELECTRICAL.example, ...patch }, { ampacity: TEST_TABLE });
  it("calibres normalisés", () => { expect(nextRating(2.61)).toBe(4); expect(nextRating(16)).toBe(16); expect(nextRating(16.01)).toBe(20); expect(nextRating(700)).toBeNull(); });
  it("valeurs calculées à la main : Ib, In, section, chute de tension", () => {
    const r = run();
    const prises = r.steps.find((s) => s.title.includes("Prises séjour"))!;
    // Ib = 2500 / 230 = 10,87 A ; In = max(Ib, 16) → 16 A ; Iz×K ≥ 16 → 2,5 mm² (21 A)
    expect(prises.lines.find((l) => l.label === "Courant d'emploi Ib")!.value).toBeCloseTo(10.87, 1);
    expect(prises.lines.find((l) => l.label === "Calibre de protection In")!.value).toBe(16);
    expect(prises.lines.find((l) => l.label === "Section (échauffement)")!.value).toBe(2.5);
    // ΔU% = 100 × 2 × ρ70 × 22 × 10,87 / 2,5 / 230 ; ρ70 = (1/58)(1 + 0,00393 × 50)
    const rho = (1 / 58) * (1 + 0.00393 * 50);
    expect(prises.lines.find((l) => l.label === "Chute de tension")!.value).toBeCloseTo((100 * 2 * rho * 22 * (2500 / 230)) / 2.5 / 230, 2);
    // Moteur : cos φ < 1 → la réactance entre dans le calcul
    const m = r.steps.find((s) => s.title.includes("Pompe"))!;
    expect(m.lines.find((l) => l.label === "Courant d'emploi Ib")!.value).toBeCloseTo(1100 / (230 * 0.85 * 0.8), 1);
  });
  it("la limite de chute de tension fait augmenter la section", () => {
    const r = run({ du_max: 1 });
    const prises = r.steps.find((s) => s.title.includes("Prises séjour"))!;
    expect(prises.lines.find((l) => l.label === "Section retenue (chute de tension)")!.value).toBeGreaterThan(2.5);
  });
  it("sans tableau normatif, sans λ pour un moteur : signalé, pas de calcul inventé", () => {
    expect(ELECTRICAL.run(ELECTRICAL.example, { ampacity: null }).missing.join()).toContain("tableau normatif");
    expect(run({ lambda: null }).missing.join()).toContain("réactance");
  });
  it("appareil général, nomenclature et unifilaire", () => {
    const r = run();
    const gen = r.steps.find((s) => s.title === "Appareil général")!;
    const s = 600 + 2500 + 2200 + 1100 / (0.85 * 0.8);
    expect(gen.lines[2].value).toBeCloseTo((0.7 * s) / 230, 1);
    expect(r.bom.find((b) => b.name === "Interrupteur différentiel")!.qty).toBe(2);
    expect(r.bom.find((b) => b.name === "Point lumineux (DCL)")!.qty).toBe(6);
    expect(r.diagram!.kind).toBe("tableau_unifilaire");
    expect(String(r.diagram!.params.circuits).split(";")).toHaveLength(4);
  });
});

import { h0Daily, monthlyPoa, rbDaily, declination, sunsetHourAngle } from "@/lib/studies/solar-geometry";
import { PV } from "@/lib/studies/pv";

describe("Géométrie solaire", () => {
  it("H0 : exemple 1.10.1 de Duffie & Beckman (φ = 43° N, 15 avril) ≈ 33,8 MJ/m² = 9,39 kWh/m²", () => {
    expect(h0Daily(43, 105)).toBeCloseTo(33.8 / 3.6, 1);
  });
  it("Rb numérique = formule fermée de Klein pour une surface orientée vers l'équateur", () => {
    const R = Math.PI / 180;
    const klein = (phi: number, n: number, beta: number) => {
      const d = declination(n), ws = sunsetHourAngle(phi, d);
      const wsp = Math.min(ws, Math.acos(Math.max(-1, Math.min(1, -Math.tan((phi - beta) * R) * Math.tan(d * R)))) / R);
      return (Math.cos((phi - beta) * R) * Math.cos(d * R) * Math.sin(wsp * R) + (Math.PI / 180) * wsp * Math.sin((phi - beta) * R) * Math.sin(d * R))
        / (Math.cos(phi * R) * Math.cos(d * R) * Math.sin(ws * R) + (Math.PI / 180) * ws * Math.sin(phi * R) * Math.sin(d * R));
    };
    for (const [phi, n, beta] of [[14.8, 17, 15], [43, 105, 60], [-25, 162, 30], [5, 344, 10]]) {
      const b = phi < 0 ? -beta : beta; // hémisphère sud : surface orientée nord (γ = 180)
      expect(rbDaily(phi, n, beta, phi < 0 ? 180 : 0)).toBeCloseTo(klein(phi, n, b), 2);
    }
  });
  it("plan horizontal : H_T = H ; orientation est/ouest symétrique", () => {
    const ghi = [5, 6, 7, 7, 7, 6, 5, 5, 5, 6, 5, 5];
    expect(monthlyPoa({ lat: 14.8, ghi, tilt: 0, azimuth: 0, albedo: 0.2 }).months.map((m) => +m.poa.toFixed(6))).toEqual(ghi);
    const e = monthlyPoa({ lat: 14.8, ghi, tilt: 30, azimuth: -90, albedo: 0.2 }).months, w = monthlyPoa({ lat: 14.8, ghi, tilt: 30, azimuth: 90, albedo: 0.2 }).months;
    e.forEach((m, i) => expect(m.poa).toBeCloseTo(w[i].poa, 3));
  });
});

describe("Photovoltaïque", () => {
  const run = (patch: Record<string, unknown> = {}) => PV.run({ ...PV.example, ...patch }, {});
  it("valeurs recalculées : besoins, puissance crête (mois critique), batteries", () => {
    const r = run();
    const need = r.steps.find((s) => s.title.startsWith("2."))!.lines.find((l) => l.label === "Énergie à produire par le champ")!.value as number;
    expect(need).toBeCloseTo((2640 / 0.92) / 0.95, 0);
    const bat = r.steps.find((s) => s.title.startsWith("6."))!;
    expect(bat.lines[0].value).toBeCloseTo((2640 / 0.92) * 2 / (0.8 * 0.95), 0);
    const pr = r.steps.find((s) => s.title.startsWith("3."))!.lines.map((l) => l.value as number);
    const poa = r.steps.find((s) => s.title.startsWith("1."))!.lines.map((l) => l.value as number);
    const pc = Math.max(...poa.map((h, i) => need / (h * pr[i])));
    expect(r.steps.find((s) => s.title.startsWith("4."))!.lines[0].value).toBeCloseTo(pc, -1);
    expect(r.bom[0].name).toBe("Module photovoltaïque");
    expect(r.diagram?.kind).toBe("unifilaire_pv");
  });
  it("chaîne : Voc au froid ≤ tension maximale ; refus si aucune association possible", () => {
    const r = run();
    const voc = r.steps.find((s) => s.title.startsWith("5."))!.lines.find((l) => l.label.startsWith("Tension de chaîne Voc"))!.value as number;
    expect(voc).toBeLessThanOrEqual(150);
    const bad = run({ v_dc_max: 40 });
    expect(bad.warnings.join()).toContain("Aucune association");
  });
  it("raccordé au réseau : couverture annuelle exigée, pas de batteries", () => {
    expect(run({ system: "reseau", coverage: null }).missing.join()).toContain("taux de couverture");
    const r = run({ system: "reseau", coverage: 100 });
    expect(r.ok).toBe(true); expect(r.bom.some((b) => b.name.startsWith("Batterie"))).toBe(false); expect(r.diagram).toBeNull();
  });
  it("irradiation manquante ou incomplète : signalée, aucun calcul", () => {
    const r = run({ ghi: [5, 5, null, 5, 5, 5, 5, 5, 5, 5, 5, 5] });
    expect(r.ok).toBe(false); expect(r.missing.join()).toContain("12 mois"); expect(r.steps).toEqual([]);
  });
});

import { atmPressure, frictionFactor, interp, operatingPoint, vapourPressure, waterNu } from "@/lib/studies/hydraulics";
import { PUMPING } from "@/lib/studies/pumping";

describe("Hydraulique", () => {
  it("propriétés de l'eau et de l'air : valeurs de référence", () => {
    expect(waterNu(20)).toBeCloseTo(1.002e-6, 8); // μ(20 °C) ≈ 1,002 mPa·s
    expect(vapourPressure(20)).toBeCloseTo(2339, -1);
    expect(vapourPressure(100)).toBeCloseTo(101325, -3);
    expect(atmPressure(0)).toBe(101325);
    expect(atmPressure(1000)).toBeCloseTo(89875, -2);
  });
  it("frottement : 64/Re en laminaire ; Colebrook-White proche de Haaland (± 3 %) ; tuyau lisse (Blasius)", () => {
    expect(frictionFactor(1000, 0.001)).toBeCloseTo(0.064, 6);
    for (const [re, e] of [[4e4, 1e-3], [1e5, 1e-4], [1e6, 5e-5]]) {
      const haaland = (-1.8 * Math.log10((e / 3.7) ** 1.11 + 6.9 / re)) ** -2;
      expect(Math.abs(frictionFactor(re, e) / haaland - 1)).toBeLessThan(0.03);
    }
    expect(Math.abs(frictionFactor(2e4, 0) / (0.316 / 2e4 ** 0.25) - 1)).toBeLessThan(0.03); // Blasius : approximation à quelques %
  });
  it("interpolation et point de fonctionnement", () => {
    const pump = [{ x: 0, y: 50 }, { x: 10, y: 30 }];
    expect(interp(pump, 5)).toBe(40); expect(interp(pump, 11)).toBeNull();
    const op = operatingPoint(pump, (q) => 20 + 0.1 * q * q)!;
    expect(op.q).toBeCloseTo((-2 + Math.sqrt(4 + 4 * 0.1 * 30)) / (2 * 0.1), 4); // 50 − 2q = 20 + 0,1 q²
    expect(operatingPoint(pump, () => 60)).toBeNull();
  });
});

describe("Pompage", () => {
  const run = (patch: Record<string, unknown> = {}) => PUMPING.run({ ...PUMPING.example, ...patch }, {});
  it("besoins, Hg, HMT et point de fonctionnement cohérents", () => {
    const r = run();
    expect(r.ok).toBe(true);
    const s1 = r.steps[0].lines;
    expect(s1.find((l) => l.label === "Volume journalier")!.value).toBeCloseTo(9 + 3.2 + 20, 6);
    expect(s1.find((l) => l.label === "Débit de pompage nécessaire")!.value).toBeCloseTo(32.2 / 7, 3);
    expect(r.steps[1].lines.find((l) => l.label.startsWith("Hauteur géométrique totale"))!.value).toBe(35 + 8 + 12);
    const hmt = r.steps.find((s) => s.title.startsWith("4."))!.lines;
    expect(hmt[1].value as number).toBeCloseTo(55 + (hmt[0].value as number), 3);
    const op = r.steps.find((s) => s.title.startsWith("5."))!.lines;
    const q = op.find((l) => l.label === "Débit au point de fonctionnement")!.value as number, h = op.find((l) => l.label === "Hauteur au point de fonctionnement")!.value as number;
    // le point est sur la courbe de la pompe (interpolation entre 6 et 8 m³/h)
    expect(h).toBeCloseTo(72 + ((q - 6) / 2) * (50 - 72), 2);
    const pw = r.steps.find((s) => s.title.startsWith("7."))!.lines;
    expect(pw[0].value as number).toBeCloseTo(1000 * 9.81 * (q / 3600) * h, -1);
    expect(r.diagram?.kind).toBe("demarrage_direct");
  });
  it("pompe trop faible : pas de point de fonctionnement, aucune puissance inventée", () => {
    const r = run({ curve: [{ q: 0, h: 40, eta: 0 }, { q: 4, h: 30, eta: 50 }, { q: 8, h: 10, eta: 40 }] });
    expect(r.warnings.join()).toContain("ne croise pas"); expect(r.bom).toEqual([]);
  });
  it("pompe de surface : NPSH disponible calculé, NPSH requis exigé", () => {
    const surface = { source: "surface", suction_height: 4, static_level: null, drawdown: null, pipes: [{ name: "Aspiration", part: "aspiration", length: 6, d: 51.4, rough: 0.05, k: 3 }, { name: "Refoulement", part: "refoulement", length: 200, d: 51.4, rough: 0.0015, k: 4 }], curve: [{ q: 0, h: 45, eta: 0 }, { q: 4, h: 38, eta: 55 }, { q: 8, h: 25, eta: 60 }, { q: 12, h: 5, eta: 45 }] };
    expect(run(surface).missing.join()).toContain("NPSH requis");
    const r = run({ ...surface, npsh_r: 3, npsh_margin: 0.5 });
    const n = r.steps.find((s) => s.title.startsWith("6."))!;
    expect(n.lines.find((l) => l.label === "NPSH disponible")!.value as number).toBeGreaterThan(4);
    expect(n.ok).toBe(true);
  });
  it("alimentation solaire : champ dimensionné sur le mois critique", () => {
    const r = run({ supply: "solaire", phases: null, u: 300, cos: null, lat: 14.8, ghi: [5.4, 6.2, 6.8, 7, 6.9, 6.4, 5.7, 5.4, 5.5, 5.6, 5.4, 5], tilt: 15, azimuth: 0, albedo: 0.2, pr: 0.65, pmax: 450 });
    expect(r.ok).toBe(true);
    const s = r.steps.find((x) => x.title.startsWith("9."))!;
    expect(s.lines.find((l) => l.label === "Modules")!.value as number).toBeGreaterThan(3);
    expect(r.bom.some((b) => b.name === "Contrôleur de pompe solaire")).toBe(true);
  });
});

import { DRYING } from "@/lib/studies/drying";
import { BIOMASS } from "@/lib/studies/biomass";
import { COMPOST } from "@/lib/studies/compost";
import { SOLAR_THERMAL } from "@/lib/studies/solar-thermal";
import { adiabaticTo, enthalpy, humidityRatio, relHumidity, LHV_CH4 } from "@/lib/studies/thermo";

const line = (r: { steps: { title: string; lines: { label: string; value: number | string }[] }[] }, step: string, label: string) => r.steps.find((s) => s.title.startsWith(step))!.lines.find((l) => l.label.startsWith(label))!.value;

describe("Psychrométrie", () => {
  it("humidité absolue, évolution adiabatique à enthalpie constante jusqu'à φ visé", () => {
    const w = humidityRatio(30, 0.6);
    expect(w).toBeCloseTo(0.0161, 3);
    const out = adiabaticTo(60, w, 0.7)!;
    expect(enthalpy(out.t, out.w)).toBeCloseTo(enthalpy(60, w), 3);
    expect(relHumidity(out.t, out.w)).toBeCloseTo(0.7, 4);
    expect(adiabaticTo(25, humidityRatio(25, 0.95), 0.5)).toBeNull();
  });
});

describe("Séchage solaire", () => {
  it("bilan de masse et besoin thermique recalculés", () => {
    const r = DRYING.run(DRYING.example, {});
    expect(r.ok).toBe(true);
    expect(line(r, "1.", "Eau à évaporer")).toBeCloseTo((100 * (0.85 - 0.12)) / 0.88, 2);
    const mAir = line(r, "2.", "Masse d'air sec") as number, dw = (line(r, "2.", "Eau absorbée") as number) / 1000;
    expect(mAir * dw).toBeCloseTo(82.955, 0);
    expect(line(r, "4.", "Nombre de claies")).toBe(Math.ceil(100 / 8 / 1));
    expect(r.bom.some((b) => b.name === "Capteur solaire à air")).toBe(true);
  });
  it("teneur finale ≥ initiale refusée ; air trop humide signalé", () => {
    expect(DRYING.run({ ...DRYING.example, xf: 90 }, {}).missing.join()).toContain("teneur en eau finale");
    expect(DRYING.run({ ...DRYING.example, t_max: 31, rh_amb: 95, rh_out: 50 }, {}).warnings.join()).toContain("ne peut pas absorber");
  });
});

describe("Biomasse et biogaz", () => {
  it("matière volatile, biogaz, digesteur (max TSH / charge organique), énergie", () => {
    const r = BIOMASS.run(BIOMASS.example, {});
    expect(r.ok).toBe(true);
    expect(line(r, "1.", "Biogaz")).toBeCloseTo(500 * 0.12 * 0.8 * 0.3 + 200 * 0.15 * 0.85 * 0.6, 3);
    expect(line(r, "2.", "Volume utile retenu")).toBeCloseTo(Math.max(0.9 * 40, (48 + 25.5) / 3), 3);
    const ch4 = 14.4 * 0.6 + 15.3 * 0.58;
    expect(line(r, "3.", "Énergie primaire")).toBeCloseTo((ch4 * LHV_CH4) / 3.6, 1);
  });
  it("potentiel biogaz absent : signalé, aucune production inventée", () => {
    const r = BIOMASS.run({ ...BIOMASS.example, feeds: [{ name: "X", mass: 100, ms: 10, mv: 80, bmp: null, ch4: 60 }] }, {});
    expect(r.missing.join()).toContain("potentiel biogaz"); expect(r.steps).toEqual([]);
  });
});

describe("Compostage", () => {
  it("C/N recalculé et ajustement exact au C/N visé", () => {
    const r = COMPOST.run(COMPOST.example, {});
    const dry = (m: number, w: number) => m * (1 - w);
    const c = dry(2000, 0.75) * 0.4 + dry(400, 0.12) * 0.46 + dry(800, 0.6) * 0.44, n = dry(2000, 0.75) * 0.024 + dry(400, 0.12) * 0.006 + dry(800, 0.6) * 0.02;
    expect(line(r, "1.", "Rapport C/N")).toBeCloseTo(c / n, 2);
    expect(line(r, "2.", "C/N obtenu")).toBeCloseTo(25, 6);
    expect(r.warnings.join()).toContain("supérieure");
  });
});

describe("Solaire thermique", () => {
  it("besoin, rendement du capteur, couverture plafonnée à 100 %", () => {
    const r = SOLAR_THERMAL.run(SOLAR_THERMAL.example, {});
    expect(r.ok).toBe(true);
    expect(line(r, "2.", "Besoin du mois")).toBeCloseTo((200 * 4186 * (50 - 23)) / 3.6e6, 3);
    for (const l of r.steps.find((s) => s.title.startsWith("3."))!.lines.slice(0, 12)) expect(l.value as number).toBeLessThanOrEqual(100);
    const bad = SOLAR_THERMAL.run({ ...SOLAR_THERMAL.example, eta0: 0.2, a1: 30 }, {});
    expect(bad.warnings.join()).toContain("Rendement nul");
  });
});

import { modelFromStudy } from "@/lib/studies/model3d";
import { assemblySchema, massReport } from "@/lib/assembly";
import { SOFTWARE as ALLSW } from "@/lib/studies";
describe("Maquette 3D depuis une étude", () => {
  const sw = (k: string) => ALLSW.find((s) => s.key === k)!;
  it("photovoltaïque : un volume par module, dimensions de la fiche ; sans dimensions → refus motivé", () => {
    const pv = sw("photovoltaique"), r = pv.run(pv.example, {});
    const m = modelFromStudy("photovoltaique", pv.example, r);
    expect(assemblySchema.safeParse(m.assembly).success).toBe(true);
    expect(m.assembly!.parts.filter((p) => p.id.startsWith("M"))).toHaveLength(2);
    expect(m.assembly!.parts[0].dims[0]).toBe(1134);
    const no = modelFromStudy("photovoltaique", { ...pv.example, mod_l: null }, r);
    expect(no.assembly).toBeNull(); expect(no.missing.join()).toContain("longueur");
  });
  it("séchoir, chambre froide, poutre : volumes aux dimensions de l'étude ; logiciel sans maquette : explication", () => {
    for (const k of ["sechage-solaire", "froid", "genie-civil"]) { const s = sw(k); const m = modelFromStudy(k, s.example, s.run(s.example, {})); expect(assemblySchema.safeParse(m.assembly).success, k).toBe(true); expect(massReport(m.assembly!).parts.length).toBeGreaterThan(0); }
    const cf = modelFromStudy("froid", sw("froid").example, sw("froid").run(sw("froid").example, {}));
    expect(cf.assembly!.parts[0].dims).toEqual([4000, 3000, 2500]);
    expect(modelFromStudy("reseaux", {}, sw("reseaux").run(sw("reseaux").example, {})).note).toContain("non disponible");
  });
});
