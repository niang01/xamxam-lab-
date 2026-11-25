/**
 * Logiciel « Installation électrique » (laboratoire Électricité et Électrotechnique) — moteur pur.
 * Pour chaque départ : courant d'emploi Ib, calibre normalisé In ≥ Ib, section d'après le tableau normatif choisi
 * (Iz × K ≥ In), chute de tension (augmentation de section si la limite saisie est dépassée), puis appareil général,
 * nomenclature et schéma unifilaire. Aucune limite de chute de tension, aucun coefficient ni tableau n'est supposé.
 */
import { CONDUCTORS, resistivity, type Conductor } from "@/lib/eng/electrical";
import { empty, finish, num, r2, req, rows, type BomLine, type Software, type Step, type StudyResult } from "./types";

/** Valeurs préférentielles des calibres (CEI 60898-1 jusqu'à 125 A ; au-delà, calibres usuels CEI 60947-2). */
export const RATINGS = [2, 4, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630];
export const nextRating = (i: number) => RATINGS.find((x) => x >= i - 1e-9) ?? null;

const KINDS = [{ v: "eclairage", l: "Éclairage" }, { v: "prises", l: "Prises de courant" }, { v: "specialise", l: "Circuit spécialisé" }, { v: "moteur", l: "Moteur" }, { v: "autre", l: "Autre" }];

