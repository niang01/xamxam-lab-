/**
 * Logiciel « Photovoltaïque » (autonome, raccordé au réseau, hybride) — moteur pur.
 * Site (irradiation mensuelle NASA POWER ou saisie) → irradiation sur le plan des modules → besoins → puissance
 * crête → modules (série/parallèle selon la fiche du régulateur ou de l'onduleur) → batteries → onduleur →
 * câbles DC (chute de tension) → protections → production mensuelle et pertes → schéma, nomenclature, rapport.
 * Toutes les caractéristiques d'équipement viennent des fiches techniques (références de la bibliothèque ou saisie).
 */
import { CONDUCTORS, resistivity } from "@/lib/eng/electrical";
import { MONTH_DAYS, monthlyPoa } from "./solar-geometry";
import { RATINGS } from "./electrical";
import { empty, finish, num, r2, req, rows, type BomLine, type Software, type StudyResult } from "./types";

/** Sections normalisées des conducteurs (CEI 60228), mm². */
export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const pct = (v: number | null) => (v == null ? null : v / 100);
const months = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map(num) : []);
const BATTERY: Record<string, string> = { lifepo4: "Batterie lithium-fer-phosphate", plomb: "Batterie plomb", agm: "Batterie AGM", gel: "Batterie GEL", nmc: "Batterie lithium-ion (NMC)" };

