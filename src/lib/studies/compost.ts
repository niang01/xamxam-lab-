/**
 * Logiciel « Compostage et valorisation des déchets organiques » — moteur pur.
 * Mélange : masses, humidité, rapport C/N (d'après les teneurs SAISIES de chaque matière), volume ; ajustement du
 * C/N par un amendement ; andains ou bacs ; plateforme ; aération forcée ; calendrier ; production de compost.
 * Les plages cibles (C/N, humidité, température d'hygiénisation) sont choisies par l'utilisateur (guide ou norme).
 */
import { empty, finish, num, r2, req, rows, type BomLine, type Software, type StudyResult } from "./types";

const pct = (v: number | null) => (v == null ? null : v / 100);

export const COMPOST: Software = {
  key: "compostage", title: "Compostage : mélange C/N, humidité, andains ou bacs, aération, calendrier, production", discipline: "environnement", lab: "solar",
  summary: "Compostage domestique, en bacs, en andains, sur plateforme ou industriel : caractérisation du mélange, rapport carbone/azote, humidité, volume, ajustement par un amendement, géométrie des andains, surface de plateforme, aération, retournements, durée, maturation et production estimée.",
  sections: [
    { title: "1. Matières", fields: [{ key: "feeds", label: "Matières à composter", type: "rows", cols: [
      { key: "name", label: "Matière", type: "text" }, { key: "mass", label: "Masse", unit: "kg", type: "number" }, { key: "moisture", label: "Humidité", unit: "%", type: "number" },
      { key: "c", label: "Carbone", unit: "% MS", type: "number" }, { key: "n", label: "Azote", unit: "% MS", type: "number" }, { key: "density", label: "Masse volumique en vrac", unit: "kg/m³", type: "number" },
    ] }] },
    { title: "2. Objectifs du procédé", fields: [
      { key: "cn_min", label: "C/N visé — minimum", type: "number" }, { key: "cn_max", label: "C/N visé — maximum", type: "number" },
      { key: "w_min", label: "Humidité visée — minimum", unit: "%", type: "number" }, { key: "w_max", label: "Humidité visée — maximum", unit: "%", type: "number" },
      { key: "adjust", label: "Matière d'ajustement du C/N (numéro de ligne)", type: "int", optional: true, hint: "Ligne de la matière dont la quantité peut être ajustée" },
    ] },
    { title: "3. Procédé et installation", fields: [
      { key: "method", label: "Méthode", type: "select", options: [{ v: "andains", l: "Andains" }, { v: "bacs", l: "Bacs ou casiers" }, { v: "aere", l: "Aération forcée" }] },
      { key: "base", label: "Largeur à la base de l'andain", unit: "m", type: "number", optional: true }, { key: "height", label: "Hauteur de l'andain", unit: "m", type: "number", optional: true },
      { key: "aisle", label: "Allée entre andains", unit: "m", type: "number", optional: true },
      { key: "bin_volume", label: "Volume d'un bac", unit: "m³", type: "number", optional: true },
      { key: "air_rate", label: "Débit d'air d'aération", unit: "m³/h par tonne", type: "number", optional: true, hint: "Méthode, guide technique ou essais" },
      { key: "active_days", label: "Durée de la phase active", unit: "j", type: "number" }, { key: "maturation_days", label: "Durée de maturation", unit: "j", type: "number" },
      { key: "turn_interval", label: "Intervalle entre retournements", unit: "j", type: "number" },
      { key: "t_hyg", label: "Température d'hygiénisation visée", unit: "°C", type: "number" }, { key: "d_hyg", label: "Durée de maintien", unit: "j", type: "number" },
      { key: "loss", label: "Perte de matière sèche (minéralisation)", unit: "%", type: "number", hint: "Retour d'expérience ou suivi" }, { key: "w_final", label: "Humidité du compost mûr", unit: "%", type: "number" },
    ] },
  ],
  example: {
    feeds: [{ name: "Fumier de bovins (exemple)", mass: 2000, moisture: 75, c: 40, n: 2.4, density: 700 }, { name: "Paille broyée (exemple)", mass: 400, moisture: 12, c: 46, n: 0.6, density: 100 }, { name: "Déchets verts (exemple)", mass: 800, moisture: 60, c: 44, n: 2, density: 350 }],
    cn_min: 25, cn_max: 35, w_min: 50, w_max: 60, adjust: 2, method: "andains", base: 3, height: 1.5, aisle: 2, active_days: 60, maturation_days: 60, turn_interval: 7, t_hyg: 55, d_hyg: 3, loss: 40, w_final: 35,
  },
  run: (input): StudyResult => {
    const res = empty();
    const feeds = rows(input.feeds).map((f, i) => ({ name: String(f.name || `Matière ${i + 1}`), m: num(f.mass), w: pct(num(f.moisture)), c: pct(num(f.c)), n: pct(num(f.n)), rho: num(f.density), raw: f }));
    if (!feeds.length) res.missing.push("au moins une matière");
    for (const f of feeds) {
      req(res, f.m, `${f.name} : masse (kg)`, { min: 0 }); req(res, num(f.raw.moisture), `${f.name} : humidité (%)`, { min: 0, max: 99 });
      req(res, num(f.raw.c), `${f.name} : carbone (% MS)`, { positive: true, max: 100 }); req(res, num(f.raw.n), `${f.name} : azote (% MS)`, { positive: true, max: 100 }); req(res, f.rho, `${f.name} : masse volumique (kg/m³)`, { positive: true });
    }
    const cnMin = num(input.cn_min), cnMax = num(input.cn_max), wMin = pct(num(input.w_min)), wMax = pct(num(input.w_max));
    req(res, cnMin, "C/N visé minimum", { positive: true }); req(res, cnMax, "C/N visé maximum", { positive: true });
    req(res, num(input.w_min), "humidité visée minimum (%)", { positive: true, max: 100 }); req(res, num(input.w_max), "humidité visée maximum (%)", { positive: true, max: 100 });
    const act = num(input.active_days), mat = num(input.maturation_days), turn = num(input.turn_interval), tHyg = num(input.t_hyg), dHyg = num(input.d_hyg), loss = pct(num(input.loss)), wF = pct(num(input.w_final));
    req(res, act, "durée de la phase active (j)", { positive: true }); req(res, mat, "durée de maturation (j)", { min: 0 }); req(res, turn, "intervalle entre retournements (j)", { positive: true });
    req(res, tHyg, "température d'hygiénisation (°C)", { positive: true }); req(res, dHyg, "durée de maintien (j)", { positive: true });
    req(res, num(input.loss), "perte de matière sèche (%)", { min: 0, max: 90 }); req(res, num(input.w_final), "humidité du compost mûr (%)", { min: 0, max: 90 });
    if (res.missing.length) return finish(res);
    const mix = (list: typeof feeds) => {
      const m = list.reduce((a, f) => a + f.m!, 0), dry = list.reduce((a, f) => a + f.m! * (1 - f.w!), 0);
      const c = list.reduce((a, f) => a + f.m! * (1 - f.w!) * f.c!, 0), n = list.reduce((a, f) => a + f.m! * (1 - f.w!) * f.n!, 0);
      const vol = list.reduce((a, f) => a + f.m! / f.rho!, 0);
      return { m, dry, cn: c / n, w: 1 - dry / m, vol };
    };
    const base = mix(feeds);
    res.steps.push({ title: "1. Mélange initial", lines: [
      ...feeds.map((f) => ({ label: `${f.name} : C/N`, value: r2(f.c! / f.n!, 3) })),
      { label: "Masse totale", value: r2(base.m, 4), unit: "kg" }, { label: "Matière sèche", value: r2(base.dry, 4), unit: "kg" },
      { label: "Rapport C/N du mélange", value: r2(base.cn, 3), formula: "Σ m (1 − w) C / Σ m (1 − w) N" },
      { label: "Humidité du mélange", value: r2(100 * base.w, 3), unit: "%", formula: "1 − Σ m (1 − w) / Σ m" }, { label: "Volume en vrac", value: r2(base.vol, 4), unit: "m³" },
    ], ok: base.cn >= cnMin! && base.cn <= cnMax! && base.w >= wMin! && base.w <= wMax! });
    // Ajustement du C/N par la matière choisie (bilan à deux inconnues, résolution directe)
    let used = base, list = feeds;
    const adj = num(input.adjust);
    if (adj != null && adj >= 1 && adj <= feeds.length && (base.cn < cnMin! || base.cn > cnMax!)) {
      const a = feeds[adj - 1];
      const target = base.cn < cnMin! ? cnMin! : cnMax!;
      const others = feeds.filter((_, i) => i !== adj - 1);
      const C0 = others.reduce((s, f) => s + f.m! * (1 - f.w!) * f.c!, 0), N0 = others.reduce((s, f) => s + f.m! * (1 - f.w!) * f.n!, 0);
      const ca = (1 - a.w!) * a.c!, na = (1 - a.w!) * a.n!;
      const denom = ca - target * na;
      const mA = denom !== 0 ? (target * N0 - C0) / denom : NaN;
      if (Number.isFinite(mA) && mA >= 0) {
        list = feeds.map((f, i) => (i === adj - 1 ? { ...f, m: mA } : f));
        used = mix(list);
        res.steps.push({ title: "2. Ajustement du C/N", lines: [{ label: `Masse de « ${a.name} » pour C/N = ${target}`, value: r2(mA, 4), unit: "kg", formula: "(C/N cible × N0 − C0) / (Ca − C/N cible × Na)" }, { label: "C/N obtenu", value: r2(used.cn, 3) }, { label: "Humidité obtenue", value: r2(100 * used.w, 3), unit: "%" }] });
      } else res.warnings.push(`Le C/N visé ne peut pas être atteint en ajustant « ${a.name} » (matière trop ou pas assez carbonée)`);
    }
    if (used.w < wMin!) res.warnings.push(`Humidité ${r2(100 * used.w, 3)} % : ajouter ${r2((used.dry / (1 - wMin!) - used.m), 4)} kg d'eau pour atteindre ${input.w_min} %`);
    if (used.w > wMax!) res.warnings.push(`Humidité ${r2(100 * used.w, 3)} % supérieure à ${input.w_max} % : ajouter une matière sèche structurante`);
    // Installation
    const method = String(input.method || "andains");
    const bom: BomLine[] = [];
    if (method === "bacs") {
      const vb = num(input.bin_volume);
      if (req(res, vb, "volume d'un bac (m³)", { positive: true })) { const nb = Math.ceil(used.vol / vb); res.steps.push({ title: "3. Bacs", lines: [{ label: "Nombre de bacs (phase active)", value: nb, formula: "⌈V / V_bac⌉" }] }); bom.push({ name: "Composteur / bac de compostage", qty: nb, unit: "u", spec: `${vb} m³` }); }
    } else {
      const b = num(input.base), h = num(input.height), aisle = num(input.aisle);
      if (req(res, b, "largeur de base de l'andain (m)", { positive: true }) && req(res, h, "hauteur de l'andain (m)", { positive: true }) && req(res, aisle, "largeur d'allée (m)", { min: 0 })) {
        const section = (b * h) / 2; // section triangulaire
        const len = used.vol / section;
        const area = len * (b + aisle);
        res.steps.push({ title: "3. Andains et plateforme", lines: [{ label: "Section d'un andain (triangulaire)", value: r2(section, 4), unit: "m²", formula: "b × h / 2" }, { label: "Longueur totale d'andain", value: r2(len, 4), unit: "m", formula: "V / section" }, { label: "Surface de plateforme (phase active)", value: r2(area, 4), unit: "m²", formula: "L × (b + allée)" }] });
        if (method === "andains") bom.push({ name: "Retourneur d'andains", qty: 1, unit: "u", spec: `andain ${b} m × ${h} m` });
      }
      if (method === "aere") {
        const ar = num(input.air_rate);
        if (req(res, ar, "débit d'air d'aération (m³/h par tonne)", { positive: true })) {
          const q = (ar * used.m) / 1000;
          res.steps.push({ title: "4. Aération forcée", lines: [{ label: "Débit d'air total", value: r2(q, 4), unit: "m³/h", formula: "débit spécifique × masse (t)" }] });
          bom.push({ name: "Aérateur / ventilateur de compostage", qty: 1, unit: "u", spec: `${r2(q, 4)} m³/h` });
        }
      }
    }
    if (res.missing.length) return finish(res);
    // Calendrier et production
    const turns = Math.floor(act! / turn!);
    const dryOut = used.dry * (1 - loss!);
    const out = dryOut / (1 - wF!);
    res.steps.push({ title: "5. Calendrier et production", lines: [
      { label: "Durée totale", value: act! + mat!, unit: "j" }, { label: "Retournements en phase active", value: turns },
      { label: "Critère d'hygiénisation suivi", value: `≥ ${tHyg} °C pendant ${dHyg} j`, formula: "relevés quotidiens de température à cœur" },
      { label: "Matière sèche finale", value: r2(dryOut, 4), unit: "kg", formula: "MS × (1 − pertes)" }, { label: "Compost mûr estimé", value: r2(out, 4), unit: "kg", formula: "MS finale / (1 − humidité finale)" },
      { label: "Rendement massique", value: r2((100 * out) / used.m, 3), unit: "%" },
    ] });
    bom.push({ name: "Sonde de température de compost", qty: Math.max(1, Math.ceil(used.vol / 20)), unit: "u", spec: `suivi ≥ ${tHyg} °C` }, { name: "Broyeur de biomasse", qty: 1, unit: "u", spec: "préparation des matières structurantes" }, { name: "Capteur de température et d'humidité de l'air", qty: 1, unit: "u", spec: "station de suivi" });
    res.bom = bom;
    res.assumptions.push("Teneurs en carbone et azote, humidités et masses volumiques : données saisies (analyses ou références)", "Andain de section triangulaire", "Perte de matière sèche et humidité finale saisies (suivi ou retour d'expérience)");
    res.summary = [{ label: "C/N du mélange", value: r2(used.cn, 3) }, { label: "Humidité", value: r2(100 * used.w, 3), unit: "%" }, { label: "Compost mûr estimé", value: r2(out, 4), unit: "kg" }];
    return finish(res);
  },
};