export const ELECTRICAL: Software = {
  key: "installation-electrique", title: "Installation électrique : départs, protections, sections, chutes de tension", discipline: "electrique", lab: "electrical",
  summary: "Étude d'un tableau électrique domestique, tertiaire ou industriel : courants d'emploi, calibres normalisés, sections d'après le tableau normatif choisi, chutes de tension, appareil général, nomenclature, schéma unifilaire et rapport.",
  needs: ["ampacity_table"],
  sections: [
    {
      title: "Réseau et règles de l'étude", fields: [
        { key: "u_mono", label: "Tension simple (phase-neutre)", unit: "V", type: "number" },
        { key: "u_tri", label: "Tension composée (entre phases)", unit: "V", type: "number", optional: true, hint: "Seulement si des départs sont triphasés." },
        { key: "conductor", label: "Métal des conducteurs", type: "select", options: [{ v: "copper", l: "Cuivre" }, { v: "aluminium", l: "Aluminium" }] },
        { key: "temp", label: "Température de l'âme pour la chute de tension", unit: "°C", type: "number", hint: "Ex. température de service du conducteur selon la norme appliquée." },
        { key: "lambda", label: "Réactance linéique λ", unit: "Ω/m", type: "number", optional: true, hint: "Requise pour les départs à cos φ < 1 (valeur de la norme ou du fabricant)." },
        { key: "k", label: "Facteur global de correction K", unit: "", type: "number", hint: "Produit des facteurs (température, groupement, pose) tirés de la norme ; 1 si non applicable." },
        { key: "du_max", label: "Chute de tension maximale admise", unit: "%", type: "number", hint: "Limite de la norme appliquée pour ce type d'installation." },
        { key: "ks", label: "Coefficient de simultanéité du tableau", unit: "", type: "number", hint: "Choisi par le concepteur (norme, guide, retour d'expérience)." },
      ],
    },
    {
      title: "Départs", fields: [{
        key: "circuits", label: "Départs", type: "rows", cols: [
          { key: "name", label: "Désignation", type: "text" },
          { key: "kind", label: "Type", type: "select", options: KINDS },
          { key: "phases", label: "Phases (1 ou 3)", type: "int" },
          { key: "p", label: "Puissance", unit: "W", type: "number" },
          { key: "cos", label: "cos φ", type: "number" },
          { key: "eta", label: "Rendement η", type: "number", hint: "1 pour une charge non motorisée" },
          { key: "length", label: "Longueur", unit: "m", type: "number" },
          { key: "in_min", label: "Calibre minimal imposé", unit: "A", type: "number", optional: true, hint: "Si la norme appliquée impose un calibre minimal pour ce type de circuit." },
          { key: "points", label: "Points (prises, foyers)", type: "int", optional: true },
          { key: "controls", label: "Commandes (interrupteurs)", type: "int", optional: true },
        ],
      }],
    },
    {
      title: "Protection différentielle", fields: [
        { key: "rcd_count", label: "Nombre d'interrupteurs différentiels", type: "int" },
        { key: "rcd_idn", label: "Sensibilité", unit: "mA", type: "number" },
      ],
    },
  ],
  example: {
    u_mono: 230, u_tri: 400, conductor: "copper", temp: 70, lambda: 0.00008, k: 1, du_max: 3, ks: 0.7, rcd_count: 2, rcd_idn: 30,
    circuits: [
      { name: "Éclairage séjour", kind: "eclairage", phases: 1, p: 600, cos: 1, eta: 1, length: 18, in_min: 10, points: 6, controls: 3 },
      { name: "Prises séjour", kind: "prises", phases: 1, p: 2500, cos: 1, eta: 1, length: 22, in_min: 16, points: 8 },
      { name: "Chauffe-eau", kind: "specialise", phases: 1, p: 2200, cos: 1, eta: 1, length: 12, points: 1 },
      { name: "Pompe de surface", kind: "moteur", phases: 1, p: 1100, cos: 0.85, eta: 0.8, length: 30, points: 1 },
    ],
  },
  run: (input, ctx): StudyResult => {
    const res = empty();
    const uMono = num(input.u_mono), uTri = num(input.u_tri), temp = num(input.temp), lambda = num(input.lambda), k = num(input.k), duMax = num(input.du_max), ks = num(input.ks);
    const conductor: Conductor = input.conductor === "aluminium" ? "aluminium" : "copper";
    req(res, uMono, "tension simple U (V)", { positive: true });
    req(res, temp, "température de l'âme θ (°C)");
    req(res, k, "facteur global de correction K", { positive: true, max: 2 });
    req(res, duMax, "chute de tension maximale admise (%)", { positive: true, max: 20 });
    req(res, ks, "coefficient de simultanéité du tableau", { positive: true, max: 1 });
    const table = ctx.ampacity;
    if (!table || !table.rows.length) res.missing.push("tableau normatif des courants admissibles (Administration → tableaux normatifs, puis le choisir ici)");
    const circuits = rows(input.circuits);
    if (!circuits.length) res.missing.push("au moins un départ");
    if (res.missing.length) return finish(res);
    const tableRows = [...table!.rows].sort((a, b) => a.s - b.s);
    res.references.push(`Courants admissibles : ${table!.reference}`, CONDUCTORS[conductor].ref, "Calibres : valeurs préférentielles CEI 60898-1 (≤ 125 A), calibres usuels CEI 60947-2 au-delà — vérifier la gamme du fabricant", "Chute de tension : ΔU = b (ρθ L cos φ / S + λ L sin φ) Ib, b = 2 en monophasé, √3 en triphasé (tension composée)");
    res.assumptions.push("L = longueur simple du départ ; courant constant le long du départ", "Protection contre les surcharges par disjoncteur : In ≥ Ib et Iz × K ≥ In", "Tenue au court-circuit et coupure automatique (boucle de défaut) NON vérifiées ici : à contrôler selon la norme");
    const rho = resistivity(conductor, temp!);
    const bom: BomLine[] = [];
    let sTotal = 0;
    const circuitsText: string[] = [];
    const add = (name: string, qty: number, unit: string, spec: string) => { const l = bom.find((b) => b.name === name && b.spec === spec); if (l) l.qty += qty; else bom.push({ name, qty, unit, spec }); };
    circuits.forEach((c, idx) => {
      const name = String(c.name || `Départ ${idx + 1}`);
      const ph = num(c.phases) === 3 ? 3 : 1;
      const p = num(c.p), cos = num(c.cos), eta = num(c.eta), len = num(c.length);
      const before = res.missing.length;
      req(res, p, `${name} : puissance (W)`, { positive: true }); req(res, cos, `${name} : cos φ`, { positive: true, max: 1 }); req(res, eta, `${name} : rendement η`, { positive: true, max: 1 }); req(res, len, `${name} : longueur (m)`, { positive: true });
      if (ph === 3) req(res, uTri, `${name} : tension composée (départ triphasé)`, { positive: true });
      const sin = cos != null ? Math.sqrt(Math.max(0, 1 - cos * cos)) : 0;
      if (sin > 1e-9 && lambda == null) res.missing.push(`${name} : réactance linéique λ (cos φ < 1)`);
      if (res.missing.length > before) return;
      const u = ph === 3 ? uTri! : uMono!;
      const ib = ph === 3 ? p! / (Math.sqrt(3) * u * cos! * eta!) : p! / (u * cos! * eta!);
      const inMin = num(c.in_min);
      const inA = nextRating(Math.max(ib, inMin ?? 0));
      const step: Step = { title: `${idx + 1}. ${name} (${ph === 3 ? "triphasé" : "monophasé"})`, lines: [] };
      step.lines.push({ label: "Courant d'emploi Ib", value: r2(ib), unit: "A", formula: ph === 3 ? "Ib = P / (√3 U cos φ η)" : "Ib = P / (U cos φ η)" });
      if (inA == null) { res.warnings.push(`${name} : Ib = ${r2(ib)} A dépasse la gamme de calibres prise en compte`); res.steps.push(step); return; }
      step.lines.push({ label: "Calibre de protection In", value: inA, unit: "A", formula: inMin ? `plus petit calibre normalisé ≥ max(Ib, ${inMin} A imposés)` : "plus petit calibre normalisé ≥ Ib" });
      let pick = tableRows.find((r) => r.iz * k! >= inA);
      if (!pick) { res.warnings.push(`${name} : aucune section du tableau ne vérifie Iz × K ≥ ${inA} A`); res.steps.push(step); return; }
      step.lines.push({ label: "Section (échauffement)", value: pick.s, unit: "mm²", formula: `Iz × K = ${pick.iz} × ${k} = ${r2(pick.iz * k!)} A ≥ In` });
      const b = ph === 3 ? Math.sqrt(3) : 2;
      const duPct = (s: number) => (100 * b * (rho * len! * cos! / s + (sin > 1e-9 ? lambda! * len! * sin : 0)) * ib) / u;
      let du = duPct(pick.s);
      const sHeat = pick.s;
      while (du > duMax! && pick) { const next = tableRows.find((r) => r.s > pick!.s); if (!next) break; pick = next; du = duPct(pick.s); }
      step.lines.push({ label: "Chute de tension", value: r2(du), unit: "%", formula: `ΔU% = 100 × ${b === 2 ? "2" : "√3"} (ρθ L cos φ / S + λ L sin φ) Ib / U ; ρθ = ${r2(rho, 4)} Ω·mm²/m` });
      if (pick.s !== sHeat) step.lines.push({ label: "Section retenue (chute de tension)", value: pick.s, unit: "mm²" });
      step.ok = du <= duMax!;
      if (!step.ok) res.warnings.push(`${name} : chute de tension ${r2(du)} % > ${duMax} % même avec la plus grande section du tableau`);
      step.note = `Retenu : disjoncteur ${inA} A, ${pick.s} mm² ${conductor === "copper" ? "cuivre" : "aluminium"}.`;
      res.steps.push(step);
      sTotal += p! / (cos! * eta!);
      circuitsText.push(`${name.replace(/[;/]/g, " ")}/${inA}/${pick.s}`);
      const nCond = ph === 3 ? 5 : 3;
      add("Disjoncteur", 1, "u", `${inA} A, ${ph === 3 ? "3P+N" : "1P+N"}`);
      add("Conducteur rigide H07V-U", r2(len! * nCond, 4), "m", `${pick.s} mm² (${nCond} conducteurs × ${len} m)`);
      add("Conduit / gaine ICTA", r2(len!, 4), "m", `diamètre selon le nombre de conducteurs (${nCond} × ${pick.s} mm²)`);
      const pts = num(c.points), ctl = num(c.controls);
      if (c.kind === "eclairage") { if (pts) add("Point lumineux (DCL)", pts, "u", ""); if (ctl) add("Interrupteur simple allumage", ctl, "u", "ou va-et-vient selon le plan"); }
      if (c.kind === "prises" && pts) add("Prise de courant", pts, "u", "2P+T");
      if (c.kind === "specialise") add("Prise spécialisée", pts || 1, "u", `${name}`);
      if (c.kind === "moteur") add("Démarreur direct", 1, "u", `${r2(p! / 1000)} kW — relais thermique réglé sur le courant nominal plaque`);
    });
    if (res.missing.length) return finish(res);
    const uMain = (num(input.u_tri) != null && circuits.some((c) => num(c.phases) === 3)) ? uTri! : uMono!;
    const tri = uMain === uTri;
    const iGen = (ks! * sTotal) / (tri ? Math.sqrt(3) * uMain : uMain);
    const inGen = nextRating(iGen);
    res.steps.push({ title: "Appareil général", lines: [
      { label: "Puissance apparente installée ΣS", value: r2(sTotal / 1000), unit: "kVA", formula: "S = P / (cos φ η)" },
      { label: "Puissance appelée ks × ΣS", value: r2((ks! * sTotal) / 1000), unit: "kVA" },
      { label: "Courant général", value: r2(iGen), unit: "A", formula: tri ? "I = ks ΣS / (√3 U)" : "I = ks ΣS / U" },
      { label: "Calibre de l'appareil général", value: inGen ?? "hors gamme", unit: inGen ? "A" : "" },
    ] });
    const nR = num(input.rcd_count), idn = num(input.rcd_idn);
    if (req(res, nR, "nombre d'interrupteurs différentiels", { positive: true, max: 8 }) && req(res, idn, "sensibilité des différentiels (mA)", { positive: true })) {
      add("Interrupteur différentiel", nR, "u", `${idn} mA, calibre ≥ courant des départs en aval (type selon les charges)`);
    }
    if (inGen) add("Disjoncteur de branchement", 1, "u", `${inGen} A`);
    add("Coffret électrique modulaire", 1, "u", `${circuits.length + (nR ?? 0) + 1} appareils + réserve`);
    add("Bornier de connexion", 2, "u", "neutre et terre");
    res.bom = bom;
    res.summary = [{ label: "Départs étudiés", value: circuits.length }, { label: "Puissance appelée", value: r2((ks! * sTotal) / 1000), unit: "kVA" }, { label: "Appareil général", value: inGen ?? "hors gamme", unit: inGen ? "A" : "" }];
    res.diagram = { kind: "tableau_unifilaire", params: { circuits: circuitsText.join(";"), main: inGen ?? 0, rcd: nR ?? 1, idn: idn ?? 30 } };
    return finish(res);
  },
};
