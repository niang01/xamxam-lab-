import { describe, expect, it } from "vitest";
import { ohm, acPower, voltageDrop, cableSection, designCurrent, powerBalance, resistivity } from "@/lib/eng/electrical";
import { pvProduction, vocAtTemp, stringSizing, batterySizing, pumpSizing, economics } from "@/lib/eng/solar";
import { torque, gearTrain, cylinderForce } from "@/lib/eng/mechanical";
import { carnotCop, wallLoad } from "@/lib/eng/thermal";
import { subnet, vlsm, parseIpv4 } from "@/lib/eng/network";

const v = (r: { outputs: Record<string, { value: number }> }, k: string) => r.outputs[k].value;

describe("Electrical", () => {
  it("loi d'Ohm à partir de deux grandeurs", () => {
    const r = ohm({ u: 12, r: 470 });
    expect(r.ok).toBe(true);
    expect(v(r, "i")).toBeCloseTo(12 / 470, 6);
    expect(v(r, "p")).toBeCloseTo(144 / 470, 5);
    expect(ohm({ u: 12 }).missing.length).toBe(1);
  });
  it("signale trois grandeurs incohérentes", () => { expect(ohm({ u: 10, i: 1, r: 5 }).warnings.length).toBe(1); });
  it("puissances triphasées", () => {
    const r = acPower({ system: "three", u: 400, i: 10, cosPhi: 0.8 });
    expect(v(r, "s")).toBeCloseTo(Math.sqrt(3) * 4000, 1);
    expect(v(r, "p")).toBeCloseTo(Math.sqrt(3) * 3200, 1);
    expect(v(r, "q")).toBeCloseTo(Math.sqrt(3) * 2400, 1);
  });
  it("courant d'emploi", () => { expect(v(designCurrent({ system: "single", pW: 2300, u: 230, cosPhi: 1, efficiency: 1 }), "ib")).toBeCloseTo(10, 6); });
  it("résistivité du cuivre corrigée en température", () => { expect(resistivity("copper", 20)).toBeCloseTo(1 / 58, 9); expect(resistivity("copper", 70)).toBeCloseTo((1 / 58) * (1 + 0.00393 * 50), 9); });
  it("chute de tension monophasée cos φ = 1 (valeur de référence calculée à la main)", () => {
    const r = voltageDrop({ system: "single", u: 230, i: 16, lengthM: 30, sectionMm2: 2.5, conductor: "copper", tempC: 70, cosPhi: 1 });
    expect(v(r, "du")).toBeCloseTo(2 * resistivity("copper", 70) * 30 / 2.5 * 16, 4);
    expect(v(r, "pct")).toBeCloseTo(3.444, 2);
  });
  it("refuse de supposer la réactance linéique quand cos φ < 1", () => {
    const r = voltageDrop({ system: "three", u: 400, i: 30, lengthM: 50, sectionMm2: 6, conductor: "copper", tempC: 70, cosPhi: 0.8 });
    expect(r.ok).toBe(false);
    expect(r.missing[0]).toMatch(/réactance/);
  });
  it("section de câble : jamais sans tableau normatif saisi", () => {
    expect(cableSection({ inA: 20, correctionFactors: [1], table: null }).missing.join()).toMatch(/tableau normatif/);
    const r = cableSection({ inA: 20, correctionFactors: [0.8], table: { reference: "test", rows: [{ s: 1.5, iz: 18 }, { s: 2.5, iz: 25 }, { s: 4, iz: 34 }] } });
    expect(v(r, "s")).toBe(2.5);
  });
  it("bilan de puissance : coefficients exigés", () => {
    expect(powerBalance([{ name: "Pompe", pW: 1000, qty: 1, ku: null, ks: 1 }]).ok).toBe(false);
    expect(v(powerBalance([{ name: "Pompe", pW: 1000, qty: 2, ku: 0.8, ks: 0.5 }]), "demand")).toBe(800);
  });
});

