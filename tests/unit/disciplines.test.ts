/** Logiciels des disciplines : valeurs recalculées à la main sur les cas d'étude ; champs vides → données manquantes. */
import { describe, expect, it } from "vitest";
import { softwareByKey, SOFTWARE } from "@/lib/studies";
import { nearestE12, nextE12 } from "@/lib/studies/types";

const run = (k: string, patch: Record<string, unknown> = {}) => { const s = softwareByKey(k)!; return s.run({ ...s.example, ...patch }, {}); };
const val = (r: ReturnType<typeof run>, label: string) => { for (const s of r.steps) for (const l of s.lines) if (l.label.startsWith(label)) return l.value; throw new Error(`ligne absente : ${label}`); };

describe("Registre", () => {
  it("27 logiciels couvrant les disciplines du cahier des charges", () => {
    expect(SOFTWARE.length).toBe(27);
    for (const k of ["electronique", "electronique-puissance", "automatisme", "instrumentation", "objet-connecte", "technologies-medicales", "informatique", "reseaux", "telecommunications", "mecanique", "genie-industriel", "genie-civil", "batiment", "froid", "plomberie", "robotique", "drones", "irrigation", "domotique", "environnement"]) expect(softwareByKey(k), k).not.toBeNull();
  });
  it("série E12 (CEI 60063)", () => { expect(nextE12(300)).toBe(330); expect(nearestE12(15915)).toBe(15000); expect(nextE12(35454)).toBe(39000); });
});

