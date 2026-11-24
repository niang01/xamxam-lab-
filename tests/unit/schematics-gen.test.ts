import { describe, expect, it } from "vitest";
import { GENERATORS, conducts, generatorByKind, guessGenerator, motorCurrent, resolveParams } from "@/lib/schematics-gen";
import { checkDiagram, diagramSchema } from "@/lib/diagram";

describe("Génération de schémas techniques", () => {
  for (const g of GENERATORS) {
    it(`${g.kind} : schéma valide, sans erreur, contrôles de logique satisfaits`, () => {
      const { values, errors } = resolveParams(g, {});
      expect(errors).toEqual([]);
      const r = g.build(values);
      expect(diagramSchema.safeParse(r.diagram).success).toBe(true);
      expect(checkDiagram(r.diagram).errors).toEqual([]);
      expect(r.checks.length).toBeGreaterThan(0);
      // Les contrôles « interdits » (court-circuits en cas de fermeture simultanée) sont formulés comme alertes de verrouillage.
      for (const c of r.checks) expect(c.ok, c.text).toBe(true);
    });
  }
  it("démarrage direct : supprimer l'auto-maintien ou le relais thermique est détecté", () => {
    const g = generatorByKind("demarrage_direct")!;
    const r = g.build(resolveParams(g, {}).values);
    const d = r.diagram;
    const rest: [string, string][] = [["FU1.1", "FU1.2"], ["F1C.95", "F1C.96"], ["S0.1", "S0.2"]];
    expect(conducts(d, "PH.L", "KM1B.A1", [...rest, ["KM1A.13", "KM1A.14"]])).toBe(true);
    const broken = { ...d, wires: d.wires.filter((w) => !(d.blocks[w.a.block === "KM1A" ? 0 : 0] && (w.a.block === "KM1A" || w.b.block === "KM1A"))) };
    expect(conducts(broken, "PH.L", "KM1B.A1", [...rest, ["KM1A.13", "KM1A.14"]])).toBe(false);
  });
  it("courant d'emploi et bornes des paramètres", () => {
    expect(motorCurrent(5500, 400, 0.85, 0.88)).toBeCloseTo(10.61, 2);
    const g = generatorByKind("demarrage_direct")!;
    expect(resolveParams(g, { pkW: 0 }).errors[0]).toMatch(/entre 0.1 et 500 kW/);
    expect(resolveParams(g, { pkW: "abc" }).errors[0]).toMatch(/nombre attendu/);
    const r = g.build(resolveParams(g, { pkW: 11 }).values);
    expect(r.description[0]).toMatch(/Ib = .* = 21\.\d\d A \(calcul\)\. Calibre normalisé immédiatement supérieur : 25 A — suggestion à valider/);
  });
  it("reconnaissance de la demande", () => {
    expect(guessGenerator("Dessiner le schéma de commande d'un démarrage direct")).toBe("demarrage_direct");
    expect(guessGenerator("schéma étoile-triangle")).toBe("etoile_triangle");
    expect(guessGenerator("schéma unifilaire photovoltaïque")).toBe("unifilaire_pv");
    expect(guessGenerator("bonjour")).toBeNull();
  });
});
