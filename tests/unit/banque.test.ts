import { describe, expect, it } from "vitest";
import { BANK, bankInventory, bankToProject, searchBank } from "@/lib/bank";
import { CODES } from "@/lib/bank/codes";
import { LIBRARY, FILIERES } from "@/lib/library";
import { TEMPLATES, grade, makeExam, makeExercise } from "@/lib/exercises";

describe("Banque de projets", () => {
  const names = new Set(LIBRARY.map((c) => c.name));
  it("identifiants uniques, composants tous présents dans la bibliothèque, filières valides", () => {
    expect(new Set(BANK.map((p) => p.id)).size).toBe(BANK.length);
    const filieres = new Set(FILIERES.map((f) => f.key));
    for (const p of BANK) {
      expect(filieres.has(p.filiere), `${p.id} filière ${p.filiere}`).toBe(true);
      for (const [n] of p.components) expect(names.has(n), `${p.id} : ${n}`).toBe(true);
      if (p.code) expect(CODES[p.code], p.id).toBeDefined();
    }
  });
  it("17 rubriques renseignées pour chaque projet", () => {
    for (const p of BANK) {
      expect(p.title && p.domain && p.level && p.problem && p.principle, p.id).toBeTruthy();
      for (const k of ["objectives", "specs", "components", "steps", "expected", "tests", "applications", "improvements"] as const) expect(p[k].length, `${p.id} ${k}`).toBeGreaterThan(0);
    }
  });
  it("inventaire réel : au moins 300 projets, dont 215 IoT, toutes les filières couvertes", () => {
    const inv = bankInventory();
    expect(inv.total).toBeGreaterThanOrEqual(300); expect(inv.iot).toBe(215);
    for (const f of FILIERES) expect(inv.byFiliere[f.key] ?? 0, f.key).toBeGreaterThan(0);
  });
  it("recherche et filtres ; conversion en projet personnel", () => {
    expect(searchBank({ iot: true }).length).toBe(215);
    expect(searchBank({ q: "pompage" }).length).toBeGreaterThan(3);
    expect(searchBank({ component: "Carte ESP32", level: "debutant" }).every((p) => p.level === "debutant")).toBe(true);
    const x = bankToProject(BANK[0]);
    expect(x.methodology).toMatch(/^1\. /); expect(x.components).toEqual(BANK[0].components);
  });
  it("les programmes d'exemple n'embarquent aucun secret réel", () => {
    for (const c of Object.values(CODES)) expect(c.source).not.toMatch(/sk-|eyJ[A-Za-z0-9]{20}/);
  });
});

describe("Banque d'exercices", () => {
  it("chaque modèle produit des énoncés reproductibles et corrigés", () => {
    for (const t of TEMPLATES) {
      const a = makeExercise(t.key, 7)!, b = makeExercise(t.key, 7)!;
      expect(a).toEqual(b);
      expect(Number.isFinite(a.answer.value), t.key).toBe(true);
      expect(a.steps.length).toBeGreaterThan(2);
      expect(grade(a, a.answer.value).correct).toBe(true);
    }
  });
  it("valeurs vérifiées à la main", () => {
    const ex = makeExercise("ohm-courant", 1)!;
    const [u, r] = [Number(ex.statement.match(/U = (\d+)/)![1]), Number(ex.statement.match(/R = (\d+)/)![1])];
    expect(ex.answer.value).toBeCloseTo(u / r, 4);
    const sr = makeExercise("sous-reseau", 3)!;
    const p = Number(sr.statement.match(/\/(\d+)/)![1]);
    expect(sr.answer.value).toBe(2 ** (32 - p) - 2);
  });
  it("correction : tolérance, valeurs absurdes, variantes invalides ; épreuve reproductible", () => {
    const ex = makeExercise("couple", 2)!;
    expect(grade(ex, ex.answer.value * 1.005).correct).toBe(true);
    expect(grade(ex, ex.answer.value * 1.2).correct).toBe(false);
    expect(grade(ex, Number.NaN).correct).toBe(false);
    expect(makeExercise("couple", 0)).toBeNull(); expect(makeExercise("inconnu", 1)).toBeNull();
    expect(makeExam(42, 5, "froid").every((e) => e.filiere === "froid")).toBe(true);
    expect(makeExam(42, 5).map((e) => e.id)).toEqual(makeExam(42, 5).map((e) => e.id));
  });
});

import { SECTORS, IOT_SECURITY, SECTOR_PROJECTS } from "@/lib/bank/sectors";
describe("Banque IoT multisectorielle", () => {
  it("35 secteurs couverts (≥ 2 projets chacun), au-delà de l'agriculture ; identifiants et titres distincts", () => {
    expect(SECTORS.length).toBe(35);
    for (const s of SECTORS) expect(searchBank({ sector: s.key }).length, s.key).toBeGreaterThanOrEqual(2);
    expect(new Set(SECTOR_PROJECTS.map((p) => p.title)).size).toBe(SECTOR_PROJECTS.length);
    expect(searchBank({ sector: "agriculture" }).length).toBeLessThan(searchBank({ iot: true }).length / 5);
  });
  it("chaque projet sectoriel : exigences de sécurité IoT ; secteurs critiques : avertissement de prototype", () => {
    for (const p of SECTOR_PROJECTS) {
      for (const r of IOT_SECURITY) expect(p.specs, p.id).toContain(r);
      const s = SECTORS.find((x) => x.key === p.sector)!;
      if (s.critical) expect(p.specs.join(" "), p.id).toMatch(/prototype|certifi|validation/i);
      expect(p.tests.join(" ")).toContain("jeton invalide");
    }
  });
});
