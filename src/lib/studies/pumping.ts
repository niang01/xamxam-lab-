/**
 * Logiciel « Pompage » de A à Z — moteur pur.
 * Besoins en eau → débit → géométrie (forage ou surface) → conduites (Darcy-Weisbach, Colebrook-White, pertes
 * singulières) → HMT → courbe du réseau → point de fonctionnement sur la courbe de la pompe (fiche) → NPSH →
 * puissances → alimentation (réseau, groupe électrogène ou photovoltaïque) → câble, protection, démarrage →
 * réservoir → schémas, nomenclature, rapport. Aucune caractéristique de pompe ou de conduite n'est supposée.
 */
import { resistivity } from "@/lib/eng/electrical";
import { G, RHO, atmPressure, interp, operatingPoint, pipeLoss, vapourPressure, waterNu, type Pipe } from "./hydraulics";
import { RATINGS } from "./electrical";
import { SECTIONS } from "./pv";
import { MONTH_DAYS, monthlyPoa } from "./solar-geometry";
import { empty, finish, num, r2, req, rows, type BomLine, type Software, type StudyResult } from "./types";

const pct = (v: number | null) => (v == null ? null : v / 100);

export const PUMPING: Software = {
  key: "pompage", title: "Pompage : besoins, HMT, pertes de charge, choix de pompe, alimentation électrique ou solaire", discipline: "hydraulique", lab: "solar",
  summary: "Conception d'un système de pompage de A à Z : besoins journaliers, débit, hauteurs, pertes de charge linéaires et singulières, HMT, point de fonctionnement sur la courbe de la pompe, NPSH, puissances, alimentation par réseau, groupe électrogène ou panneaux solaires, câble et protections, réservoir, schémas, nomenclature et rapport.",
  sections: [
    {
      title: "1. Besoins en eau", fields: [
        { key: "usage", label: "Usage", type: "select", options: [{ v: "domestique", l: "Domestique" }, { v: "agricole", l: "Agricole / irrigation" }, { v: "elevage", l: "Élevage" }, { v: "industriel", l: "Industriel" }, { v: "mixte", l: "Mixte" }] },
        { key: "needs", label: "Besoins", type: "rows", cols: [{ key: "name", label: "Poste", type: "text" }, { key: "units", label: "Nombre (personnes, têtes, hectares…)", type: "number" }, { key: "per_unit", label: "Besoin unitaire", unit: "L/j", type: "number" }] },
        { key: "hours", label: "Durée de pompage disponible", unit: "h/j", type: "number" },
        { key: "storage_days", label: "Autonomie du réservoir", unit: "j", type: "number" },
        { key: "q_peak", label: "Débit instantané de pointe demandé", unit: "m³/h", type: "number", optional: true },
      ],
    },
    {
      title: "2. Source et hauteurs", fields: [
        { key: "source", label: "Source", type: "select", options: [{ v: "forage", l: "Forage / puits (pompe immergée)" }, { v: "surface", l: "Rivière, bassin, citerne (pompe de surface)" }] },
        { key: "static_level", label: "Niveau statique (profondeur de l'eau sous le sol)", unit: "m", type: "number", hint: "Forage : mesure ou rapport de forage" },
        { key: "drawdown", label: "Rabattement au débit d'exploitation", unit: "m", type: "number", hint: "Essai de pompage du forage" },
        { key: "suction_height", label: "Hauteur géométrique d'aspiration", unit: "m", type: "number", hint: "Pompe de surface : de la surface de l'eau à l'axe de la pompe (négatif si en charge)" },
        { key: "discharge_height", label: "Hauteur géométrique de refoulement", unit: "m", type: "number", hint: "Du sol (ou de l'axe de la pompe) au point d'arrivée le plus haut" },
        { key: "p_out", label: "Pression résiduelle à l'arrivée", unit: "bar", type: "number", hint: "0 pour un réservoir à l'air libre" },
        { key: "altitude", label: "Altitude du site", unit: "m", type: "number" },
        { key: "t_water", label: "Température de l'eau", unit: "°C", type: "number" },
      ],
    },
    {
      title: "3. Conduites et accessoires", fields: [
        { key: "pipes", label: "Tronçons", type: "rows", cols: [
          { key: "name", label: "Tronçon", type: "text" }, { key: "part", label: "Partie", type: "select", options: [{ v: "refoulement", l: "Refoulement" }, { v: "aspiration", l: "Aspiration" }] },
          { key: "length", label: "Longueur", unit: "m", type: "number" }, { key: "d", label: "Diamètre intérieur", unit: "mm", type: "number" },
          { key: "rough", label: "Rugosité absolue", unit: "mm", type: "number", hint: "Fiche du fabricant de tuyaux" },
          { key: "k", label: "Σ coefficients K des accessoires du tronçon", type: "number", hint: "Coudes, vannes, clapet, crépine… (fiches)" },
        ] },
        { key: "v_min", label: "Vitesse minimale admise", unit: "m/s", type: "number" }, { key: "v_max", label: "Vitesse maximale admise", unit: "m/s", type: "number" },
      ],
    },
    {
      title: "4. Pompe (courbe du fabricant)", equipment: [{ label: "Pompe", names: ["Pompe immergée de forage", "Pompe centrifuge de surface", "Pompe multicellulaire horizontale", "Pompe solaire DC", "Pompe de relevage"], map: { npsh: "npsh_r", p_n: "p_motor" } }],
      fields: [
        { key: "curve", label: "Points de la courbe", type: "rows", cols: [{ key: "q", label: "Débit", unit: "m³/h", type: "number" }, { key: "h", label: "Hauteur", unit: "m", type: "number" }, { key: "eta", label: "Rendement pompe", unit: "%", type: "number" }] },
        { key: "npsh_r", label: "NPSH requis au point de fonctionnement", unit: "m", type: "number", optional: true, hint: "Pompe de surface" },
        { key: "npsh_margin", label: "Marge de sécurité sur le NPSH", unit: "m", type: "number", optional: true },
        { key: "p_motor", label: "Puissance nominale du moteur", unit: "W", type: "number" }, { key: "eta_motor", label: "Rendement du moteur", unit: "%", type: "number" },
      ],
    },
    {
      title: "5. Alimentation électrique", fields: [
        { key: "supply", label: "Alimentation", type: "select", options: [{ v: "reseau", l: "Réseau électrique" }, { v: "groupe", l: "Groupe électrogène" }, { v: "solaire", l: "Photovoltaïque au fil du soleil" }] },
        { key: "phases", label: "Moteur (1 ou 3 phases ; DC pour le solaire)", type: "int" }, { key: "u", label: "Tension d'alimentation du moteur", unit: "V", type: "number" }, { key: "cos", label: "cos φ du moteur", type: "number" },
        { key: "start", label: "Démarrage", type: "select", options: [{ v: "direct", l: "Direct" }, { v: "etoile_triangle", l: "Étoile-triangle" }, { v: "progressif", l: "Démarreur progressif" }, { v: "variateur", l: "Variateur de vitesse" }] },
        { key: "start_factor", label: "Rapport courant de démarrage / courant nominal", type: "number", optional: true, hint: "Fiche du moteur ou du démarreur (pour le groupe électrogène)" },
        { key: "l_cable", label: "Longueur du câble d'alimentation (aller)", unit: "m", type: "number" }, { key: "du_max", label: "Chute de tension maximale", unit: "%", type: "number" },
        { key: "t_cable", label: "Température de l'âme", unit: "°C", type: "number" },
      ],
    },
    {
      title: "6. Photovoltaïque (si alimentation solaire)", geo: true, fields: [
        { key: "lat", label: "Latitude", unit: "°", type: "number", optional: true }, { key: "lon", label: "Longitude", unit: "°", type: "number", optional: true },
        { key: "ghi", label: "Irradiation globale horizontale", unit: "kWh/m²/j", type: "months", optional: true },
        { key: "tilt", label: "Inclinaison", unit: "°", type: "number", optional: true }, { key: "azimuth", label: "Azimut", unit: "°", type: "number", optional: true }, { key: "albedo", label: "Albédo", type: "number", optional: true },
        { key: "pr", label: "Ratio de performance (pompage solaire)", type: "number", optional: true, hint: "Étude ou données du fabricant du système" },
        { key: "pmax", label: "Puissance crête d'un module", unit: "Wc", type: "number", optional: true },
      ],
    },
  ],
  example: {
    usage: "mixte", hours: 7, storage_days: 1,
    needs: [{ name: "Habitants", units: 300, per_unit: 30 }, { name: "Bétail (bovins)", units: 80, per_unit: 40 }, { name: "Maraîchage (goutte-à-goutte)", units: 1, per_unit: 20000 }],
    source: "forage", static_level: 35, drawdown: 8, suction_height: null, discharge_height: 12, p_out: 0, altitude: 50, t_water: 28,
    pipes: [{ name: "Colonne d'exhaure", part: "refoulement", length: 50, d: 51.4, rough: 0.05, k: 2.5 }, { name: "Adduction vers château d'eau", part: "refoulement", length: 400, d: 51.4, rough: 0.0015, k: 4 }],
    v_min: 0.5, v_max: 1.5,
    curve: [{ q: 0, h: 110, eta: 0 }, { q: 2, h: 100, eta: 45 }, { q: 4, h: 88, eta: 60 }, { q: 6, h: 72, eta: 64 }, { q: 8, h: 50, eta: 58 }, { q: 10, h: 22, eta: 40 }],
    p_motor: 3000, eta_motor: 80,
    supply: "reseau", phases: 3, u: 400, cos: 0.82, start: "direct", start_factor: 6, l_cable: 60, du_max: 5, t_cable: 70,
  },
  run: (input): StudyResult => {
    const res = empty();
    const needs = rows(input.needs);
    let vDay = 0;
    if (!needs.length) res.missing.push("au moins un besoin en eau");
    const needLines = needs.map((n, i) => {
      const name = String(n.name || `Besoin ${i + 1}`), u = num(n.units), b = num(n.per_unit);
      if (!req(res, u, `${name} : nombre`, { min: 0 }) || !req(res, b, `${name} : besoin unitaire (L/j)`, { min: 0 })) return null;
      vDay += (u * b) / 1000;
      return { label: name, value: r2((u * b) / 1000, 4), unit: "m³/j", formula: `${u} × ${b} L/j` };
    }).filter(Boolean) as { label: string; value: number; unit: string; formula: string }[];
    const hours = num(input.hours), storage = num(input.storage_days), tw = num(input.t_water), alt = num(input.altitude), pOut = num(input.p_out);
    req(res, hours, "durée de pompage disponible (h/j)", { positive: true, max: 24 }); req(res, storage, "autonomie du réservoir (j)", { min: 0 });
    req(res, tw, "température de l'eau (°C)", { min: 0, max: 80 }); req(res, alt, "altitude du site (m)", { min: -400, max: 5000 }); req(res, pOut, "pression résiduelle à l'arrivée (bar)", { min: 0 });
    const forage = input.source !== "surface";
    const sl = num(input.static_level), dd = num(input.drawdown), sh = num(input.suction_height), dh = num(input.discharge_height);
    req(res, dh, "hauteur géométrique de refoulement (m)");
    if (forage) { req(res, sl, "niveau statique du forage (m)", { min: 0 }); req(res, dd, "rabattement (m)", { min: 0 }); }
    else req(res, sh, "hauteur géométrique d'aspiration (m)");
    const pipesIn = rows(input.pipes);
    if (!pipesIn.length) res.missing.push("au moins un tronçon de conduite");
    const pipes: (Pipe & { part: string })[] = [];
    pipesIn.forEach((p, i) => {
      const name = String(p.name || `Tronçon ${i + 1}`), l = num(p.length), d = num(p.d), rg = num(p.rough), k = num(p.k);
      if (req(res, l, `${name} : longueur (m)`, { positive: true }) && req(res, d, `${name} : diamètre intérieur (mm)`, { positive: true }) && req(res, rg, `${name} : rugosité (mm)`, { min: 0 }) && req(res, k, `${name} : Σ K des accessoires`, { min: 0 }))
        pipes.push({ name, part: p.part === "aspiration" ? "aspiration" : "refoulement", length: l, d: d / 1000, rough: rg / 1000, k });
    });
    const vMin = num(input.v_min), vMax = num(input.v_max);
    req(res, vMin, "vitesse minimale admise (m/s)", { min: 0 }); req(res, vMax, "vitesse maximale admise (m/s)", { positive: true });
    const curve = rows(input.curve).map((c) => ({ q: num(c.q), h: num(c.h), eta: num(c.eta) })).filter((c) => c.q != null && c.h != null) as { q: number; h: number; eta: number | null }[];
    if (curve.length < 3) res.missing.push("au moins 3 points de la courbe débit-hauteur de la pompe (fiche du fabricant)");
    const pMotor = num(input.p_motor), etaM = pct(num(input.eta_motor));
    req(res, pMotor, "puissance nominale du moteur (W)", { positive: true }); req(res, num(input.eta_motor), "rendement du moteur (%)", { positive: true, max: 100 });
    if (res.missing.length) return finish(res);

    // --- Besoins
    const qNeed = vDay / hours!;
    const qPeak = num(input.q_peak);
    const qDesign = Math.max(qNeed, qPeak ?? 0);
    res.steps.push({ title: "1. Besoins et débit", lines: [...needLines, { label: "Volume journalier", value: r2(vDay, 4), unit: "m³/j" }, { label: "Débit de pompage nécessaire", value: r2(qNeed, 4), unit: "m³/h", formula: "Q = V / durée" }, ...(qPeak ? [{ label: "Débit de dimensionnement (pointe)", value: r2(qDesign, 4), unit: "m³/h" }] : []), { label: "Volume du réservoir", value: r2(vDay * storage!, 4), unit: "m³", formula: "V × autonomie" }] });

    // --- Hauteurs
    const hg = forage ? sl! + dd! + dh! : sh! + dh!;
    const hp = (pOut! * 1e5) / (RHO * G);
    const nu = waterNu(tw!);
    res.steps.push({ title: "2. Hauteur géométrique", lines: [
      ...(forage ? [{ label: "Niveau dynamique", value: r2(sl! + dd!, 4), unit: "m", formula: "niveau statique + rabattement" }] : [{ label: "Hauteur d'aspiration", value: sh!, unit: "m" }]),
      { label: "Hauteur géométrique totale Hg", value: r2(hg, 4), unit: "m", formula: forage ? "niveau dynamique + refoulement" : "aspiration + refoulement" },
      { label: "Pression résiduelle convertie", value: r2(hp, 4), unit: "m", formula: "P / (ρ g)" },
      { label: "Viscosité cinématique de l'eau", value: Number(nu.toExponential(3)), unit: "m²/s", formula: `loi de Vogel à ${tw} °C` },
    ] });
    res.references.push("Pertes de charge : Darcy-Weisbach ; coefficient de frottement : 64/Re (laminaire), Colebrook-White (turbulent)", "Viscosité de l'eau : loi de Vogel ; pression de vapeur : équation de Buck (1996) ; pression atmosphérique : atmosphère type OACI", "ρ = 1000 kg/m³, g = 9,81 m/s²");

    // --- Pertes de charge au débit de dimensionnement
    const losses = (qM3h: number) => pipes.reduce((a, p) => { const l = pipeLoss(p, qM3h / 3600, nu); return a + l.linear + l.singular; }, 0);
    const lines = pipes.map((p) => { const l = pipeLoss(p, qDesign / 3600, nu); return { p, l }; });
    for (const { p, l } of lines) {
      const ok = l.v >= vMin! && l.v <= vMax!;
      res.steps.push({ title: `3. Tronçon « ${p.name} » (${p.part})`, ok, lines: [
        { label: "Vitesse", value: r2(l.v, 3), unit: "m/s", formula: `V = 4Q / (π D²) ; admis ${vMin}–${vMax} m/s` },
        { label: "Nombre de Reynolds", value: Math.round(l.re), formula: `Re = V D / ν (${l.regime})` },
        { label: "Coefficient de frottement λ", value: r2(l.f, 4), formula: l.re < 2300 ? "64 / Re" : "Colebrook-White" },
        { label: "Pertes linéaires", value: r2(l.linear, 4), unit: "m", formula: "λ (L/D) V²/2g" },
        { label: "Pertes singulières", value: r2(l.singular, 4), unit: "m", formula: "ΣK V²/2g" },
        { label: "Diamètre intérieur pour la vitesse maximale", value: r2(1000 * Math.sqrt((4 * qDesign / 3600) / (Math.PI * vMax!)), 4), unit: "mm", formula: "D = √(4Q / (π Vmax))" },
      ] });
      if (!ok) res.warnings.push(`${p.name} : vitesse ${r2(l.v, 3)} m/s hors de la plage admise (${vMin}–${vMax} m/s)`);
    }
    const jTotal = losses(qDesign);
    const hmt = hg + jTotal + hp;
    res.steps.push({ title: "4. Hauteur manométrique totale", lines: [{ label: "Σ pertes de charge", value: r2(jTotal, 4), unit: "m" }, { label: "HMT au débit de dimensionnement", value: r2(hmt, 4), unit: "m", formula: "HMT = Hg + ΣJ + P/(ρg)" }] });

    // --- Point de fonctionnement
    const sys = (q: number) => hg + hp + losses(q);
    const op = operatingPoint(curve.map((c) => ({ x: c.q, y: c.h })), sys);
    const sysLines = [0, 0.25, 0.5, 0.75, 1, 1.25].map((k) => ({ label: `Réseau à Q = ${r2(qDesign * k, 3)} m³/h`, value: r2(sys(qDesign * k), 4), unit: "m" }));
    if (!op) {
      res.steps.push({ title: "5. Point de fonctionnement", ok: false, lines: sysLines });
      res.warnings.push("La courbe de la pompe ne croise pas la courbe du réseau : pompe inadaptée (hauteur insuffisante ou trop forte)");
      return finish(res);
    }
    const etaPts = curve.filter((c) => c.eta != null).map((c) => ({ x: c.q, y: c.eta! }));
    const etaP = etaPts.length >= 2 ? interp(etaPts, op.q) : null;
    const okQ = op.q >= qNeed * 0.999;
    res.steps.push({ title: "5. Point de fonctionnement", ok: okQ, lines: [...sysLines, { label: "Débit au point de fonctionnement", value: r2(op.q, 4), unit: "m³/h", formula: "intersection pompe / réseau" }, { label: "Hauteur au point de fonctionnement", value: r2(op.h, 4), unit: "m" }, { label: "Rendement de la pompe", value: etaP != null ? r2(etaP, 3) : "non fourni", unit: etaP != null ? "%" : "" }, { label: "Durée de pompage pour le volume journalier", value: r2(vDay / op.q, 4), unit: "h/j" }, ...pipes.map((p) => ({ label: `Vitesse au point de fonctionnement — ${p.name}`, value: r2(pipeLoss(p, op.q / 3600, nu).v, 3), unit: "m/s" }))] });
    for (const p of pipes) { const v = pipeLoss(p, op.q / 3600, nu).v; if (v > vMax!) res.warnings.push(`${p.name} : vitesse ${r2(v, 3)} m/s au point de fonctionnement, supérieure à ${vMax} m/s`); }
    if (!okQ) res.warnings.push(`Débit au point de fonctionnement (${r2(op.q, 3)} m³/h) inférieur au débit nécessaire (${r2(qNeed, 3)} m³/h) : durée de pompage allongée à ${r2(vDay / op.q, 3)} h/j`);
    if (etaP == null || etaP <= 0) { res.missing.push("rendement de la pompe au point de fonctionnement (colonne « Rendement pompe » de la courbe)"); return finish(res); }

    // --- NPSH (pompe de surface)
    if (!forage) {
      const asp = pipes.filter((p) => p.part === "aspiration");
      const jAsp = asp.reduce((a, p) => { const l = pipeLoss(p, op.q / 3600, nu); return a + l.linear + l.singular; }, 0);
      const npshA = (atmPressure(alt!) - vapourPressure(tw!)) / (RHO * G) - sh! - jAsp;
      const npshR = num(input.npsh_r), margin = num(input.npsh_margin);
      const ok = npshR != null && margin != null ? npshA >= npshR + margin : undefined;
      res.steps.push({ title: "6. NPSH disponible", ok, lines: [{ label: "Pression atmosphérique", value: r2(atmPressure(alt!) / 1000, 4), unit: "kPa" }, { label: "Pression de vapeur", value: r2(vapourPressure(tw!) / 1000, 4), unit: "kPa" }, { label: "Pertes à l'aspiration", value: r2(jAsp, 4), unit: "m" }, { label: "NPSH disponible", value: r2(npshA, 4), unit: "m", formula: "(Patm − Pv)/(ρg) − Ha − J_asp" }, ...(npshR != null ? [{ label: "NPSH requis + marge", value: r2(npshR + (margin ?? 0), 4), unit: "m" }] : [])] });
      if (npshR == null || margin == null) res.missing.push("NPSH requis de la pompe et marge de sécurité (pompe de surface)");
      else if (!ok) res.warnings.push("Risque de cavitation : NPSH disponible insuffisant (abaisser la pompe, raccourcir ou élargir l'aspiration)");
    }

    // --- Puissances
    const pHyd = RHO * G * (op.q / 3600) * op.h;
    const pShaft = pHyd / (etaP / 100);
    const pElec = pShaft / etaM!;
    const okMotor = pMotor! >= pShaft;
    const hoursOp = vDay / op.q;
    res.steps.push({ title: "7. Puissances et énergie", ok: okMotor, lines: [{ label: "Puissance hydraulique", value: r2(pHyd, 4), unit: "W", formula: "ρ g Q H" }, { label: "Puissance absorbée par la pompe", value: r2(pShaft, 4), unit: "W", formula: "P_hyd / η_pompe" }, { label: "Puissance électrique absorbée", value: r2(pElec, 4), unit: "W", formula: "P_arbre / η_moteur" }, { label: "Puissance nominale du moteur", value: pMotor!, unit: "W" }, { label: "Énergie électrique journalière", value: r2((pElec * hoursOp) / 1000, 4), unit: "kWh/j" }] });
    if (!okMotor) res.warnings.push("Moteur sous-dimensionné au point de fonctionnement");

    // --- Alimentation
    const bom: BomLine[] = [];
    const supply = input.supply === "groupe" ? "groupe" : input.supply === "solaire" ? "solaire" : "reseau";
    const ph = num(input.phases), u = num(input.u), cos = num(input.cos), lC = num(input.l_cable), duMax = num(input.du_max), tC = num(input.t_cable);
    req(res, u, "tension d'alimentation du moteur (V)", { positive: true }); req(res, lC, "longueur du câble (m)", { positive: true }); req(res, duMax, "chute de tension maximale (%)", { positive: true, max: 15 }); req(res, tC, "température de l'âme (°C)");
    const dc = supply === "solaire" && ph !== 1 && ph !== 3;
    if (!dc) { req(res, ph, "nombre de phases du moteur (1 ou 3)", { min: 1, max: 3 }); req(res, cos, "cos φ du moteur", { positive: true, max: 1 }); }
    if (res.missing.length) return finish(res);
    const tri = ph === 3;
    const iN = dc ? pElec / u! : tri ? pElec / (Math.sqrt(3) * u! * cos!) : pElec / (u! * cos!);
    const rho = resistivity("copper", tC!);
    const b = tri ? Math.sqrt(3) : 2;
    const sMin = (100 * b * rho * lC! * iN * (dc ? 1 : cos!)) / (duMax! * u!);
    const sec = SECTIONS.find((x) => x >= sMin) ?? null;
    const inProt = RATINGS.find((x) => x >= iN) ?? null;
    res.steps.push({ title: "8. Câble et protection du moteur", lines: [{ label: "Courant absorbé", value: r2(iN, 4), unit: "A", formula: dc ? "P / U" : tri ? "P / (√3 U cos φ)" : "P / (U cos φ)" }, { label: "Section minimale (chute de tension)", value: r2(sMin, 3), unit: "mm²", formula: "S = b ρθ L I cos φ / (ΔU% × U / 100)" }, { label: "Section normalisée", value: sec ?? "hors gamme", unit: sec ? "mm²" : "" }, { label: "Protection (calibre ou réglage ≥ I)", value: inProt ?? "hors gamme", unit: inProt ? "A" : "" }] });
    res.warnings.push("Section du câble à vérifier aussi en courant admissible (tableau normatif) — réactance négligée");
    if (supply === "groupe") {
      const sf = num(input.start_factor);
      if (req(res, sf, "rapport courant de démarrage / courant nominal", { min: 1, max: 10 })) {
        const sKva = (pElec / (cos ?? 1)) / 1000;
        res.steps.push({ title: "9. Groupe électrogène", lines: [{ label: "Puissance apparente en marche", value: r2(sKva, 4), unit: "kVA" }, { label: "Puissance apparente au démarrage", value: r2(sKva * sf, 4), unit: "kVA", formula: "S × (Id / In) — à confronter à la capacité de démarrage du groupe (fiche)" }] });
        bom.push({ name: "Groupe électrogène", qty: 1, unit: "u", spec: `≥ ${r2(sKva, 3)} kVA en marche ; démarrage ${r2(sKva * sf, 3)} kVA à vérifier` });
      }
    }
    if (supply === "solaire") {
      const lat = num(input.lat), ghi = Array.isArray(input.ghi) ? (input.ghi as unknown[]).map(num) : [], tilt = num(input.tilt), az = num(input.azimuth), alb = num(input.albedo), pr = num(input.pr), pmax = num(input.pmax);
      req(res, lat, "latitude (solaire)", { min: -66, max: 66 }); if (ghi.length !== 12 || ghi.some((x) => x == null)) res.missing.push("irradiation des 12 mois (solaire)");
      req(res, tilt, "inclinaison (solaire)", { min: 0, max: 90 }); req(res, az, "azimut (solaire)", { min: -180, max: 180 }); req(res, alb, "albédo (solaire)", { min: 0, max: 1 }); req(res, pr, "ratio de performance du pompage solaire", { positive: true, max: 1 }); req(res, pmax, "puissance crête d'un module (Wc)", { positive: true });
      if (!res.missing.length) {
        const poa = monthlyPoa({ lat: lat!, ghi: ghi as number[], tilt: tilt!, azimuth: az!, albedo: alb! });
        res.warnings.push(...poa.warnings);
        const eDay = (pElec * hoursOp) / 1000;
        const need = poa.months.map((m) => eDay / (m.poa * pr!));
        const pc = Math.max(...need) * 1000;
        const n = Math.ceil(pc / pmax!);
        const crit = need.indexOf(Math.max(...need)) + 1;
        res.steps.push({ title: "9. Champ photovoltaïque (au fil du soleil)", lines: [{ label: "Énergie journalière", value: r2(eDay, 4), unit: "kWh/j" }, { label: "Mois critique", value: crit }, { label: "Puissance crête nécessaire", value: r2(pc, 4), unit: "Wc", formula: "max(E / (H_T × PR))" }, { label: "Modules", value: n }, { label: "Puissance crête installée", value: n * pmax!, unit: "Wc" }, { label: "Volume pompé le mois critique (indicatif)", value: r2(vDay * MONTH_DAYS[crit - 1], 4), unit: "m³/mois" }] });
        res.assumptions.push("Pompage au fil du soleil : débit variable dans la journée ; vérifier avec la courbe du contrôleur/fabricant ; association série/parallèle selon la fiche du contrôleur de pompe");
        bom.push({ name: "Module photovoltaïque", qty: n, unit: "u", spec: `${pmax} Wc` }, { name: "Contrôleur de pompe solaire", qty: 1, unit: "u", spec: `≥ ${r2(n * pmax!, 4)} Wc` }, { name: "Structure de support PV", qty: 1, unit: "u", spec: `${n} modules, ${tilt}°` }, { name: "Connecteurs MC4", qty: 2, unit: "paires", spec: "" });
      }
    }
    if (res.missing.length) return finish(res);

    // --- Nomenclature
    const start = String(input.start);
    bom.unshift({ name: forage ? "Pompe immergée de forage" : "Pompe centrifuge de surface", qty: 1, unit: "u", spec: `Q = ${r2(op.q, 3)} m³/h à H = ${r2(op.h, 3)} m ; moteur ${pMotor} W` });
    for (const p of pipes) bom.push({ name: "Conduite PVC / PEHD", qty: r2(p.length, 4), unit: "m", spec: `DN intérieur ${r2(p.d * 1000, 3)} mm (${p.name})` });
    bom.push({ name: "Clapet anti-retour", qty: 1, unit: "u", spec: "au refoulement" }, { name: "Vanne manuelle", qty: 2, unit: "u", spec: "isolement" }, { name: "Manomètre", qty: 1, unit: "u", spec: `étendue ≥ ${r2((op.h * RHO * G) / 1e5, 3)} bar` }, { name: "Débitmètre à turbine", qty: 1, unit: "u", spec: `${r2(op.q, 3)} m³/h` });
    if (!forage) bom.push({ name: "Crépine d'aspiration", qty: 1, unit: "u", spec: "avec clapet de pied" });
    if (forage) bom.push({ name: "Capteur de niveau à flotteur", qty: 1, unit: "u", spec: "protection contre la marche à sec" });
    bom.push({ name: "Réservoir / château d'eau", qty: 1, unit: "u", spec: `${r2(vDay * storage!, 4)} m³` });
    bom.push({ name: "Câble électrique", qty: r2(lC!, 4), unit: "m", spec: `${sec ?? "?"} mm², ${dc ? "2" : tri ? "4" : "3"} conducteurs` });
    if (!dc) bom.push({ name: "Disjoncteur moteur", qty: 1, unit: "u", spec: `réglage ≥ ${r2(iN, 3)} A` });
    if (!dc) bom.push({ name: start === "etoile_triangle" ? "Démarreur étoile-triangle" : start === "progressif" ? "Démarreur progressif" : start === "variateur" ? "Variateur de vitesse" : "Démarreur direct", qty: 1, unit: "u", spec: `${r2(pMotor! / 1000, 3)} kW` });
    bom.push({ name: "Coffret industriel étanche", qty: 1, unit: "u", spec: "commande et protection de la pompe" });
    res.bom = bom;
    res.summary = [{ label: "Débit au point de fonctionnement", value: r2(op.q, 3), unit: "m³/h" }, { label: "HMT", value: r2(op.h, 3), unit: "m" }, { label: "Puissance électrique absorbée", value: r2(pElec / 1000, 3), unit: "kW" }];
    res.diagram = tri && supply !== "solaire" && (start === "direct" || start === "etoile_triangle")
      ? { kind: start === "direct" ? "demarrage_direct" : "etoile_triangle", params: { pkW: r2(pMotor! / 1000, 3), u: u!, cos: cos!, eta: etaM! } }
      : { kind: "pompage_hydraulique", params: { zones: 1 } };
    return finish(res);
  },
};
