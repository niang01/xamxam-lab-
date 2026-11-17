import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { erc, nets, toNetlist, validValue, type Graph } from "@/lib/spice/netlist";
import { compare, interp } from "@/lib/compare";
import { MESSAGES, MSG_KEYS, type MsgKey } from "@/lib/i18n/messages";
import { resolve } from "@/lib/i18n/runtime";
import { csvEscape, parseCsv, csvUnescape } from "@/lib/i18n/csv";
import { RUBRICS } from "@/lib/catalog";
import { PROFILES, CLEARANCES } from "@/lib/profiles";
import { CALC_KINDS, CALCS } from "@/server/calc";
import { ECO_DATA, ranking } from "@/server/eco";
import { grade } from "@/server/courses";
import { canonical } from "@/server/audit";
import { parseSerialLine } from "@/lib/serial";
import { z } from "zod";

const divider: Graph = {
  parts: [{ id: "V1", type: "V", x: 0, y: 0, rot: 90, value: "DC 5" }, { id: "R1", type: "R", x: 0, y: 0, rot: 0, value: "1k" }, { id: "R2", type: "R", x: 0, y: 0, rot: 0, value: "2k" }, { id: "G1", type: "GND", x: 0, y: 0, rot: 0, value: "" }],
  wires: [{ a: { part: "V1", pin: 0 }, b: { part: "R1", pin: 0 } }, { a: { part: "R1", pin: 1 }, b: { part: "R2", pin: 0 } }, { a: { part: "R2", pin: 1 }, b: { part: "G1", pin: 0 } }, { a: { part: "V1", pin: 1 }, b: { part: "G1", pin: 0 } }],
};

describe("Netlist SPICE et ERC", () => {
  it("nœuds : la masse impose 0", () => { const n = nets(divider); expect(n.get("R2:1")).toBe("0"); expect(n.get("V1:1")).toBe("0"); expect(n.get("R1:1")).toBe(n.get("R2:0")); });
  it("netlist générée", () => {
    const { netlist, issues } = toNetlist(divider, { kind: "op" });
    expect(issues).toEqual([]);
    expect(netlist).toContain("VV1 n1 0 DC 5");
    expect(netlist).toContain("RR2 n2 0 2k");
    expect(netlist.trim().endsWith(".end")).toBe(true);
  });
  it("ERC : masse, source, broche libre, court-circuit", () => {
    expect(erc({ parts: [divider.parts[1]], wires: [] }).map((i) => i.message).join()).toMatch(/masse.*|source/i);
    const short: Graph = { ...divider, wires: [...divider.wires, { a: { part: "V1", pin: 0 }, b: { part: "G1", pin: 0 } }] };
    expect(erc(short).some((i) => i.level === "error" && /court-circuit/.test(i.message))).toBe(true);
  });
  it("injection de directives refusée", () => {
    expect(validValue("R", "1k\n.include /etc/passwd")).toBe(false);
    expect(validValue("R", ".tran 1 2")).toBe(false);
    expect(validValue("V", "DC 5; rm")).toBe(false);
    expect(validValue("V", "PULSE(0 5 0 1u 1u 5m 10m) AC 1")).toBe(true);
    expect(validValue("R", "4.7k")).toBe(true);
    expect(toNetlist({ ...divider, parts: divider.parts.map((p) => (p.id === "R1" ? { ...p, value: "1k\nV9 a 0 1" } : p)) }, { kind: "op" }).netlist).toBe("");
    expect(() => toNetlist(divider, { kind: "tran", step: "1u", stop: "1m\n.include x" })).toThrow();
  });
});

describe("Comparaison simulation/mesure", () => {
  it("interpolation sans extrapolation", () => { expect(interp([0, 1, 2], [0, 10, 20], 1.5)).toBe(15); expect(interp([0, 1], [0, 1], 2)).toBeNull(); });
  it("écarts", () => { const c = compare([0, 10], [0, 10], [5, 20], [6, 1]); expect(c).toMatchObject({ n: 1, meanAbs: 1, maxAbs: 1, outside: 1 }); });
});

