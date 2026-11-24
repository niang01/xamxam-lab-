import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { checkAnswers, parseQuantities, parseUnit, planFor, splitExercises } from "@/lib/docs/analyze";
import { extractDocx, extractPptx, extractXlsx, extractDxf, extractStl } from "@/lib/docs/office";
import { toDocx, toPdf, toXlsx } from "@/lib/docs/export";
import { analyseText } from "@/server/docs/process";

const TEXT = readFileSync(path.join(import.meta.dirname, "../fixtures/exercice.txt"), "utf8");

describe("Lecture des grandeurs et des unités", () => {
  it("préfixes, virgule décimale, espaces de milliers, unités composées", () => {
    expect(parseUnit("kW")).toEqual({ dim: "power", unit: "W", factor: 1000 });
    expect(parseUnit("mA")).toEqual({ dim: "current", unit: "A", factor: 0.001 });
    expect(parseUnit("kΩ")?.factor).toBe(1000);
    expect(parseUnit("mm²")).toEqual({ dim: "area", unit: "mm²", factor: 1 });
    expect(parseUnit("xyz")).toBeNull();
    const q = parseQuantities("P = 7,5 kW ; U = 1 000 V ; cos φ = 0,85 ; η = 90 % ; R = 4,7 kΩ ; L = 25");
    expect(q.map((x) => [x.symbol, x.si])).toEqual([["P", 7500], ["U", 1000], ["cos φ", 0.85], ["η", 0.9], ["R", 4700], ["L", 25]]);
    expect(q.find((x) => x.symbol === "L")!.hypothesis).toMatch(/Unité non précisée/);
  });
  it("unité incohérente avec le symbole signalée", () => {
    const r = analyseText("Exercice 1\nU = 10 A et R = 5 Ω. Calculer I.", []);
    expect(r.exercises[0].checks.join(" ")).toMatch(/U = 10 A : l'unité ne correspond pas/);
  });
});

describe("Analyse d'un énoncé", () => {
  it("exercices, questions, calculs, réponses corrigées, manquants non inventés", () => {
    const blocks = splitExercises(TEXT);
    expect(blocks.map((b) => b.title)).toEqual(["Exercice 1 : loi d'Ohm", "Exercice 2 : moteur triphasé", "Exercice 3 : chute de tension", "Exercice 4"]);
    expect(planFor(blocks[0])!.kind).toBe("ohm");
    expect(planFor(blocks[1])!.kind).toBe("design_current");
    expect(planFor(blocks[2])!.kind).toBe("voltage_drop");
    const r = analyseText(TEXT, []);
    const [e1, e2, e3, e4] = r.exercises;
    expect(e1.result!.outputs.i.value).toBe(5);
    expect(e1.answers[0].verdict).toBe("correct");
    expect(e1.checks.join(" ")).toMatch(/✓ Re-substitution/);
    expect(e2.result!.outputs.ib.value).toBeCloseTo(7500 / (Math.sqrt(3) * 400 * 0.85 * 0.9), 2);
    expect(e2.answers[0]).toMatchObject({ verdict: "incorrect" });
    expect(e3.missing.join(" ")).toMatch(/temp/i);
    expect(e4.calculation).toBeNull();
    expect(e4.humanReview.join(" ")).toMatch(/schéma est demandé/);
  });
  it("comparaison des réponses : tolérance 2 %, dimension différente non comparable", () => {
    const r = { outputs: { i: { value: 5, unit: "A", label: "I" } }, formulas: [], missing: [], warnings: [] };
    expect(checkAnswers(parseQuantities("I = 5,05 A"), r)[0].verdict).toBe("correct");
    expect(checkAnswers(parseQuantities("I = 5,5 A"), r)[0].verdict).toBe("incorrect");
    expect(checkAnswers(parseQuantities("P = 5 W"), r)[0].verdict).toBe("non comparable");
  });
});

describe("Formats Office, DXF, STL et exports (aller-retour réel)", () => {
  it("Word : paragraphes et tableaux", () => {
    const docx = toDocx("Devoir", TEXT, [[["Grandeur", "Valeur"], ["U", "230 V"]]]);
    const x = extractDocx(docx);
    expect(x.text).toContain("Une résistance R = 46 Ω");
    expect(x.tables[0]).toEqual([["Grandeur", "Valeur"], ["U", "230 V"]]);
  });
  it("Excel : feuilles, nombres et textes", () => {
    const x = extractXlsx(toXlsx([{ name: "Mesures", rows: [["t (s)", "U (V)"], ["0", "0"], ["1", "12.5"]] }]));
    expect(x.tables[0]).toEqual([["t (s)", "U (V)"], ["0", "0"], ["1", "12.5"]]);
    expect(x.text).toContain("# Feuille Mesures");
  });
  it("PowerPoint : texte des diapositives dans l'ordre", () => {
    const slide = (t: string) => strToU8(`<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`);
    const x = extractPptx(zipSync({ "ppt/slides/slide2.xml": slide("Deuxième"), "ppt/slides/slide1.xml": slide("Première &amp; titre") }));
    expect(x.text).toBe("# Diapositive 1\nPremière & titre\n\n# Diapositive 2\nDeuxième");
  });
  it("DXF et STL", () => {
    const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "LINE", "8", "MURS", "0", "TEXT", "8", "COTES", "1", "Cuisine", "0", "ENDSEC", "0", "EOF"].join("\n");
    expect(extractDxf(dxf).text).toMatch(/LINE × 1, TEXT × 1[\s\S]*Calques : MURS, COTES[\s\S]*Texte : Cuisine/);
    const stl = "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 20 5\nendloop\nendfacet\nendsolid";
    expect(extractStl(strToU8(stl)).text).toBe("Maillage STL : 1 triangles ; encombrement 10 × 20 × 5 (unités du fichier).");
  });
  it("PDF produit lisible par pdftotext (accents, Ω converti)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "xx-pdf-"));
    const f = path.join(dir, "r.pdf");
    writeFileSync(f, toPdf("Rapport d'analyse", "# Résultats\n- Courant I = 5 A ; R = 46 Ω\n" + "ligne\n".repeat(80)));
    const out = execFileSync("pdftotext", [f, "-"]).toString();
    expect(out).toContain("Rapport d'analyse"); expect(out).toContain("Résultats"); expect(out).toContain("R = 46 Ohm");
    expect(execFileSync("pdfinfo", [f]).toString()).toMatch(/Pages:\s+2/);
  });
});