describe("Solar", () => {
  it("production mensuelle E = Pc × H × PR × jours", () => {
    const r = pvProduction({ peakKw: 3, monthlyIrradiation: Array(12).fill(5), performanceRatio: 0.75, plane: "horizontal" });
    expect(v(r, "m1")).toBeCloseTo(3 * 5 * 0.75 * 31, 6);
    expect(v(r, "year")).toBeCloseTo(3 * 5 * 0.75 * 365, 4);
    expect(r.assumptions[0]).toMatch(/HORIZONTAL/);
  });
  it("irradiation incomplète → paramètre manquant", () => { expect(pvProduction({ peakKw: 3, monthlyIrradiation: [5, null, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], performanceRatio: 0.8, plane: "horizontal" }).ok).toBe(false); });
  it("Voc au froid", () => { expect(vocAtTemp(40, -0.3, 10)).toBeCloseTo(40 * (1 + 0.045), 6); });
  it("associations série / parallèle", () => {
    const r = stringSizing({ vocStc: 40, vmpStc: 33, iscStc: 10, betaVocPct: -0.3, gammaVmpPct: -0.4, tMinC: 10, tMaxCellC: 70, vMaxDc: 500, mpptMin: 120, mpptMax: 450, iMaxInput: 25, modules: 20 });
    expect(v(r, "nMax")).toBe(Math.min(Math.floor(500 / 41.8), Math.floor(450 / (33 * (1 - 0.004 * 15)))));
    expect(v(r, "nMin")).toBe(Math.ceil(120 / (33 * (1 - 0.004 * 45))));
    expect(v(r, "pMax")).toBe(2);
    expect(r.warnings.join()).toMatch(/10 en série × 2 en parallèle/);
  });
  it("batterie", () => { expect(v(batterySizing({ dailyWh: 2400, autonomyDays: 2, voltage: 24, dod: 0.8, efficiency: 0.9 }), "ah")).toBeCloseTo(4800 / 0.72 / 24, 2); });
  it("pompe : P_hyd = ρ g Q H", () => { const r = pumpSizing({ flowM3h: 3.6, headM: 20, pumpEff: 0.5, motorEff: 0.8, dailyVolumeM3: 18 }); expect(v(r, "ph")).toBeCloseTo(1000 * 9.81 * 0.001 * 20, 6); expect(v(r, "hours")).toBe(5); });
  it("LCOE sans actualisation = coûts / énergie", () => { expect(v(economics({ capex: 1000, opexPerYear: 0, annualKwh: 100, years: 10, discountRate: 0, tariffPerKwh: null, currency: "FCFA" }), "lcoe")).toBeCloseTo(1, 6); });
});

describe("Mechanical, thermal, network", () => {
  it("couple", () => { expect(v(torque({ powerW: 1500, rpm: 1450 }), "c")).toBeCloseTo(1500 / (2 * Math.PI * 1450 / 60), 4); });
  it("train d'engrenages", () => { const r = gearTrain({ stages: [{ z1: 10, z2: 40 }, { z1: 12, z2: 36 }], rpmIn: 1200, torqueIn: 2, stageEfficiency: 0.95 }); expect(v(r, "i")).toBe(12); expect(v(r, "rpmOut")).toBe(100); expect(v(r, "torqueOut")).toBeCloseTo(24 * 0.9025, 6); });
  it("vérin", () => { expect(v(cylinderForce({ pressureBar: 6, boreMm: 50, efficiency: 1 }), "f")).toBeCloseTo(6e5 * Math.PI * 0.025 ** 2, 1); });
  it("COP de Carnot", () => { expect(v(carnotCop({ tColdC: -10, tHotC: 40 }), "copF")).toBeCloseTo(263.15 / 50, 6); expect(carnotCop({ tColdC: 40, tHotC: 10 }).ok).toBe(false); });
  it("parois : coefficient U exigé", () => { expect(wallLoad({ walls: [{ name: "Mur", u: null, areaM2: 10 }], tInC: 2, tOutC: 32 }).ok).toBe(false); expect(v(wallLoad({ walls: [{ name: "Mur", u: 0.3, areaM2: 10 }], tInC: 2, tOutC: 32 }), "q")).toBeCloseTo(90, 6); });
  it("sous-réseaux", () => {
    expect(parseIpv4("256.1.1.1")).toBeNull();
    expect(subnet("192.168.1.77/24")).toMatchObject({ network: "192.168.1.0", broadcast: "192.168.1.255", hosts: 254, first: "192.168.1.1" });
    expect(subnet("10.0.0.0/31")?.hosts).toBe(2);
    expect(subnet("10.0.0.5/32")?.hosts).toBe(1);
    const r = vlsm("192.168.10.0/24", [{ name: "A", hosts: 50 }, { name: "B", hosts: 100 }, { name: "C", hosts: 2 }]);
    expect(r.subnets?.map((s) => `${s.name}:${s.network}/${s.prefix}`)).toEqual(["B:192.168.10.0/25", "A:192.168.10.128/26", "C:192.168.10.192/30"]);
    expect(vlsm("10.0.0.0/30", [{ name: "X", hosts: 10 }]).warnings[0]).toMatch(/insuffisant/);
  });
});
