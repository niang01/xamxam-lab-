/** Catalogue de références réelles : intégrité, licences des photos, brochages des cartes. */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DISCIPLINE_LABEL } from "@/lib/library";
import { BOARDS } from "@/lib/catalogue/boards";

type Ref = { key: string; model: string; manufacturer: string | null; discipline: string; datasheet: string; pins: { n: string; name: string; type: string }[];
  photos: { file: string; license: string; author: string; source: string }[]; model3d: string | null; sources: { label: string }[] };
const refs = JSON.parse(readFileSync("data/catalogue/references.json", "utf8")) as Ref[];
const FREE = /^(CC0 1\.0|CC BY \d\.\d|CC BY-SA \d\.\d|Domaine public)$/;

describe("Catalogue de références réelles", () => {
  it("plusieurs centaines de références distinctes, classées par filière, avec fiche technique et source", () => {
    expect(refs.length).toBeGreaterThanOrEqual(500);
    expect(new Set(refs.map((r) => r.key)).size).toBe(refs.length);
    expect(new Set(refs.map((r) => `${r.manufacturer}|${r.model}`)).size).toBe(refs.length);
    for (const r of refs) {
      expect(Object.keys(DISCIPLINE_LABEL), r.key).toContain(r.discipline);
      expect(r.datasheet, r.key).toMatch(/^https?:\/\//);
      expect(r.sources.length, r.key).toBeGreaterThan(0);
    }
    expect(new Set(refs.map((r) => r.discipline)).size).toBeGreaterThanOrEqual(12);
  });
  it("photos : licence libre, auteur et page source, fichier présent ; modèles 3D présents", () => {
    for (const r of refs) {
      for (const p of r.photos) {
        expect(p.license, `${r.key} ${p.file}`).toMatch(FREE);
        expect(p.author.length, p.file).toBeGreaterThan(0);
        expect(p.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(existsSync(`public/catalogue/photos/${p.file}`), p.file).toBe(true);
      }
      if (r.model3d) expect(existsSync(`public/catalogue/3d/${r.model3d}`), r.model3d).toBe(true);
    }
  });
  it("brochage KiCad repris tel quel (ex. RP2040 de la Raspberry Pi Pico : 40 broches, VBUS en 40)", () => {
    const pico = refs.find((r) => r.key === "kicad-mcu-module-raspberrypi-pico")!;
    expect(pico.pins).toHaveLength(40);
    expect(pico.pins.find((p) => p.n === "40")!.name).toBe("VBUS");
    expect(pico.pins.find((p) => p.n === "31")!.name).toBe("GPIO26_ADC0");
  });
});

describe("Brochages interactifs des cartes", () => {
  const esp = BOARDS.find((b) => b.key === "upesy-esp32-wroom-devkit")!;
  it("ESP32 Wroom DevKit : 16 + 16 broches, GPIO 34/35/36/39 en entrée seulement, deux broches NC, ADC/DAC/TOUCH conformes", () => {
    expect(esp.left).toHaveLength(16); expect(esp.right).toHaveLength(16);
    const all = [...esp.left, ...esp.right];
    expect(all.filter((p) => p.kind === "input").map((p) => p.gpio).sort((a, b) => a! - b!)).toEqual([34, 35, 36, 39]);
    expect(all.filter((p) => p.kind === "nc")).toHaveLength(2);
    const fn = (g: number) => all.find((p) => p.gpio === g)!.fns.map((f) => f.name);
    expect(fn(25)).toContain("DAC_1"); expect(fn(26)).toContain("DAC_2"); expect(fn(36)).toContain("ADC1_0");
    expect(fn(21)).toContain("I2C_SDA"); expect(fn(22)).toContain("I2C_SCL"); expect(fn(2)).toContain("LED intégrée");
    expect(all.filter((p) => p.kind === "input").every((p) => !p.pwm)).toBe(true);
  });
  it("Arduino UNO R3 : PWM sur D3, D5, D6, D9, D10, D11 ; A4/A5 = SDA/SCL", () => {
    const uno = BOARDS.find((b) => b.key === "arduino-uno-r3")!, all = [...uno.left, ...uno.right];
    expect(all.filter((p) => p.pwm).map((p) => p.label).sort()).toEqual(["D10", "D11", "D3", "D5", "D6", "D9"]);
    expect(all.find((p) => p.label === "A4")!.fns.map((f) => f.name)).toContain("SDA");
  });
  it("Raspberry Pi Pico : 40 broches, mêmes noms que la bibliothèque KiCad", () => {
    const pico = BOARDS.find((b) => b.key === "raspberrypi-pico")!;
    expect(pico.left.length + pico.right.length).toBe(40);
    const kicad = refs.find((r) => r.key === "kicad-mcu-module-raspberrypi-pico")!;
    // côté gauche = broches 1 à 20 ; côté droit = 40 à 21 (vue de dessus, USB en haut dans la fiche officielle)
    pico.left.forEach((p, i) => { const k = kicad.pins.find((x) => x.n === String(i + 1))!.name; expect(k.startsWith("GPIO") ? `GP${k.slice(4)}` : k, `broche ${i + 1}`).toBe(p.label); });
  });
});