export const PV: Software = {
  key: "photovoltaique", title: "Photovoltaïque : site, besoins, champ, batteries, onduleur, câbles, production", discipline: "solaire", lab: "solar",
  summary: "Dimensionnement complet d'une installation photovoltaïque autonome, hybride ou raccordée au réseau : recherche du lieu, irradiation mensuelle (NASA POWER), plan incliné, besoins, modules et associations série/parallèle, batteries, onduleur, régulateur, câbles, protections, production, pertes, schéma, nomenclature et rapport.",
  sections: [
    {
      title: "1. Site", geo: true, fields: [
        { key: "place", label: "Lieu", type: "text", optional: true },
        { key: "lat", label: "Latitude", unit: "°", type: "number", hint: "Nord positif, sud négatif" },
        { key: "lon", label: "Longitude", unit: "°", type: "number", optional: true },
        { key: "ghi", label: "Irradiation globale horizontale journalière moyenne", unit: "kWh/m²/j", type: "months", hint: "12 mois — bouton « Données NASA POWER » ou mesures du site" },
        { key: "tmean", label: "Température ambiante moyenne", unit: "°C", type: "months", optional: true, hint: "Sinon la température maximale est utilisée pour tous les mois (choix prudent)" },
        { key: "t_min", label: "Température ambiante minimale du site", unit: "°C", type: "number", hint: "Pour la tension à vide maximale (Voc au froid)" },
        { key: "t_max", label: "Température ambiante maximale du site", unit: "°C", type: "number" },
        { key: "albedo", label: "Albédo du sol", unit: "", type: "number", hint: "Réflectivité du sol (relevé ou référence documentée)" },
        { key: "tilt", label: "Inclinaison des modules", unit: "°", type: "number" },
        { key: "azimuth", label: "Azimut des modules", unit: "°", type: "number", hint: "0 = plein sud, −90 = est, +90 = ouest, 180 = nord (hémisphère sud : 180 face à l'équateur)" },
      ],
    },
    {
      title: "2. Besoins énergétiques", fields: [
        { key: "loads", label: "Récepteurs", type: "rows", cols: [
          { key: "name", label: "Récepteur", type: "text" }, { key: "kind", label: "Courant", type: "select", options: [{ v: "ac", l: "Alternatif" }, { v: "dc", l: "Continu" }] },
          { key: "p", label: "Puissance", unit: "W", type: "number" }, { key: "qty", label: "Quantité", type: "int" }, { key: "hours", label: "Durée d'utilisation", unit: "h/j", type: "number" },
        ] },
        { key: "ks", label: "Coefficient de simultanéité (onduleur)", type: "number" },
        { key: "p_surge", label: "Puissance de démarrage la plus forte", unit: "W", type: "number", optional: true, hint: "Moteurs, compresseurs (fiche de l'appareil)" },
      ],
    },
    {
      title: "3. Type d'installation", fields: [
        { key: "system", label: "Type", type: "select", options: [{ v: "autonome", l: "Autonome (batteries)" }, { v: "hybride", l: "Hybride (batteries + réseau)" }, { v: "reseau", l: "Raccordée au réseau (sans stockage)" }] },
        { key: "coverage", label: "Taux de couverture annuel visé (réseau, hybride)", unit: "%", type: "number", optional: true },
      ],
    },
    {
      title: "4. Module photovoltaïque", equipment: [{ label: "Module", names: ["Module photovoltaïque", "Module photovoltaïque monocristallin", "Module photovoltaïque polycristallin", "Module photovoltaïque bifacial"], map: { pmax: "pmax", voc: "voc", vmp: "vmp", isc: "isc", imp: "imp", beta_voc: "beta_voc", gamma_p: "gamma_p", l: "mod_l", w: "mod_w" } }],
      fields: [
        { key: "pmax", label: "Puissance crête Pmax (STC)", unit: "Wc", type: "number" }, { key: "voc", label: "Voc", unit: "V", type: "number" }, { key: "vmp", label: "Vmp", unit: "V", type: "number" },
        { key: "isc", label: "Isc", unit: "A", type: "number" }, { key: "imp", label: "Imp", unit: "A", type: "number" },
        { key: "beta_voc", label: "Coefficient de température de Voc", unit: "%/°C", type: "number" }, { key: "gamma_p", label: "Coefficient de température de Pmax", unit: "%/°C", type: "number" },
        { key: "noct", label: "NOCT (température nominale de cellule)", unit: "°C", type: "number" },
        { key: "mod_l", label: "Longueur du module (maquette 3D)", unit: "mm", type: "number", optional: true }, { key: "mod_w", label: "Largeur du module (maquette 3D)", unit: "mm", type: "number", optional: true },
      ],
    },
    {
      title: "5. Pertes du système", fields: [
        { key: "loss_soiling", label: "Salissures", unit: "%", type: "number" }, { key: "loss_dc", label: "Câblage DC", unit: "%", type: "number" },
        { key: "loss_mismatch", label: "Dispersion des modules", unit: "%", type: "number" }, { key: "loss_other", label: "Autres (ombrages, régulateur…)", unit: "%", type: "number" },
      ],
    },
    {
      title: "6. Batteries (autonome, hybride)", equipment: [{ label: "Batterie", names: Object.values(BATTERY), map: { v: "unit_v", c: "unit_c", dod: "dod" } }],
      fields: [
        { key: "battery_type", label: "Technologie", type: "select", options: [{ v: "lifepo4", l: "LiFePO4" }, { v: "plomb", l: "Plomb ouvert" }, { v: "agm", l: "AGM" }, { v: "gel", l: "GEL" }, { v: "nmc", l: "Lithium NMC" }] },
        { key: "v_sys", label: "Tension du parc", unit: "V", type: "number" }, { key: "days", label: "Jours d'autonomie", type: "number" },
        { key: "dod", label: "Profondeur de décharge admise", unit: "%", type: "number" }, { key: "eta_bat", label: "Rendement de la batterie", unit: "%", type: "number" },
        { key: "unit_v", label: "Tension d'une batterie", unit: "V", type: "number" }, { key: "unit_c", label: "Capacité d'une batterie", unit: "Ah", type: "number" },
      ],
    },
    {
      title: "7. Régulateur / onduleur", equipment: [
        { label: "Régulateur MPPT", names: ["Régulateur de charge MPPT"], map: { v_pv_max: "v_dc_max", i_charge: "reg_i" } },
        { label: "Onduleur", names: ["Onduleur autonome", "Onduleur hybride", "Onduleur réseau / hybride", "Onduleur triphasé"], map: { p_n: "inv_p", eff: "eta_inv", mppt_min: "mppt_min", mppt_max: "mppt_max", v_dc_max: "v_dc_max" } },
      ],
      fields: [
        { key: "eta_inv", label: "Rendement de l'onduleur", unit: "%", type: "number" }, { key: "inv_p", label: "Puissance nominale de l'onduleur", unit: "W", type: "number" },
        { key: "v_dc_max", label: "Tension PV maximale admise (régulateur ou onduleur)", unit: "V", type: "number" },
        { key: "mppt_min", label: "Tension MPPT minimale", unit: "V", type: "number" }, { key: "mppt_max", label: "Tension MPPT maximale", unit: "V", type: "number" },
        { key: "i_in_max", label: "Courant PV maximal par entrée", unit: "A", type: "number" },
        { key: "reg_i", label: "Courant de charge du régulateur", unit: "A", type: "number", optional: true },
      ],
    },
    {
      title: "8. Câbles et protections", fields: [
        { key: "l_pv", label: "Longueur champ → régulateur/onduleur (aller)", unit: "m", type: "number" }, { key: "l_bat", label: "Longueur batteries → onduleur (aller)", unit: "m", type: "number", optional: true },
        { key: "du_dc", label: "Chute de tension DC maximale", unit: "%", type: "number" }, { key: "t_cable", label: "Température de l'âme", unit: "°C", type: "number" },
        { key: "k_isc", label: "Facteur appliqué à Isc pour les protections DC", unit: "", type: "number", hint: "Selon la norme appliquée (ex. CEI 60364-7-712) et la fiche du module" },
      ],
    },
  ],
  example: {
    place: "Exemple : Thiès (Sénégal)", lat: 14.79, lon: -16.93,
    ghi: [5.4, 6.2, 6.8, 7.0, 6.9, 6.4, 5.7, 5.4, 5.5, 5.6, 5.4, 5.0], tmean: [23, 25, 27, 28, 29, 29, 28, 27, 28, 28, 27, 24], t_min: 14, t_max: 40, albedo: 0.2, tilt: 15, azimuth: 0,
    loads: [{ name: "Éclairage LED", kind: "ac", p: 10, qty: 8, hours: 5 }, { name: "Réfrigérateur", kind: "ac", p: 120, qty: 1, hours: 10 }, { name: "Télévision", kind: "ac", p: 80, qty: 1, hours: 4 }, { name: "Ventilateur", kind: "ac", p: 60, qty: 2, hours: 6 }],
    ks: 0.8, p_surge: 600, system: "autonome",
    pmax: 450, voc: 49.5, vmp: 41.2, isc: 11.5, imp: 10.9, beta_voc: -0.28, gamma_p: -0.36, noct: 45, mod_l: 1903, mod_w: 1134,
    loss_soiling: 3, loss_dc: 2, loss_mismatch: 2, loss_other: 3,
    battery_type: "lifepo4", v_sys: 24, days: 2, dod: 80, eta_bat: 95, unit_v: 12.8, unit_c: 100,
    eta_inv: 92, inv_p: 1500, v_dc_max: 150, mppt_min: 30, mppt_max: 145, i_in_max: 40, reg_i: 60,
    l_pv: 12, l_bat: 2, du_dc: 3, t_cable: 70, k_isc: 1.25,
  },
  run: (input): StudyResult => {
    const res = empty();
    const lat = num(input.lat), ghi = months(input.ghi), tmeanIn = months(input.tmean);
    const tMin = num(input.t_min), tMax = num(input.t_max), albedo = num(input.albedo), tilt = num(input.tilt), az = num(input.azimuth);
    req(res, lat, "latitude", { min: -66, max: 66 });
    if (ghi.length !== 12 || ghi.some((x) => x == null || x < 0)) res.missing.push("irradiation globale horizontale des 12 mois (kWh/m²/j)");
    req(res, tMin, "température minimale du site (°C)"); req(res, tMax, "température maximale du site (°C)");
    req(res, albedo, "albédo du sol", { min: 0, max: 1 }); req(res, tilt, "inclinaison (°)", { min: 0, max: 90 }); req(res, az, "azimut (°)", { min: -180, max: 180 });
    const system = input.system === "reseau" ? "reseau" : input.system === "hybride" ? "hybride" : "autonome";
    const storage = system !== "reseau";
    const loads = rows(input.loads);
    if (!loads.length) res.missing.push("au moins un récepteur");
    let eAc = 0, eDc = 0, pAc = 0;
    loads.forEach((l, i) => {
      const n = String(l.name || `Récepteur ${i + 1}`), p = num(l.p), q = num(l.qty), h = num(l.hours);
      if (!req(res, p, `${n} : puissance (W)`, { min: 0 }) || !req(res, q, `${n} : quantité`, { min: 0 }) || !req(res, h, `${n} : durée (h/j)`, { min: 0, max: 24 })) return;
      if (l.kind === "dc") eDc += p * q * h; else { eAc += p * q * h; pAc += p * q; }
    });
    const ks = num(input.ks); if (pAc > 0) req(res, ks, "coefficient de simultanéité", { positive: true, max: 1 });
    const pmax = num(input.pmax), voc = num(input.voc), vmp = num(input.vmp), isc = num(input.isc), imp = num(input.imp), beta = num(input.beta_voc), gamma = num(input.gamma_p), noct = num(input.noct);
    for (const [v, n] of [[pmax, "Pmax du module (Wc)"], [voc, "Voc du module (V)"], [vmp, "Vmp du module (V)"], [isc, "Isc du module (A)"], [imp, "Imp du module (A)"], [noct, "NOCT du module (°C)"]] as const) req(res, v, n, { positive: true });
    req(res, beta, "coefficient de température de Voc (%/°C)"); req(res, gamma, "coefficient de température de Pmax (%/°C)");
    const losses = [["loss_soiling", "pertes par salissures (%)"], ["loss_dc", "pertes du câblage DC (%)"], ["loss_mismatch", "pertes de dispersion (%)"], ["loss_other", "autres pertes (%)"]].map(([k, n]) => { const v = num(input[k]); req(res, v, n, { min: 0, max: 50 }); return pct(v) ?? 0; });
    const etaInv = pct(num(input.eta_inv)); req(res, num(input.eta_inv), "rendement de l'onduleur (%)", { positive: true, max: 100 });
    const vDcMax = num(input.v_dc_max), mpptMin = num(input.mppt_min), mpptMax = num(input.mppt_max), iIn = num(input.i_in_max), invP = num(input.inv_p);
    req(res, vDcMax, "tension PV maximale admise (V)", { positive: true }); req(res, mpptMin, "tension MPPT minimale (V)", { positive: true }); req(res, mpptMax, "tension MPPT maximale (V)", { positive: true }); req(res, iIn, "courant PV maximal par entrée (A)", { positive: true });
    if (pAc > 0) req(res, invP, "puissance nominale de l'onduleur (W)", { positive: true });
    const vSys = num(input.v_sys), days = num(input.days), dod = pct(num(input.dod)), etaBat = pct(num(input.eta_bat)), unitV = num(input.unit_v), unitC = num(input.unit_c);
    if (storage) { req(res, vSys, "tension du parc de batteries (V)", { positive: true }); req(res, days, "jours d'autonomie", { positive: true }); req(res, num(input.dod), "profondeur de décharge (%)", { positive: true, max: 100 }); req(res, num(input.eta_bat), "rendement de la batterie (%)", { positive: true, max: 100 }); req(res, unitV, "tension d'une batterie (V)", { positive: true }); req(res, unitC, "capacité d'une batterie (Ah)", { positive: true }); }
    const coverage = pct(num(input.coverage));
    if (system !== "autonome") req(res, num(input.coverage), "taux de couverture annuel visé (%)", { positive: true, max: 200 });
    const lPv = num(input.l_pv), lBat = num(input.l_bat), duDc = num(input.du_dc), tCable = num(input.t_cable), kIsc = num(input.k_isc);
    req(res, lPv, "longueur du câble PV (m)", { positive: true }); req(res, duDc, "chute de tension DC maximale (%)", { positive: true, max: 10 }); req(res, tCable, "température de l'âme des câbles (°C)"); req(res, kIsc, "facteur appliqué à Isc pour les protections", { min: 1, max: 3 });
    if (storage) req(res, lBat, "longueur du câble batteries (m)", { positive: true });
    if (res.missing.length) return finish(res);

    // --- Irradiation sur le plan des modules
    const geo = monthlyPoa({ lat: lat!, ghi: ghi as number[], tilt: tilt!, azimuth: az!, albedo: albedo! });
    res.warnings.push(...geo.warnings);
    res.steps.push({ title: "1. Irradiation sur le plan des modules (modèle isotrope)", lines: geo.months.map((m) => ({ label: `Mois ${m.month}`, value: r2(m.poa, 3), unit: "kWh/m²/j", formula: `H = ${m.h} ; KT = ${r2(m.kt, 2)} ; Hd = ${r2(m.hd, 2)} ; Rb = ${r2(m.rb, 3)}` })) });
    res.references.push("Duffie & Beckman, Solar Engineering of Thermal Processes : déclinaison de Cooper, jours moyens de Klein, H0 (Gsc = 1367 W/m²), corrélation mensuelle d'Erbs (1982), modèle isotrope de Liu-Jordan");
    res.assumptions.push("Irradiation horizontale mensuelle : donnée de l'utilisateur (NASA POWER = données modélisées à échelle régionale, à confirmer par des mesures locales si possible)", "Modèle mensuel isotrope : estimation ; le calcul horaire pvlib du Solar Energy Lab est plus précis");

    // --- Besoins
    const tmean = tmeanIn.length === 12 && tmeanIn.every((x) => x != null) ? tmeanIn as number[] : Array(12).fill(tMax!);
    if (!(tmeanIn.length === 12 && tmeanIn.every((x) => x != null))) res.assumptions.push("Température mensuelle non fournie : température maximale du site retenue pour tous les mois (choix prudent)");
    const eBatOut = eAc / etaInv! + eDc; // énergie sortie batterie (Wh/j)
    const eField = storage ? eBatOut / etaBat! : eAc / etaInv! + eDc;
    res.steps.push({ title: "2. Besoins énergétiques", lines: [
      { label: "Consommation alternative", value: r2(eAc, 4), unit: "Wh/j", formula: "Σ P × n × durée" }, { label: "Consommation continue", value: r2(eDc, 4), unit: "Wh/j" },
      { label: "Puissance alternative installée", value: r2(pAc, 4), unit: "W" },
      { label: "Énergie à produire par le champ", value: r2(eField, 4), unit: "Wh/j", formula: storage ? "(E_AC / η_ond + E_DC) / η_bat" : "E_AC / η_ond + E_DC" },
    ] });

    // --- Ratio de performance mensuel
    const kLoss = losses.reduce((a, l) => a * (1 - l), 1);
    const pr = tmean.map((t) => (1 + (gamma! / 100) * (t + noct! - 20 - 25)) * kLoss);
    res.steps.push({ title: "3. Ratio de performance mensuel", lines: pr.map((x, m) => ({ label: `Mois ${m + 1}`, value: r2(x, 3), formula: `(1 + γ (Tc − 25)) × Π(1 − pertes) ; Tc = ${tmean[m]} + NOCT − 20 = ${r2(tmean[m] + noct! - 20, 3)} °C` })) });
    res.assumptions.push("Température de cellule : Tc = Ta + (NOCT − 20) (conditions NOCT, 800 W/m²) — approximation");

    // --- Puissance crête
    let pc: number, critical = 0;
    if (system === "autonome") {
      const need = geo.months.map((m, i) => eField / (m.poa * pr[i]));
      pc = Math.max(...need); critical = need.indexOf(pc) + 1;
    } else {
      const yearPerKw = geo.months.reduce((a, m, i) => a + m.poa * pr[i] * MONTH_DAYS[i], 0);
      pc = (eField * 365 * coverage!) / yearPerKw;
    }
    const nNeeded = Math.ceil(pc / pmax!);
    // --- Associations série / parallèle
    const vocCold = voc! * (1 + (beta! / 100) * (tMin! - 25));
    const tCellHot = tMax! + (noct! - 20) * 1000 / 800;
    const vmpHot = vmp! * (1 + (gamma! / 100) * (tCellHot - 25));
    const vmpCold = vmp! * (1 + (gamma! / 100) * (tMin! - 25));
    const nsMax = Math.min(Math.floor(vDcMax! / vocCold), Math.floor(mpptMax! / vmpCold));
    const nsMin = Math.max(1, Math.ceil(mpptMin! / vmpHot));
    const npMaxPerInput = Math.max(0, Math.floor(iIn! / isc!));
    res.steps.push({ title: "4. Champ photovoltaïque", lines: [
      { label: "Puissance crête nécessaire", value: r2(pc, 4), unit: "Wc", formula: system === "autonome" ? `max(E / (H_T × PR)) — mois critique : ${critical}` : `E × 365 × couverture / Σ(H_T × PR × jours)` },
      { label: "Modules nécessaires", value: nNeeded, formula: "⌈Pc / Pmax⌉" },
      { label: "Voc d'un module à Tmin", value: r2(vocCold, 4), unit: "V", formula: "Voc (1 + β (Tmin − 25))" },
      { label: "Vmp d'un module à chaud", value: r2(vmpHot, 4), unit: "V", formula: `Tc = Tmax + (NOCT − 20) × 1000/800 = ${r2(tCellHot, 3)} °C` },
      { label: "Modules en série : minimum / maximum", value: `${nsMin} / ${nsMax}`, formula: "⌈V_MPPT,min / Vmp(chaud)⌉ ; min(⌊V_max / Voc(froid)⌋, ⌊V_MPPT,max / Vmp(froid)⌋)" },
      { label: "Chaînes en parallèle par entrée (maximum)", value: npMaxPerInput, formula: "⌊I_entrée,max / Isc⌋" },
    ] });
    if (nsMin > nsMax || npMaxPerInput < 1) { res.warnings.push("Aucune association série/parallèle ne respecte la fiche du régulateur/onduleur : choisir un autre équipement"); res.steps[res.steps.length - 1].ok = false; return finish(res); }
    let best: { ns: number; np: number; inputs: number } | null = null;
    for (let ns = nsMax; ns >= nsMin; ns--) {
      const np = Math.ceil(nNeeded / ns), inputs = Math.ceil(np / npMaxPerInput), total = ns * np;
      if (!best || inputs < best.inputs || (inputs === best.inputs && total < best.ns * best.np)) best = { ns, np, inputs };
    }
    const { ns, np, inputs } = best!;
    const nMod = ns * np, pcInst = nMod * pmax!;
    res.steps.push({ title: "5. Association retenue", lines: [
      { label: "Modules en série", value: ns }, { label: "Chaînes en parallèle", value: np }, { label: "Entrées MPPT (régulateurs ou trackers)", value: inputs, formula: "⌈Np / Np,max⌉" },
      { label: "Nombre de modules", value: nMod }, { label: "Puissance crête installée", value: r2(pcInst, 4), unit: "Wc" },
      { label: "Tension de chaîne Voc à froid", value: r2(ns * vocCold, 4), unit: "V", formula: `≤ ${vDcMax} V` },
      { label: "Tension de chaîne Vmp à chaud", value: r2(ns * vmpHot, 4), unit: "V", formula: `≥ ${mpptMin} V` },
    ] });

    // --- Batteries
    const bom: BomLine[] = [];
    let iBat = 0;
    if (storage) {
      const wh = (eBatOut * days!) / (dod! * etaBat!);
      const ah = wh / vSys!;
      const nSeries = vSys! / unitV!;
      const nSer = Math.round(nSeries);
      if (Math.abs(nSeries - nSer) > 0.12 * nSer || nSer < 1) res.warnings.push(`Tension du parc ${vSys} V non multiple de la tension d'une batterie ${unitV} V`);
      const nPar = Math.ceil(ah / unitC!);
      res.steps.push({ title: "6. Parc de batteries", lines: [
        { label: "Énergie stockée nécessaire", value: r2(wh, 4), unit: "Wh", formula: "E_sortie × jours / (DoD × η_bat)" },
        { label: "Capacité nécessaire", value: r2(ah, 4), unit: "Ah", formula: `Wh / ${vSys} V` },
        { label: "Batteries en série × en parallèle", value: `${Math.max(1, nSer)} × ${nPar}` },
        { label: "Capacité installée", value: nPar * unitC!, unit: "Ah" },
      ] });
      bom.push({ name: BATTERY[String(input.battery_type)] ?? "Batterie lithium-fer-phosphate", qty: Math.max(1, nSer) * nPar, unit: "u", spec: `${unitV} V ${unitC} Ah — ${Math.max(1, nSer)} en série × ${nPar} en parallèle` });
      if (String(input.battery_type) !== "plomb") bom.push({ name: "Système de gestion de batterie (BMS)", qty: 1, unit: "u", spec: "si non intégré aux batteries" });
      const regI = num(input.reg_i);
      const iCharge = pcInst / vSys!;
      if (regI != null) {
        const ok = regI * inputs >= iCharge;
        res.steps.push({ title: "7. Régulateur de charge", lines: [{ label: "Courant de charge maximal", value: r2(iCharge, 4), unit: "A", formula: "Pc installée / V_parc" }, { label: "Capacité des régulateurs", value: regI * inputs, unit: "A", formula: `${inputs} × ${regI} A` }], ok });
        if (!ok) res.warnings.push("Courant de charge supérieur à la capacité des régulateurs : augmenter le nombre ou le calibre");
      } else res.missing.push("courant de charge du régulateur (A) — fiche du régulateur");
      bom.push({ name: "Régulateur de charge MPPT", qty: inputs, unit: "u", spec: `${vSys} V, ≥ ${r2(iCharge / inputs, 3)} A, entrée PV ≤ ${vDcMax} V` });
      iBat = invP ? invP / (vSys! * etaInv!) : 0;
    }
    // --- Onduleur
    if (pAc > 0) {
      const pReq = ks! * pAc;
      const ok = invP! >= pReq;
      res.steps.push({ title: "8. Onduleur", lines: [{ label: "Puissance appelée", value: r2(pReq, 4), unit: "W", formula: "ks × Σ P_AC" }, { label: "Puissance nominale choisie", value: invP!, unit: "W" }, ...(num(input.p_surge) != null ? [{ label: "Pointe de démarrage à couvrir", value: num(input.p_surge)!, unit: "W", formula: "à comparer à la puissance crête de l'onduleur (fiche)" }] : [])], ok });
      if (!ok) res.warnings.push("Onduleur sous-dimensionné");
      bom.push({ name: system === "autonome" ? "Onduleur autonome" : system === "hybride" ? "Onduleur hybride" : "Onduleur réseau / hybride", qty: 1, unit: "u", spec: `≥ ${r2(pReq, 4)} W ; retenu ${invP} W` });
    }
    // --- Câbles DC
    const rho = resistivity("copper", tCable!);
    const sec = (i: number, l: number, v: number) => { const s = (2 * rho * l * i) / ((duDc! / 100) * v); return { s, pick: SECTIONS.find((x) => x >= s) ?? null }; };
    const iField = Math.min(np, npMaxPerInput) * imp!;
    const cPv = sec(iField, lPv!, ns * vmp!);
    const lines = [{ label: "Câble champ : section minimale", value: r2(cPv.s, 3), unit: "mm²", formula: `S = 2 ρθ L I / (ΔU × V) ; I = ${r2(iField, 3)} A ; V = ${r2(ns * vmp!, 4)} V` }, { label: "Câble champ : section normalisée", value: cPv.pick ?? "hors gamme", unit: cPv.pick ? "mm²" : "" }];
    if (storage && iBat > 0) { const cB = sec(iBat, lBat!, vSys!); lines.push({ label: "Câble batteries : section minimale", value: r2(cB.s, 3), unit: "mm²", formula: `I = P_ond / (V × η) = ${r2(iBat, 3)} A` }, { label: "Câble batteries : section normalisée", value: cB.pick ?? "hors gamme", unit: cB.pick ? "mm²" : "" }); bom.push({ name: "Câble électrique", qty: r2(2 * lBat!, 3), unit: "m", spec: `${cB.pick ?? "?"} mm² (batteries ↔ onduleur)` }); }
    res.steps.push({ title: "9. Câbles DC (chute de tension)", lines });
    res.warnings.push("Sections déterminées par la chute de tension : vérifier aussi le courant admissible (tableau normatif) et la tenue en court-circuit");
    res.references.push(CONDUCTORS.copper.ref, "Sections normalisées : CEI 60228");
    // --- Protections
    const iProt = kIsc! * isc!;
    const fuse = RATINGS.find((x) => x >= iProt) ?? null;
    res.steps.push({ title: "10. Protections DC", lines: [
      { label: "Courant de dimensionnement d'une chaîne", value: r2(iProt, 3), unit: "A", formula: `${kIsc} × Isc` },
      { label: "Calibre normalisé immédiatement supérieur", value: fuse ?? "hors gamme", unit: fuse ? "A" : "", formula: "à confirmer : ≤ courant inverse maximal du module (fiche) et règles de la norme appliquée" },
      ...(storage && iBat > 0 ? [{ label: "Protection batterie", value: RATINGS.find((x) => x >= kIsc! * iBat) ?? "hors gamme", unit: "A", formula: `≥ ${kIsc} × I_batterie` }] : []),
    ] });
    // --- Production
    const prod = geo.months.map((m, i) => (pcInst / 1000) * m.poa * pr[i] * MONTH_DAYS[i]);
    const year = prod.reduce((a, b) => a + b, 0);
    const needMonth = MONTH_DAYS.map((d) => (eField / 1000) * d);
    res.steps.push({ title: "11. Production estimée (sortie champ DC)", lines: [...prod.map((e, i) => ({ label: `Mois ${i + 1}`, value: r2(e, 4), unit: "kWh", formula: `couverture ${r2((100 * e) / needMonth[i], 3)} %` })), { label: "Production annuelle", value: r2(year, 4), unit: "kWh/an" }, { label: "Productible spécifique", value: r2(year / (pcInst / 1000), 4), unit: "kWh/kWc/an" }] });
    const lossLines = [["Température (moyenne annuelle)", 1 - pr.reduce((a, x) => a + x, 0) / 12 / kLoss], ["Salissures", losses[0]], ["Câblage DC", losses[1]], ["Dispersion", losses[2]], ["Autres", losses[3]]] as [string, number][];
    res.steps.push({ title: "12. Analyse des pertes", lines: [...lossLines.map(([l, v]) => ({ label: l, value: r2(100 * v, 3), unit: "%" })), { label: "Ratio de performance moyen", value: r2(pr.reduce((a, x) => a + x, 0) / 12, 3) }, ...(storage ? [{ label: "Rendement batterie", value: r2(100 * etaBat!, 3), unit: "%" }] : []), ...(pAc > 0 ? [{ label: "Rendement onduleur", value: r2(100 * etaInv!, 3), unit: "%" }] : [])] });
    // --- Nomenclature, schéma, synthèse
    bom.unshift({ name: "Module photovoltaïque", qty: nMod, unit: "u", spec: `${pmax} Wc — ${ns} en série × ${np} en parallèle` });
    bom.push({ name: "Câble solaire", qty: r2(2 * lPv! * Math.max(1, inputs), 3), unit: "m", spec: `${cPv.pick ?? "?"} mm²` });
    bom.push({ name: "Connecteurs MC4", qty: 2 * np, unit: "paires", spec: "même fabricant aux deux extrémités" });
    if (np >= 2) bom.push({ name: "Fusible gPV", qty: 2 * np, unit: "u", spec: `${fuse ?? "?"} A (à confirmer)` });
    bom.push({ name: "Coffret de protection DC", qty: Math.max(1, inputs), unit: "u", spec: `${np} chaîne(s), ${r2(ns * vocCold, 4)} V max` });
    bom.push({ name: "Parafoudre DC photovoltaïque", qty: Math.max(1, inputs), unit: "u", spec: `Ucpv ≥ ${r2(ns * vocCold, 4)} V` });
    if (storage) bom.push({ name: "Disjoncteur DC", qty: 1, unit: "u", spec: `batterie, ${RATINGS.find((x) => x >= kIsc! * iBat) ?? "?"} A, ${vSys} V DC` });
    bom.push({ name: "Structure de support PV", qty: 1, unit: "u", spec: `${nMod} modules, inclinaison ${tilt}°, azimut ${az}°` });
    res.bom = bom;
    res.summary = [{ label: "Puissance crête installée", value: r2(pcInst / 1000, 3), unit: "kWc" }, { label: "Modules", value: `${nMod} (${ns} × ${np})` }, { label: "Production annuelle estimée", value: r2(year, 4), unit: "kWh" }];
    res.diagram = storage ? { kind: "unifilaire_pv", params: { strings: Math.min(8, np), modules: Math.min(30, ns) } } : null;
    if (!storage) res.warnings.push("Schéma d'une installation raccordée au réseau : à composer dans l'éditeur 2D (le générateur automatique couvre les installations avec batteries)");
    if (storage && np > 8) res.warnings.push("Schéma généré limité à 8 chaînes (représentation)");
    return finish(res);
  },
};
