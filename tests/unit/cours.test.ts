/** Cours intégrés : conformes au schéma de l'application, réponses numériques recalculées. */
import { describe, expect, it } from "vitest";
import { BUILTIN_COURSES } from "@/lib/courses-builtin";
import { courseSchema } from "@/server/schemas";

const c = (k: string) => BUILTIN_COURSES.find((x) => x.key === k)!;
const ans = (k: string, i: number) => { const q = c(k).quiz[i]; return q.choices[q.answer]; };
const num = (s: string) => Number(s.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", "."));

describe("Banque de cours intégrés", () => {
  it("12 cours, 5 leçons et 6 questions chacun, valides pour l'Academy, clés uniques", () => {
    expect(BUILTIN_COURSES).toHaveLength(12);
    expect(new Set(BUILTIN_COURSES.map((x) => x.key)).size).toBe(12);
    for (const x of BUILTIN_COURSES) {
      const r = courseSchema.safeParse({ ...x, lang: "fr", published: true });
      expect(r.success, `${x.key} ${JSON.stringify(!r.success && r.error.issues)}`).toBe(true);
      expect(x.lessons.length, x.key).toBe(5); expect(x.quiz.length, x.key).toBe(6);
      for (const l of x.lessons) expect(l.body.length, `${x.key} / ${l.title}`).toBeGreaterThan(300);
    }
  });
  it("réponses numériques recalculées (électricité, électronique, IoT, PV, pompage, froid, mécanique)", () => {
    expect(num(ans("elec-fondamentaux", 0))).toBeCloseTo((12 / 220) * 1000, 1);
    expect(num(ans("elec-fondamentaux", 5))).toBeCloseTo((Math.sqrt(3) * 400 * 10 * 0.8) / 1000, 2);
    expect(num(ans("installations-domestiques", 3))).toBeCloseTo((2 * 0.0172 * 20 * 10) / 1.5, 2);
    expect(num(ans("electronique-commutation", 0))).toBe((12 - 2) / 0.02);
    expect(num(ans("electronique-commutation", 5))).toBeCloseTo(0.05 * 16, 6);
    expect(num(ans("iot-objets-connectes", 0))).toBeCloseTo((512 * 5) / 1023, 2);
    expect(num(ans("informatique-industrielle", 0))).toBe(((12 - 4) / 16) * 10);
    expect(num(ans("photovoltaique-autonome", 2))).toBeCloseTo(2400 / (5 * 0.75), 6);
    expect(num(ans("photovoltaique-autonome", 3))).toBeCloseTo((1200 * 2) / (24 * 0.8), 6);
    expect(num(ans("pompage-hydraulique", 1))).toBeCloseTo(1000 * 9.81 * 0.01 * 50, 6);
    expect(num(ans("pompage-hydraulique", 2))).toBeCloseTo((1000 * 9.81 * 0.01 * 50) / 0.6 / 1000, 2);
    expect(num(ans("pompage-hydraulique", 3))).toBeCloseTo(0.01 / (Math.PI * 0.05 ** 2), 2);
    expect(num(ans("froid-cycle", 5))).toBeCloseTo(100 * 4.18 * 25, 6);
    expect(num(ans("mecanique-transmissions", 0))).toBeCloseTo((2 * Math.PI * 1500) / 60, 0);
    expect(num(ans("mecanique-transmissions", 4))).toBeCloseTo((6e5 * Math.PI * 0.04 ** 2) / 4, 0);
    expect(ans("reseaux-ipv4", 0)).toBe(String(2 ** 8 - 2));
  });
});
