/** Banque de TP : liens vers des cas existants, cours associés existants, résultats attendus recalculés par les moteurs. */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TPS } from "@/lib/tp";
import { BUILTIN_COURSES } from "@/lib/courses-builtin";
import { LADDER_EXAMPLES, GRAFCET_EXAMPLES } from "@/lib/plc/examples";
import { SKETCHES } from "@/lib/iot/sketches";
import { GENERATORS } from "@/lib/schematics-gen";
import { SOFTWARE } from "@/lib/studies";
import { rtuFrame, hex, decodeRtuResponse, parseHex } from "@/lib/plc/modbus";
import { subnet } from "@/lib/eng/network";

const tp = (k: string) => TPS.find((x) => x.key === k)!;
const text = (k: string) => tp(k).expected.join(" ");

describe("Banque de travaux pratiques", () => {
  it("21 TP, clés uniques, chaque outil ouvre une page et un cas existants, cours associé existant", () => {
    expect(TPS.length).toBe(21);
    expect(new Set(TPS.map((x) => x.key)).size).toBe(TPS.length);
    for (const x of TPS) {
      if (x.course) expect(BUILTIN_COURSES.some((c) => c.key === x.course), x.key).toBe(true);
      expect(x.goals.length && x.steps.length && x.expected.length && x.questions.length, x.key).toBeTruthy();
      for (const tool of x.tools) {
        const u = new URL(tool.href, "http://x");
        const page = u.pathname.startsWith("/dimensionnement/") ? "src/app/dimensionnement/[logiciel]/page.tsx" : `src/app${u.pathname}/page.tsx`;
        expect(existsSync(page), `${x.key} → ${tool.href}`).toBe(true);
        const p = Object.fromEntries(u.searchParams);
        if (p.ladder) expect(LADDER_EXAMPLES.some((e) => e.key === p.ladder), tool.href).toBe(true);
        if (p.grafcet) expect(GRAFCET_EXAMPLES.some((e) => e.key === p.grafcet), tool.href).toBe(true);
        if (p.croquis) expect(SKETCHES.some((e) => e.key === p.croquis), tool.href).toBe(true);
        if (p.generer) expect(GENERATORS.some((g) => g.kind === p.generer), tool.href).toBe(true);
        if (p.exemple) expect(["divider", "rc"]).toContain(p.exemple);
        if (u.pathname.startsWith("/dimensionnement/")) expect(SOFTWARE.some((s) => s.key === u.pathname.split("/")[2]), tool.href).toBe(true);
      }
    }
  });
  it("électronique : diviseur et circuit RC", () => {
    expect((5 * 2) / 3).toBeCloseTo(3.33, 2); expect(text("diviseur-tension")).toContain("3,33 V");
    const rc = (t: number, tau: number) => 5 * (1 - Math.exp(-t / tau));
    expect(rc(1, 1)).toBeCloseTo(3.16, 2); expect(rc(3, 1)).toBeCloseTo(4.75, 2); expect(rc(5, 1)).toBeCloseTo(4.97, 2); expect(rc(5, 2.2)).toBeCloseTo(4.48, 2);
    for (const v of ["3,16 V", "4,75 V", "4,97 V", "4,48 V"]) expect(text("circuit-rc")).toContain(v);
  });
  it("Arduino : conversions analogiques et seuils annoncés", () => {
    const n = (v: number) => Math.round((v / 5) * 1023), volts = (n: number) => (n * 5) / 1023;
    expect([n(2.9), n(4.0), n(3.0), n(1.0)]).toEqual([593, 818, 614, 205]);
    expect(volts(700)).toBeCloseTo(3.42, 2); expect(volts(500)).toBeCloseTo(2.44, 2);
  });
  it("logiciels : exemples pompage et photovoltaïque recalculés", () => {
    const run = (k: string) => { const s = SOFTWARE.find((x) => x.key === k)!; return s.run(s.example as never, {} as never); };
    const p = run("pompage"); const v = (l: string) => Number(p.summary.find((x) => x.label === l)!.value);
    expect(v("HMT")).toBeCloseTo(63.0, 0); expect(v("Débit au point de fonctionnement")).toBeCloseTo(6.82, 1); expect(v("Puissance électrique absorbée")).toBeCloseTo(2.38, 1);
    const pv = run("photovoltaique"); const w = (l: string) => Number(pv.summary.find((x) => x.label === l)!.value);
    expect(w("Puissance crête installée")).toBe(0.9); expect(Math.round(w("Production annuelle estimée"))).toBe(1633);
  });
  it("Modbus et IPv4", () => {
    expect(text("modbus-trames")).toContain(hex(rtuFrame({ slave: 1, fn: 3, address: 0, quantity: 10 })));
    expect(decodeRtuResponse(parseHex("01 83 02 C0 F1")).exception).toBe("Adresse de donnée invalide");
    const s24 = subnet("192.168.10.0/24")!, s26 = subnet("192.168.10.0/26")!;
    expect(s24.hosts).toBe(254); expect(s26.hosts).toBe(62); expect(s26.broadcast).toBe("192.168.10.63");
  });
});