describe("Valeurs recalculées", () => {
  it("électronique : dissipation, jonction, LED, diviseur, RC", () => {
    const r = run("electronique");
    expect(val(r, "Puissance dissipée")).toBeCloseTo(2.1, 6); expect(val(r, "Température de jonction")).toBeCloseTo(40 + 2.1 * 65, 3);
    expect(val(r, "Valeur normalisée E12")).toBe("330 Ω"); expect(r.warnings.join()).toContain("Dissipateur");
  });
  it("électronique de puissance : C = I/(2fΔV), L et C du hacheur", () => {
    const r = run("electronique-puissance");
    expect(val(r, "Capacité de filtrage")).toBeCloseTo(10000, 0);
    expect(val(r, "Inductance")).toBeCloseTo(((24 - 5) * (5 / 24)) / (200e3 * 0.6) * 1e6, 2);
    expect(val(r, "Condensateur de sortie")).toBeCloseTo((0.6 / (8 * 200e3 * 0.02)) * 1e6, 2);
  });
  it("automatisme : modules avec réserve, 24 V, air libre d'un vérin", () => {
    const r = run("automatisme");
    expect(val(r, "DI : 18 points")).toBe(2);
    expect(val(r, "Puissance appelée")).toBeCloseTo((22 * 6 + 12 * 300) * 0.024 + 40, 1);
    const v = (Math.PI / 4) * (0.032 ** 2 * 0.1 + (0.032 ** 2 - 0.012 ** 2) * 0.1) * ((6 + 1.013) / 1.013) * 1000;
    expect(val(r, "Serrage : air libre")).toBeCloseTo(v, 3);
  });
  it("instrumentation : boucle, mise à l'échelle, incertitude GUM", () => {
    const r = run("instrumentation");
    expect(val(r, "Tension nécessaire")).toBeCloseTo(12 + 0.02 * (250 + (2 * 150) / 58 / 0.75), 3);
    expect(val(r, "Grandeur mesurée")).toBeCloseTo(6, 6);
    expect(val(r, "Incertitude-type composée")).toBeCloseTo(Math.sqrt((0.05 / Math.sqrt(3)) ** 2 + 0.01 ** 2 + (0.01 / Math.sqrt(3)) ** 2), 4);
  });
  it("objet connecté : courant moyen et autonomie", () => {
    const r = run("objet-connecte");
    const i = (45 * 1.5 + 160 * 3 + 0.015 * (600 - 4.5)) / 600;
    expect(val(r, "Courant moyen")).toBeCloseTo(i, 4);
    expect(val(r, "Autonomie sur batterie")).toBeCloseTo((3000 * 0.8) / (i * 24 + 2), 1);
  });
  it("technologies médicales : gain, Nyquist, refus d'un échantillonnage insuffisant", () => {
    expect(val(run("technologies-medicales"), "Gain nécessaire")).toBeCloseTo(264, 6);
    expect(run("technologies-medicales", { fs: 200 }).warnings.join()).toContain("repliement");
  });
  it("informatique : RAID 6, croissance, onduleur", () => {
    const r = run("informatique");
    expect(val(r, "Capacité utile")).toBe(16); expect(val(r, "Besoin à l'horizon")).toBeCloseTo(6 * 1.25 ** 3, 3);
    expect(val(r, "Autonomie estimée")).toBeCloseTo((432 * 0.9 / 600) * 60, 2);
    expect(run("informatique", { disks: 3 }).missing.join()).toContain("4 disques");
  });
  it("réseaux : VLSM, budget optique, 100 m cuivre, commutateurs", () => {
    const r = run("reseaux");
    expect(val(r, "Salles de TP")).toBe("192.168.0.0/24");
    expect(val(r, "Pertes du lien")).toBeCloseTo(0.45 * 3.5 + 2 * 0.5 + 0.1, 3);
    expect(val(r, "Commutateurs")).toBe(Math.ceil((405 * 1.2) / 22));
    expect(run("reseaux", { links: [{ name: "Long", medium: "cuivre", length: 130 }] }).warnings.join()).toContain("100 m");
  });
  it("télécommunications : FSPL et zone de Fresnel", () => {
    const r = run("telecommunications");
    expect(val(r, "Affaiblissement")).toBeCloseTo(20 * Math.log10(5) + 20 * Math.log10(868) + 32.44, 3);
    expect(val(r, "Rayon de la 1re zone")).toBeCloseTo(17.32 * Math.sqrt(5 / (4 * 0.868)), 2);
  });
  it("mécanique : couple, arbre, L10h", () => {
    const r = run("mecanique");
    const c = (5500 * 0.94) / ((2 * Math.PI * 145) / 60);
    expect(val(r, "Couple de sortie")).toBeCloseTo(c, 2);
    expect(val(r, "Diamètre minimal")).toBeCloseTo(Math.cbrt((16 * c * 1.4) / (Math.PI * 40e6)) * 1000, 2);
    expect(val(r, "Durée L10h")).toBe(Math.round(((25.5 / 3.2) ** 3 * 1e6) / (60 * 145)));
  });
  it("génie industriel : TRS, takt, Wilson", () => {
    const r = run("genie-industriel");
    expect(val(r, "TRS")).toBeCloseTo(100 * (435 / 480) * ((30 * 780) / (435 * 60)) * (760 / 780), 2);
    expect(val(r, "Takt time")).toBeCloseTo(33.75, 6); expect(val(r, "Quantité économique")).toBe(1000);
  });
  it("génie civil : moment, contrainte, flèche, semelle", () => {
    const r = run("genie-civil");
    expect(val(r, "Moment maximal")).toBeCloseTo(78.75, 6);
    expect(val(r, "Flèche (service")).toBeCloseTo(((5 * 18e3 * 5 ** 4) / (384 * 30e9 * ((0.2 * 0.4 ** 3) / 12))) * 1000, 3);
    expect(val(r, "Surface de semelle")).toBeCloseTo(232 / 200, 6);
    expect(r.warnings.join()).toContain("ferraillage");
  });
  it("bâtiment, froid, plomberie", () => {
    expect(val(run("batiment"), "Σ U × A")).toBe(291);
    expect(val(run("batiment"), "Nombre de luminaires")).toBe(Math.ceil((500 * 50) / (3600 * 0.6 * 0.8)));
    expect(val(run("froid"), "Produits")).toBeCloseTo((500 * (3.6 * 7 + 250 + 1.9 * 16)) / 3600, 3);
    expect(val(run("plomberie"), "Débit probable")).toBeCloseTo(0.35 * 1.76, 6);
  });
  it("robotique, drones, irrigation, domotique, environnement", () => {
    const th = Math.atan(0.1);
    expect(val(run("robotique"), "Effort de traction")).toBeCloseTo(12 * (0.5 + 9.81 * Math.sin(th) + 9.81 * 0.02 * Math.cos(th)), 3);
    expect(val(run("drones"), "Rapport poussée/poids")).toBeCloseTo(4400 / 1650, 3);
    expect(val(run("irrigation", { et0: 6 }), "ETc")).toBeCloseTo(6.3, 6);
    expect(val(run("domotique"), "Économie")).toBeCloseTo(((1200 * 10 + 3 * 14 + 120 * 14 + 2000 * 4) - (1200 * 7 + 120 * 4 + 2000 * 3)) * 365 / 1000, 0);
    expect(val(run("environnement"), "Total")).toBeCloseTo(11.25, 6);
    expect(run("environnement", { items: [{ name: "X", qty: 10, unit: "kWh", ef: 0.5, source: "" }] }).warnings.join()).toContain("source");
  });
});
