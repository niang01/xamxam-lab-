import { describe, expect, it } from "vitest";
import { decide, effectiveLevel } from "@/lib/autonomy";
import { commandBlockers, confirmBlockers, freshness, type DeviceForCommand } from "@/lib/commands";
import { automationSpec, dryRun, evaluate } from "@/lib/automation";
import { can } from "@/lib/profiles";

const dev = (env: DeviceForCommand["environment"], max: number | null = 600): DeviceForCommand => ({ status: "active", environment: env, capabilities: { commands: [{ action: "pump_on", max_duration_s: max, requires_duration: true }] } });

describe("Gouvernance de l'IA", () => {
  it("niveau effectif = minimum", () => { expect(effectiveLevel(5, 3)).toBe(3); expect(effectiveLevel(4, null)).toBe(4); expect(effectiveLevel()).toBe(1); });
  it("coupe-circuit, agent désactivé, liste blanche", () => {
    const ok = { effect: "read" as const, level: 5 as const, aiEnabled: true, agentEnabled: true, toolAllowed: true };
    expect(decide(ok).kind).toBe("execute");
    expect(decide({ ...ok, aiEnabled: false }).kind).toBe("blocked");
    expect(decide({ ...ok, agentEnabled: false }).kind).toBe("blocked");
    expect(decide({ ...ok, toolAllowed: false }).kind).toBe("blocked");
  });
  it("niveau insuffisant → approbation humaine", () => {
    expect(decide({ effect: "write", level: 2, aiEnabled: true, agentEnabled: true, toolAllowed: true }).kind).toBe("approval");
    expect(decide({ effect: "physical", level: 3, aiEnabled: true, agentEnabled: true, toolAllowed: true }).kind).toBe("approval");
    expect(decide({ effect: "compute", level: 2, aiEnabled: true, agentEnabled: true, toolAllowed: true }).kind).toBe("execute");
  });
});

describe("Sécurité des commandes", () => {
  it("durée maximale jamais par défaut", () => { expect(commandBlockers(dev("virtual", null), "pump_on", 60).join()).toMatch(/durée maximale non fixée/); });
  it("durée manquante ou dépassée", () => {
    expect(commandBlockers(dev("virtual"), "pump_on", null).join()).toMatch(/manquante/);
    expect(commandBlockers(dev("virtual"), "pump_on", 601).join()).toMatch(/supérieure/);
    expect(commandBlockers(dev("virtual"), "pump_on", 600)).toEqual([]);
  });
  it("commande non déclarée refusée ; arrêt toujours permis", () => {
    expect(commandBlockers(dev("real"), "open_valve", 10).join()).toMatch(/non déclarée/);
    expect(commandBlockers(dev("real"), "stop", null)).toEqual([]);
    expect(commandBlockers({ ...dev("real"), status: "disabled" }, "pump_on", 10).join()).toMatch(/désactivé/);
  });
  it("habilitations selon l'environnement", () => {
    expect(confirmBlockers(dev("real"), "pump_on", { clearances: ["banc_essai"], canConfirm: true }).join()).toMatch(/opération réelle/);
    expect(confirmBlockers(dev("bench"), "pump_on", { clearances: [], canConfirm: true }).join()).toMatch(/banc/);
    expect(confirmBlockers(dev("bench"), "pump_on", { clearances: ["banc_essai"], canConfirm: true })).toEqual([]);
    expect(confirmBlockers(dev("virtual"), "pump_on", { clearances: [], canConfirm: false }).join()).toMatch(/profil/);
    expect(confirmBlockers(dev("real"), "estop", { clearances: [], canConfirm: false })).toEqual([]);
  });
  it("fraîcheur", () => {
    const now = Date.parse("2026-11-17T12:00:00Z");
    expect(freshness("2026-11-17T11:59:00Z", 300, now)).toBe("live");
    expect(freshness("2026-11-17T11:00:00Z", 300, now)).toBe("stale");
    expect(freshness(null, 300, now)).toBe("none");
  });
  it("profils : un élève ne confirme pas de commande", () => { expect(can("pupil", false, "confirm_commands")).toBe(false); expect(can("technician", false, "confirm_commands")).toBe(true); expect(can("pupil", true, "confirm_commands")).toBe(true); });
});

describe("Automatisations", () => {
  const spec = automationSpec.parse({ trigger: { device_id: "00000000-0000-4000-8000-000000000001", metric: "soil" }, condition: { op: "<", threshold: 25, max_age_s: 600 }, action: { kind: "notify" }, cooldown_s: 3600, verify: { metric: null, within_s: null }, stop: { max_runs_per_day: 2 } });
  const now = Date.parse("2026-11-17T12:00:00Z");
  it("pas de donnée, donnée simulée, donnée ancienne : rien ne se déclenche", () => {
    expect(evaluate(spec, null, null, 0, now).fire).toBe(false);
    expect(evaluate(spec, { ts: "2026-11-17T11:59:00Z", value: 10, quality: "simulated" }, null, 0, now)).toMatchObject({ fire: false, reason: expect.stringMatching(/simulée/) });
    expect(evaluate(spec, { ts: "2026-11-17T11:00:00Z", value: 10, quality: "valid" }, null, 0, now)).toMatchObject({ fire: false, reason: expect.stringMatching(/ancienne/) });
  });
  it("condition, temporisation, plafond", () => {
    expect(evaluate(spec, { ts: "2026-11-17T11:59:00Z", value: 10, quality: "valid" }, null, 0, now).fire).toBe(true);
    expect(evaluate(spec, { ts: "2026-11-17T11:59:00Z", value: 30, quality: "valid" }, null, 0, now).fire).toBe(false);
    expect(evaluate(spec, { ts: "2026-11-17T11:59:00Z", value: 10, quality: "valid" }, "2026-11-17T11:30:00Z", 0, now).fire).toBe(false);
    expect(evaluate(spec, { ts: "2026-11-17T11:59:00Z", value: 10, quality: "valid" }, null, 2, now).fire).toBe(false);
  });
  it("seuil obligatoire", () => { expect(automationSpec.safeParse({ ...spec, condition: { op: "<", max_age_s: 600 } }).success).toBe(false); });
  it("essai à blanc", () => {
    const h = ["10:00", "10:30", "11:00", "11:30", "12:00", "13:30"].map((t, i) => ({ ts: `2026-11-17T${t}:00.000Z`, value: i === 2 ? 40 : 10, quality: "valid" }));
    expect(dryRun(spec, h).map((f) => f.ts.slice(11, 16))).toEqual(["10:00", "11:30"]);
  });
});
