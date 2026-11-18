import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { runCompute } from "@/server/compute";

/** Ces tests exigent l'interpréteur XX_PYTHON (ou python3) avec workers/requirements.txt ; sinon ils sont IGNORÉS (signalé). */
const py = process.env.XX_PYTHON || "python3";
const available = spawnSync(py, ["-c", "import pvlib, CoolProp"], { encoding: "utf8" }).status === 0;
if (!available) console.warn(`[compute] pvlib/CoolProp absents pour ${py} : tests du moteur Python ignorés`);

describe.skipIf(!available)("Moteur Python (pvlib, CoolProp)", () => {
  it("CoolProp : pression de saturation du R134a cohérente avec les tables (≈ 200,7 kPa à −10 °C ; ≈ 1016,6 kPa à 40 °C)", async () => {
    const r = await runCompute<{ states: { P_kPa: number; h_kJkg: number }[]; cop: number; cop_carnot: number; q_evap_kJkg: number; w_comp_kJkg: number; q_cond_kJkg: number }>(
      "thermo_cycle", { fluid: "R134a", t_evap_c: -10, t_cond_c: 40, superheat_k: 0, subcool_k: 0, isentropic_eff: 1 });
    expect(r.states[0].P_kPa).toBeGreaterThan(198); expect(r.states[0].P_kPa).toBeLessThan(203);
    expect(r.states[1].P_kPa).toBeGreaterThan(1010); expect(r.states[1].P_kPa).toBeLessThan(1022);
    expect(r.cop).toBeLessThan(r.cop_carnot);
    expect(r.q_cond_kJkg).toBeCloseTo(r.q_evap_kJkg + r.w_comp_kJkg, 6);
    expect(r.states[3].h_kJkg).toBeCloseTo(r.states[2].h_kJkg, 9);
  }, 60000);
  it("CoolProp : rendement isentropique plus faible → COP plus faible ; condensation ≤ évaporation refusée", async () => {
    const a = await runCompute<{ cop: number }>("thermo_cycle", { fluid: "R290", t_evap_c: 0, t_cond_c: 45, superheat_k: 5, subcool_k: 2, isentropic_eff: 0.8 });
    const b = await runCompute<{ cop: number }>("thermo_cycle", { fluid: "R290", t_evap_c: 0, t_cond_c: 45, superheat_k: 5, subcool_k: 2, isentropic_eff: 0.6 });
    expect(b.cop).toBeLessThan(a.cop);
    await expect(runCompute("thermo_cycle", { fluid: "R290", t_evap_c: 30, t_cond_c: 20, superheat_k: 0, subcool_k: 0, isentropic_eff: 0.7 })).rejects.toThrow(/condensation/);
  }, 60000);
  it("pvlib : sans rayonnement, aucune production ; avec rayonnement, production positive et PR < 1", async () => {
    const times = Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2024, 5, 21, h)).toISOString());
    const sunny = (h: number) => Math.max(0, 900 * Math.sin(((h % 24) - 6) / 12 * Math.PI));
    const base = { lat: 14.7, lon: -17.4, tilt: 15, azimuth: 180, pdc0_kw: 3, gamma_pdc_pct: -0.4, losses_pct: 10, inverter_eff: 0.96, dc_ac_ratio: 1.1, temp_model: "open_rack_glass_glass", times, temp_air: times.map(() => 28), wind_speed: times.map(() => 3) };
    const dark = await runCompute<{ annual_kwh: number }>("pv_hourly", { ...base, ghi: times.map(() => 0), dni: times.map(() => 0), dhi: times.map(() => 0) });
    expect(dark.annual_kwh).toBe(0);
    const day = await runCompute<{ annual_kwh: number; performance_ratio: number; hours: number }>("pv_hourly", { ...base, ghi: times.map((_, h) => sunny(h)), dni: times.map((_, h) => sunny(h) * 0.8), dhi: times.map((_, h) => sunny(h) * 0.2) });
    expect(day.hours).toBe(48);
    expect(day.annual_kwh).toBeGreaterThan(0);
    expect(day.performance_ratio).toBeLessThan(1);
  }, 60000);
});

describe("Meteomatics sans compte propre", () => {
  it("aucun appel sortant : refus explicite au lieu d'une requête non authentifiée", async () => {
    const { meteomaticsForecast, MeteomaticsNotConfigured } = await import("@/server/integrations/geo");
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
    delete process.env.METEOMATICS_USERNAME; delete process.env.METEOMATICS_PASSWORD;
    await expect(meteomaticsForecast(14.69, -17.44, 3, fetchImpl)).rejects.toBeInstanceOf(MeteomaticsNotConfigured);
    expect(called).toBe(false);
  });
});
