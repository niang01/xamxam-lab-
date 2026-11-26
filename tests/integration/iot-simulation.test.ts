/** Laboratoire IoT : compilation réelle (avr-gcc + cœur Arduino) puis simulation du binaire (avr8js) avec entrées et sorties. */
import { describe, expect, it } from "vitest";
import { compileUno, prototypes, toolchainStatus } from "@/server/firmware";
import { SKETCHES } from "@/lib/iot/sketches";
import { UnoSim } from "@/lib/iot/avr-sim";

const hex = async (key: string) => { const r = await compileUno(SKETCHES.find((s) => s.key === key)!.source); expect(r.ok, r.log).toBe(true); return r.hex!; };

describe("Compilation et simulation Arduino Uno", () => {
  it("chaîne de compilation disponible ; prototypes générés ; erreur de syntaxe signalée avec la ligne", async () => {
    expect(toolchainStatus().available).toBe(true);
    expect(prototypes("int carre(int x) { return x * x; }\nvoid loop() {}")).toEqual(["int carre(int x);"]);
    const bad = await compileUno("void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}");
    expect(bad.ok).toBe(false); expect(bad.log).toMatch(/croquis\.ino:[23]:\d+: error/);
  }, 120_000);
  it("clignotant : la LED change d'état toutes les 500 ms ; liaison série émise", async () => {
    const sim = new UnoSim(await hex("clignotant"));
    sim.runMs(250); const a = sim.pin(13); sim.runMs(500); const b = sim.pin(13);
    expect(a).not.toBe(b); expect(sim.serial).toContain("Demarrage");
  }, 120_000);
  it("seuil avec hystérésis : relais enclenché au-dessus du seuil haut, retombé sous le seuil bas", async () => {
    const sim = new UnoSim(await hex("seuil"));
    sim.setAnalog(0, 2.9); sim.runMs(500); expect(sim.pin(7)).toBe(false);   // 593 : entre les seuils, état initial conservé
    sim.setAnalog(0, 4.0); sim.runMs(500); expect(sim.pin(7)).toBe(true);    // 818 > 700
    sim.setAnalog(0, 3.0); sim.runMs(500); expect(sim.pin(7)).toBe(true);    // 614 : hystérésis
    sim.setAnalog(0, 1.0); sim.runMs(500); expect(sim.pin(7)).toBe(false);   // 204 < 500
    expect(sim.serial).toMatch(/mesure=8\d\d relais=1/);
  }, 120_000);
  it("alarme : temporisation, déclenchement, acquittement", async () => {
    const sim = new UnoSim(await hex("alarme"));
    sim.setInput(3, true); sim.setInput(2, false); sim.runMs(200); expect(sim.pin(8)).toBe(false);
    sim.setInput(2, true); sim.runMs(500); expect(sim.pin(8)).toBe(false);   // avant la temporisation d'1 s
    sim.runMs(800); expect(sim.pin(8)).toBe(true); expect(sim.serial).toContain("ALARME");
    sim.setInput(2, false); sim.setInput(3, false); sim.runMs(200); expect(sim.pin(8)).toBe(false); expect(sim.serial).toContain("acquittee");
  }, 120_000);
  it("réservoir : pompe au niveau bas, arrêt de sécurité si la pression manque", async () => {
    const sim = new UnoSim(await hex("niveau"));
    sim.setAnalog(0, 1.0); sim.setAnalog(1, 2.0); sim.runMs(600); expect(sim.pin(6)).toBe(true);
    sim.setAnalog(1, 0.2); sim.runMs(600); expect(sim.pin(6)).toBe(false);
    sim.setAnalog(1, 2.0); sim.setAnalog(0, 4.5); sim.runMs(600); expect(sim.pin(6)).toBe(false);
  }, 120_000);
});