describe("Langues", () => {
  it("chaque clé a un texte français et anglais non vide, mêmes paramètres", () => {
    for (const k of MSG_KEYS) {
      const m = MESSAGES[k];
      expect(m.fr.trim(), k).not.toBe("");
      expect(m.en.trim(), k).not.toBe("");
      expect([...(m.en.match(/\{\w+\}/g) ?? [])].sort(), k).toEqual([...(m.fr.match(/\{\w+\}/g) ?? [])].sort());
    }
  });
  it("wolof : uniquement les textes validés, sinon repli signalé", () => {
    expect(resolve("c.save", "wo", "en", {})).toEqual({ text: "Save", missing: true });
    expect(resolve("c.save", "wo", "fr", { "c.save": "TEXTE-VALIDÉ" })).toEqual({ text: "TEXTE-VALIDÉ", missing: false });
    expect(resolve("nope" as MsgKey, "fr", "fr", {}).missing).toBe(true);
  });
  it("aucun texte wolof n'est rédigé dans le code (le catalogue ne contient que fr et en)", () => {
    for (const k of MSG_KEYS) expect(Object.keys(MESSAGES[k]).sort()).toEqual(["en", "fr"]);
  });
  it("clés dynamiques présentes : rubriques, profils, habilitations, calculs, champs", () => {
    const need: string[] = [...RUBRICS.map((r) => `nav.${r.key}`), ...PROFILES.map((p) => `profile.${p}`), ...CLEARANCES.map((c) => `clr.${c}`), ...CALC_KINDS.map((k) => `calc.${k}`)];
    for (const k of CALC_KINDS) {
      const shape = (CALCS[k].schema as z.ZodObject).shape;
      for (const f of Object.keys(shape)) if (!["tableId", "correctionFactors", "loads", "stages", "walls", "needs", "monthlyIrradiation"].includes(f) || ["loads", "stages", "walls", "needs", "monthlyIrradiation"].includes(f)) need.push(`f.${f}`);
    }
    for (const [, s] of Object.entries(ECO_DATA)) for (const f of Object.keys((s as z.ZodObject).shape)) if (f !== "contact_via_platform") need.push(`eco.f.${f}`);
    const missing = [...new Set(need)].filter((k) => !(k in MESSAGES) && k !== "f.correctionFactors" && k !== "f.tableId");
    expect(missing).toEqual([]);
  });
  it("toutes les clés t(\"…\") littérales du code existent", () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
    walk(path.join(import.meta.dirname, "../../src"));
    const missing = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g)) if (!(m[1] in MESSAGES)) missing.add(`${m[1]} (${path.basename(f)})`);
    expect([...missing]).toEqual([]);
  });
  it("CSV : aller-retour et protection contre les formules", () => {
    const row = ["k", "=SUM(A1)", 'texte ; "cité"', "ligne1\nligne2"].map(csvEscape).join(";");
    const back = parseCsv(row)[0].map(csvUnescape);
    expect(back).toEqual(["k", "=SUM(A1)", 'texte ; "cité"', "ligne1\nligne2"]);
    expect(csvEscape("=1+1").startsWith('"\'=')).toBe(true);
  });
});

describe("Divers", () => {
  it("correction de QCM", () => { expect(grade([{ answer: 0 }, { answer: 1 }, { answer: 2 }], [0, 1, null])).toBe(67); });
  it("classement des concours", () => { const r = ranking([{ id: "a", user: "A" }, { id: "b", user: "B" }], [{ entry_id: "a", score: 10 }, { entry_id: "b", score: 15 }, { entry_id: "b", score: 17 }]); expect(r[0]).toMatchObject({ entry_id: "b", average: 16, scores: 2 }); });
  it("JSON canonique stable", () => { expect(canonical({ b: 1, a: [{ d: 2, c: 1 }] })).toBe(canonical({ a: [{ c: 1, d: 2 }], b: 1 })); });
  it("lecture série", () => { expect(parseSerialLine("raw_adc=2048")).toEqual({ metric: "raw_adc", value: 2048 }); expect(parseSerialLine("temp: -3.5")).toEqual({ metric: "temp", value: -3.5 }); expect(parseSerialLine("Démarrage…")).toBeNull(); });
});
