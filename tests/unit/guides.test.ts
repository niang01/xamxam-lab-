import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/lib/guides";

describe("Guides intégrés", () => {
  it("slugs uniques, étapes non vides, chaque lien mène à une page existante", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.steps.length, g.slug).toBeGreaterThan(0);
      for (const s of g.steps) if (s.link) {
        const path = s.link.href.split("?")[0].replace(/^\//, "");
        expect(existsSync(`src/app/${path}/page.tsx`), `${g.slug} → ${s.link.href}`).toBe(true);
      }
    }
  });
  it("les rubriques livrées ont leur guide", () => {
    for (const slug of ["dimensionnement", "programmation-arduino", "automatisme", "travaux-pratiques", "documents", "generer-schemas", "banque-projets", "exercices", "boutique", "fad", "licence", "administrateur"]) expect(GUIDES.some((g) => g.slug === slug), slug).toBe(true);
  });
});
