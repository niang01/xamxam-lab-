/**
 * Logiciels : génie civil (poutre, descente de charges, semelle), bâtiment (déperditions, apports, éclairage),
 * froid (bilan frigorifique d'une chambre froide), plomberie (débits, diamètres, pression, eau chaude), robotique
 * (motorisation d'un robot mobile), drones (poussée, autonomie), agriculture intelligente (irrigation goutte-à-goutte,
 * ET0 de Hargreaves), domotique (économies d'énergie), environnement (bilan carbone).
 * Coefficients normatifs (pondérations, flèches limites, coefficients de simultanéité, Kc, facteurs d'émission…)
 * SAISIS par l'utilisateur : jamais supposés.
 */
import { G, RHO, pipeLoss, waterNu } from "./hydraulics";
import { CP_WATER, enthalpy, humidityRatio, airDensity } from "./thermo";
import { h0Daily, MEAN_DAYS } from "./solar-geometry";
import { empty, finish, grab, nf, num, r2, req, rows, type Software, type StudyResult } from "./types";

export const CIVIL: Software = {
  key: "genie-civil", title: "Génie civil : poutre sur deux appuis, descente de charges, semelle", discipline: "genie_civil", lab: "mechanical",
  summary: "Poutre isostatique (charge répartie et charge ponctuelle) : réactions, moment maximal, effort tranchant, contrainte de flexion et flèche ; descente de charges d'un poteau et surface de semelle. Les coefficients de pondération et limites sont ceux de la norme appliquée (saisis).",
  sections: [
    { title: "1. Poutre", fields: [nf("L", "Portée", "m"), nf("g", "Charge permanente répartie G", "kN/m"), nf("q", "Charge d'exploitation répartie Q", "kN/m"), nf("P", "Charge ponctuelle (ELU déjà pondérée ou 0)", "kN"), nf("a", "Position de la charge ponctuelle depuis l'appui gauche", "m"), nf("gG", "Coefficient de pondération γG (norme)", ""), nf("gQ", "Coefficient de pondération γQ (norme)", ""), nf("b", "Largeur de section", "cm"), nf("h", "Hauteur de section", "cm"), nf("E", "Module d'élasticité (matériau)", "MPa"), nf("sigma_adm", "Contrainte de flexion admissible (matériau, norme)", "MPa"), nf("lim", "Flèche limite L/…", "", { hint: "ex. 250 — selon la norme et l'usage" })] },
    { title: "2. Descente de charges sur un poteau", fields: [{ key: "floors", label: "Niveaux", type: "rows", cols: [{ key: "name", label: "Niveau", type: "text" }, { key: "area", label: "Surface d'influence", unit: "m²", type: "number" }, { key: "G", label: "G", unit: "kN/m²", type: "number" }, { key: "Q", label: "Q", unit: "kN/m²", type: "number" }] }, nf("q_soil", "Contrainte admissible du sol (étude de sol)", "kPa")] },
  ],
  example: { L: 5, g: 12, q: 6, P: 0, a: 2.5, gG: 1.35, gQ: 1.5, b: 20, h: 40, E: 30000, sigma_adm: 12, lim: 250, floors: [{ name: "Toiture", area: 16, G: 5, Q: 1 }, { name: "Étage", area: 16, G: 6, Q: 2.5 }], q_soil: 200 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { L: ["portée (m)", { positive: true }], g: ["charge G (kN/m)", { min: 0 }], q: ["charge Q (kN/m)", { min: 0 }], P: ["charge ponctuelle (kN)", { min: 0 }], a: ["position de la charge ponctuelle (m)", { min: 0 }], gG: ["coefficient γG", { min: 1, max: 2 }], gQ: ["coefficient γQ", { min: 1, max: 2 }], b: ["largeur (cm)", { positive: true }], h: ["hauteur (cm)", { positive: true }], E: ["module d'élasticité (MPa)", { positive: true }], sigma_adm: ["contrainte admissible (MPa)", { positive: true }], lim: ["flèche limite L/…", { positive: true }], q_soil: ["contrainte admissible du sol (kPa)", { positive: true }] });
    if (!res.missing.length && v.a > v.L) res.missing.push("position de la charge ponctuelle dans la portée");
    if (res.missing.length) return finish(res);
    const qu = v.gG * v.g + v.gQ * v.q, qs = v.g + v.q, bb = v.L - v.a;
    const Mq = (qu * v.L ** 2) / 8, MP = (v.P * v.a * bb) / v.L, M = Mq + MP; // borne supérieure (maxima non nécessairement au même point)
    const Ra = (qu * v.L) / 2 + (v.P * bb) / v.L, Rb = (qu * v.L) / 2 + (v.P * v.a) / v.L;
    const I = ((v.b / 100) * (v.h / 100) ** 3) / 12, W = I / ((v.h / 100) / 2), sigma = (M * 1e3) / W / 1e6;
    const E = v.E * 1e6, fq = (5 * qs * 1e3 * v.L ** 4) / (384 * E * I);
    const bp = Math.min(v.a, bb), fP = v.P > 0 ? (v.P * 1e3 * bp * (3 * v.L ** 2 - 4 * bp ** 2)) / (48 * E * I) : 0;
    const f = (fq + fP) * 1000, fLim = (v.L * 1000) / v.lim;
    res.steps.push({ title: "1. Poutre sur deux appuis", ok: sigma <= v.sigma_adm && f <= fLim, lines: [
      { label: "Charge répartie pondérée", value: r2(qu, 4), unit: "kN/m", formula: "γG G + γQ Q" }, { label: "Réactions d'appui A / B", value: `${r2(Ra, 4)} / ${r2(Rb, 4)}`, unit: "kN" },
      { label: "Moment maximal (enveloppe)", value: r2(M, 4), unit: "kN·m", formula: "q L²/8 + P a b / L" }, { label: "Effort tranchant maximal", value: r2(Math.max(Ra, Rb), 4), unit: "kN" },
      { label: "Moment d'inertie", value: r2(I * 1e8, 4), unit: "cm⁴", formula: "b h³ / 12" }, { label: "Contrainte de flexion", value: r2(sigma, 4), unit: "MPa", formula: "M / W, W = I / (h/2)" },
      { label: "Flèche (service, G + Q non pondérés)", value: r2(f, 4), unit: "mm", formula: "5 q L⁴ / (384 E I) + P b (3L² − 4b²) / (48 E I)" }, { label: "Flèche limite", value: r2(fLim, 4), unit: "mm", formula: `L / ${v.lim}` },
    ] });
    if (sigma > v.sigma_adm) res.warnings.push("Contrainte de flexion supérieure à l'admissible : section à augmenter");
    if (f > fLim) res.warnings.push("Flèche supérieure à la limite");
    res.warnings.push("Béton armé : le ferraillage se calcule selon la norme de calcul (ex. Eurocode 2) — non réalisé ici ; faire valider par un bureau d'études");
    let nG = 0, nQ = 0;
    const fl = rows(input.floors);
    for (const x of fl) { const A = num(x.area), g2 = num(x.G), q2 = num(x.Q); if (req(res, A, `${x.name || "niveau"} : surface`, { positive: true }) && req(res, g2, `${x.name || "niveau"} : G`, { min: 0 }) && req(res, q2, `${x.name || "niveau"} : Q`, { min: 0 })) { nG += A * g2; nQ += A * q2; } }
    if (res.missing.length) return finish(res);
    if (fl.length) {
      const nSer = nG + nQ, nU = v.gG * nG + v.gQ * nQ, area = nSer / v.q_soil;
      res.steps.push({ title: "2. Descente de charges et semelle", lines: [{ label: "Charge permanente cumulée", value: r2(nG, 4), unit: "kN" }, { label: "Charge d'exploitation cumulée", value: r2(nQ, 4), unit: "kN" }, { label: "Effort de service N_ser", value: r2(nSer, 4), unit: "kN" }, { label: "Effort ultime N_u", value: r2(nU, 4), unit: "kN" }, { label: "Surface de semelle", value: r2(area, 4), unit: "m²", formula: "N_ser / σ_sol (poids propre de la semelle à ajouter)" }, { label: "Côté d'une semelle carrée", value: r2(Math.sqrt(area), 3), unit: "m" }] });
      res.bom = [{ name: "Poutre en béton armé", qty: 1, unit: "u", spec: `${v.b} × ${v.h} cm, portée ${v.L} m` }, { name: "Poteau en béton armé", qty: 1, unit: "u", spec: `N_u = ${r2(nU, 3)} kN` }, { name: "Semelle isolée", qty: 1, unit: "u", spec: `${r2(Math.sqrt(area), 3)} × ${r2(Math.sqrt(area), 3)} m minimum` }];
    }
    res.summary = [{ label: "Moment maximal", value: r2(M, 4), unit: "kN·m" }, { label: "Flèche", value: r2(f, 3), unit: "mm" }];
    return finish(res);
  },
};

export const BUILDING: Software = {
  key: "batiment", title: "Bâtiment : déperditions, puissance de chauffage ou de climatisation, éclairage", discipline: "genie_civil", lab: "refrigeration",
  summary: "Déperditions par les parois (U × A) et par le renouvellement d'air, apports internes et solaires, puissance de climatisation ou de chauffage ; nombre de luminaires par la méthode des flux.",
  sections: [
    { title: "1. Parois", fields: [{ key: "walls", label: "Parois", type: "rows", cols: [{ key: "name", label: "Paroi", type: "text" }, { key: "area", label: "Surface", unit: "m²", type: "number" }, { key: "u", label: "U", unit: "W/(m²·K)", type: "number" }] }, nf("t_in", "Température intérieure de consigne", "°C"), nf("t_out", "Température extérieure de base", "°C"), nf("vent", "Débit d'air neuf", "m³/h")] },
    { title: "2. Apports (climatisation)", fields: [nf("people", "Occupants", ""), nf("w_person", "Apport par occupant (référence)", "W"), nf("lighting", "Éclairage", "W"), nf("equip", "Équipements", "W"), { key: "windows", label: "Vitrages", type: "rows", cols: [{ key: "name", label: "Vitrage", type: "text" }, { key: "area", label: "Surface", unit: "m²", type: "number" }, { key: "g", label: "Facteur solaire g", type: "number" }, { key: "irr", label: "Éclairement incident", unit: "W/m²", type: "number" }] }] },
    { title: "3. Éclairage", fields: [nf("room_area", "Surface du local", "m²"), nf("lux", "Éclairement à maintenir (norme)", "lx"), nf("flux", "Flux d'un luminaire (fiche)", "lm"), nf("uf", "Facteur d'utilance", ""), nf("mf", "Facteur de maintenance", "")] },
  ],
  example: { walls: [{ name: "Murs", area: 80, u: 2.2 }, { name: "Toiture", area: 50, u: 0.8 }, { name: "Plancher", area: 50, u: 1.5 }], t_in: 25, t_out: 38, vent: 300, people: 8, w_person: 120, lighting: 400, equip: 1200, windows: [{ name: "Ouest", area: 6, g: 0.6, irr: 500 }], room_area: 50, lux: 500, flux: 3600, uf: 0.6, mf: 0.8 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { t_in: ["température intérieure (°C)"], t_out: ["température extérieure (°C)"], vent: ["débit d'air neuf (m³/h)", { min: 0 }], people: ["occupants", { min: 0 }], w_person: ["apport par occupant (W)", { min: 0 }], lighting: ["éclairage (W)", { min: 0 }], equip: ["équipements (W)", { min: 0 }], room_area: ["surface du local (m²)", { positive: true }], lux: ["éclairement (lx)", { positive: true }], flux: ["flux d'un luminaire (lm)", { positive: true }], uf: ["facteur d'utilance", { positive: true, max: 1.5 }], mf: ["facteur de maintenance", { positive: true, max: 1 }] });
    let ua = 0;
    for (const w of rows(input.walls)) { const A = num(w.area), U = num(w.u); if (req(res, A, `${w.name || "paroi"} : surface`, { positive: true }) && req(res, U, `${w.name || "paroi"} : U`, { min: 0 })) ua += A * U; }
    if (res.missing.length) return finish(res);
    const dT = v.t_out - v.t_in, cool = dT > 0;
    const rhoCp = (airDensity(20, 0) * 1005) / 3600; // Wh/(m³·K)
    const hv = rhoCp * v.vent, phiWalls = ua * Math.abs(dT), phiVent = hv * Math.abs(dT);
    let solar = 0;
    for (const w of rows(input.windows)) { const A = num(w.area), g = num(w.g), I = num(w.irr); if (req(res, A, `${w.name || "vitrage"} : surface`, { min: 0 }) && req(res, g, `${w.name || "vitrage"} : facteur solaire`, { min: 0, max: 1 }) && req(res, I, `${w.name || "vitrage"} : éclairement`, { min: 0 })) solar += A * g * I; }
    if (res.missing.length) return finish(res);
    const internal = v.people * v.w_person + v.lighting + v.equip;
    const total = cool ? phiWalls + phiVent + internal + solar : phiWalls + phiVent;
    res.steps.push({ title: `1. Bilan ${cool ? "de climatisation" : "de chauffage"}`, lines: [{ label: "Σ U × A", value: r2(ua, 4), unit: "W/K" }, { label: "Parois", value: r2(phiWalls, 4), unit: "W" }, { label: "Renouvellement d'air", value: r2(phiVent, 4), unit: "W", formula: `ρ cp ≈ ${r2(rhoCp, 3)} Wh/(m³·K) × débit × ΔT` }, ...(cool ? [{ label: "Apports internes", value: r2(internal, 4), unit: "W" }, { label: "Apports solaires", value: r2(solar, 4), unit: "W", formula: "Σ A × g × I" }] : []), { label: `Puissance ${cool ? "frigorifique" : "de chauffage"} nécessaire`, value: r2(total / 1000, 4), unit: "kW" }] });
    res.assumptions.push("Régime permanent (pas d'inertie), chaleur latente de l'air neuf et des occupants non comptée : à ajouter pour la climatisation", cool ? "Apports internes comptés en climatisation seulement" : "Apports internes non déduits en chauffage (choix prudent)");
    const n = Math.ceil((v.lux * v.room_area) / (v.flux * v.uf * v.mf));
    res.steps.push({ title: "2. Éclairage (méthode des flux)", lines: [{ label: "Nombre de luminaires", value: n, formula: "N = E A / (Φ × U × M)" }, { label: "Éclairement obtenu", value: r2((n * v.flux * v.uf * v.mf) / v.room_area, 4), unit: "lx" }] });
    res.bom = [{ name: cool ? "Climatiseur split" : "Thermostat connecté", qty: 1, unit: "u", spec: `${r2(total / 1000, 3)} kW ${cool ? "frigorifiques" : "de chauffage"}` }, { name: "Luminaire / lampe LED", qty: n, unit: "u", spec: `${v.flux} lm` }];
    res.summary = [{ label: `Puissance ${cool ? "frigorifique" : "de chauffage"}`, value: r2(total / 1000, 3), unit: "kW" }, { label: "Luminaires", value: n }];
    return finish(res);
  },
};

export const COLD: Software = {
  key: "froid", title: "Froid : bilan frigorifique d'une chambre froide", discipline: "froid", lab: "refrigeration",
  summary: "Apports par les parois, par les produits (refroidissement, congélation, sous-refroidissement), par le renouvellement d'air (enthalpie), par les occupants et l'éclairage ; puissance frigorifique et électrique.",
  sections: [
    { title: "1. Chambre", fields: [nf("L", "Longueur intérieure", "m"), nf("W", "Largeur intérieure", "m"), nf("H", "Hauteur intérieure", "m"), nf("u", "U des parois isolées (fiche)", "W/(m²·K)"), nf("t_in", "Température de la chambre", "°C"), nf("t_out", "Température extérieure", "°C"), nf("rh_out", "Humidité relative extérieure", "%"), nf("renew", "Renouvellements d'air par jour (usage)", "")] },
    { title: "2. Produits", fields: [nf("m", "Masse de produit entrant", "kg/j"), nf("t_entry", "Température d'entrée", "°C"), nf("t_freeze", "Température de congélation du produit", "°C"), nf("cp_above", "Chaleur massique avant congélation", "kJ/(kg·K)"), nf("cp_below", "Chaleur massique après congélation", "kJ/(kg·K)"), nf("latent", "Chaleur latente de congélation", "kJ/kg")] },
    { title: "3. Autres apports et machine", fields: [nf("people", "Personnes", ""), nf("w_person", "Apport par personne", "W"), nf("h_person", "Présence", "h/j"), nf("light", "Éclairage", "W"), nf("h_light", "Allumage", "h/j"), nf("safety", "Majoration de sécurité", "%"), nf("run_h", "Heures de marche du groupe", "h/j"), nf("cop", "Coefficient de performance (fiche du groupe)", "")] },
  ],
  example: { L: 4, W: 3, H: 2.5, u: 0.22, t_in: -18, t_out: 35, rh_out: 60, renew: 10, m: 500, t_entry: 5, t_freeze: -2, cp_above: 3.6, cp_below: 1.9, latent: 250, people: 1, w_person: 270, h_person: 2, light: 60, h_light: 3, safety: 10, run_h: 18, cop: 1.6 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { L: ["longueur (m)", { positive: true }], W: ["largeur (m)", { positive: true }], H: ["hauteur (m)", { positive: true }], u: ["U des parois", { positive: true }], t_in: ["température de la chambre (°C)"], t_out: ["température extérieure (°C)"], rh_out: ["humidité extérieure (%)", { min: 0, max: 100 }], renew: ["renouvellements d'air par jour", { min: 0 }], m: ["masse de produit (kg/j)", { min: 0 }], t_entry: ["température d'entrée (°C)"], t_freeze: ["température de congélation (°C)"], cp_above: ["chaleur massique avant congélation", { positive: true }], cp_below: ["chaleur massique après congélation", { positive: true }], latent: ["chaleur latente", { min: 0 }], people: ["personnes", { min: 0 }], w_person: ["apport par personne (W)", { min: 0 }], h_person: ["présence (h/j)", { min: 0, max: 24 }], light: ["éclairage (W)", { min: 0 }], h_light: ["allumage (h/j)", { min: 0, max: 24 }], safety: ["majoration (%)", { min: 0 }], run_h: ["heures de marche (h/j)", { positive: true, max: 24 }], cop: ["COP", { positive: true }] });
    if (res.missing.length) return finish(res);
    const area = 2 * (v.L * v.W + v.L * v.H + v.W * v.H), vol = v.L * v.W * v.H;
    const qWalls = (v.u * area * (v.t_out - v.t_in) * 24) / 1000; // kWh/j
    const freezing = v.t_in < v.t_freeze && v.t_entry > v.t_freeze;
    const kj = freezing ? v.m * (v.cp_above * (v.t_entry - v.t_freeze) + v.latent + v.cp_below * (v.t_freeze - v.t_in)) : v.m * (v.t_entry > v.t_freeze ? v.cp_above : v.cp_below) * (v.t_entry - v.t_in);
    const qProd = kj / 3600;
    const wo = humidityRatio(v.t_out, v.rh_out / 100), wi = Math.min(wo, humidityRatio(Math.max(v.t_in, -40), 0.9));
    const dh = enthalpy(v.t_out, wo) - enthalpy(v.t_in, wi); // kJ/kg air sec
    const qAir = (v.renew * vol * airDensity(v.t_in, wi) * dh) / 3600;
    const qPeople = (v.people * v.w_person * v.h_person) / 1000, qLight = (v.light * v.h_light) / 1000;
    const qTot = (qWalls + qProd + qAir + qPeople + qLight) * (1 + v.safety / 100);
    const pFrig = qTot / v.run_h;
    res.steps.push({ title: "1. Bilan frigorifique journalier", lines: [
      { label: "Parois", value: r2(qWalls, 4), unit: "kWh/j", formula: `U A ΔT × 24 h ; A = ${r2(area, 3)} m²` },
      { label: "Produits", value: r2(qProd, 4), unit: "kWh/j", formula: freezing ? "m [cp (Te − Tc) + L + cp' (Tc − Ti)]" : "m cp ΔT" },
      { label: "Renouvellement d'air", value: r2(qAir, 4), unit: "kWh/j", formula: `n V ρ Δh ; Δh = ${r2(dh, 4)} kJ/kg` },
      { label: "Personnes et éclairage", value: r2(qPeople + qLight, 4), unit: "kWh/j" },
      { label: "Total majoré", value: r2(qTot, 4), unit: "kWh/j" },
      { label: "Puissance frigorifique", value: r2(pFrig, 4), unit: "kW", formula: "Q / heures de marche" }, { label: "Puissance électrique", value: r2(pFrig / v.cop, 4), unit: "kW", formula: "P_frig / COP" },
    ] });
    res.references.push("Psychrométrie (enthalpie de l'air humide) ; caractéristiques des produits saisies (tables du froid)");
    res.assumptions.push("Air intérieur supposé à 90 % d'humidité relative (borne de l'enthalpie de sortie), ventilateurs d'évaporateur et dégivrage inclus dans la majoration");
    res.bom = [{ name: "Chambre froide", qty: 1, unit: "u", spec: `${v.L} × ${v.W} × ${v.H} m, ${v.t_in} °C` }, { name: "Panneau isolant thermique", qty: r2(area, 3), unit: "m²", spec: `U ≤ ${v.u} W/(m²·K)` }, { name: "Compresseur frigorifique", qty: 1, unit: "u", spec: `${r2(pFrig, 3)} kW frigorifiques à ${v.t_in} °C` }, { name: "Évaporateur", qty: 1, unit: "u", spec: `${r2(pFrig, 3)} kW` }, { name: "Condenseur à air", qty: 1, unit: "u", spec: `${r2(pFrig * (1 + 1 / v.cop), 3)} kW rejetés` }, { name: "Détendeur thermostatique", qty: 1, unit: "u", spec: "" }, { name: "Thermostat / régulateur de froid", qty: 1, unit: "u", spec: "" }, { name: "Sonde de température étanche", qty: 2, unit: "u", spec: "enregistrement" }];
    res.summary = [{ label: "Puissance frigorifique", value: r2(pFrig, 3), unit: "kW" }, { label: "Puissance électrique", value: r2(pFrig / v.cop, 3), unit: "kW" }];
    return finish(res);
  },
};

export const PLUMBING: Software = {
  key: "plomberie", title: "Plomberie : débits probables, diamètres, pression disponible, eau chaude", discipline: "plomberie", lab: "solar",
  summary: "Débit de base des appareils, débit probable (coefficient de simultanéité de la norme appliquée), diamètre pour la vitesse maximale, pertes de charge et pression disponible au point le plus défavorisé, ballon et puissance de chauffe de l'eau chaude.",
  sections: [
    { title: "1. Appareils", fields: [{ key: "fixtures", label: "Appareils", type: "rows", cols: [{ key: "name", label: "Appareil", type: "text" }, { key: "qty", label: "Nombre", type: "int" }, { key: "qb", label: "Débit de base (norme)", unit: "L/s", type: "number" }] }, nf("y", "Coefficient de simultanéité (norme appliquée)", "")] },
    { title: "2. Canalisation principale", fields: [nf("v_max", "Vitesse maximale admise", "m/s"), nf("d_in", "Diamètre intérieur choisi", "mm"), nf("length", "Longueur jusqu'au point défavorisé", "m"), nf("rough", "Rugosité (fiche du tube)", "mm"), nf("k", "Σ K des accessoires", ""), nf("p_in", "Pression disponible à l'entrée", "bar"), nf("dz", "Dénivelé jusqu'au point défavorisé", "m"), nf("p_min", "Pression minimale requise au point de puisage", "bar")] },
    { title: "3. Eau chaude", fields: [nf("v_hot", "Besoin journalier d'eau chaude", "L/j"), nf("t_cold", "Eau froide", "°C"), nf("t_hot", "Eau chaude", "°C"), nf("recovery", "Durée de réchauffage", "h")] },
  ],
  example: { fixtures: [{ name: "Lavabos", qty: 4, qb: 0.2 }, { name: "Douches", qty: 2, qb: 0.2 }, { name: "Évier", qty: 1, qb: 0.2 }, { name: "WC", qty: 3, qb: 0.12 }], y: 0.35, v_max: 2, d_in: 20, length: 25, rough: 0.0015, k: 6, p_in: 3, dz: 6, p_min: 1, v_hot: 200, t_cold: 25, t_hot: 55, recovery: 4 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { y: ["coefficient de simultanéité", { positive: true, max: 1 }], v_max: ["vitesse maximale (m/s)", { positive: true }], d_in: ["diamètre intérieur (mm)", { positive: true }], length: ["longueur (m)", { positive: true }], rough: ["rugosité (mm)", { min: 0 }], k: ["Σ K", { min: 0 }], p_in: ["pression d'entrée (bar)", { positive: true }], dz: ["dénivelé (m)"], p_min: ["pression minimale (bar)", { min: 0 }], v_hot: ["besoin d'eau chaude (L/j)", { min: 0 }], t_cold: ["eau froide (°C)"], t_hot: ["eau chaude (°C)"], recovery: ["durée de réchauffage (h)", { positive: true }] });
    let qb = 0;
    for (const f of rows(input.fixtures)) { const q = num(f.qty), b = num(f.qb); if (req(res, q, `${f.name || "appareil"} : nombre`, { min: 0 }) && req(res, b, `${f.name || "appareil"} : débit de base`, { min: 0 })) qb += q * b; }
    if (!res.missing.length && qb <= 0) res.missing.push("au moins un appareil avec un débit de base");
    if (res.missing.length) return finish(res);
    const qp = v.y * qb, dMin = Math.sqrt((4 * qp / 1000) / (Math.PI * v.v_max)) * 1000;
    const l = pipeLoss({ name: "principale", length: v.length, d: v.d_in / 1000, rough: v.rough / 1000, k: v.k }, qp / 1000, waterNu(15));
    const pEnd = v.p_in - ((l.linear + l.singular + v.dz) * RHO * G) / 1e5;
    res.steps.push({ title: "1. Débits et diamètre", lines: [{ label: "Débit de base total", value: r2(qb, 4), unit: "L/s" }, { label: "Débit probable", value: r2(qp, 4), unit: "L/s", formula: "y × Σ Qb" }, { label: "Diamètre intérieur minimal", value: r2(dMin, 4), unit: "mm", formula: "√(4 Q / (π Vmax))" }] });
    res.steps.push({ title: "2. Pression au point défavorisé", ok: pEnd >= v.p_min && l.v <= v.v_max, lines: [{ label: "Vitesse (diamètre choisi)", value: r2(l.v, 3), unit: "m/s" }, { label: "Pertes de charge", value: r2(l.linear + l.singular, 4), unit: "m", formula: "Darcy-Weisbach + ΣK V²/2g (eau à 15 °C)" }, { label: "Pression disponible au point de puisage", value: r2(pEnd, 4), unit: "bar", formula: "P_entrée − (J + Δz) ρ g" }] });
    if (pEnd < v.p_min) res.warnings.push("Pression insuffisante au point défavorisé : diamètre plus grand ou surpresseur");
    const e = (v.v_hot * CP_WATER * (v.t_hot - v.t_cold)) / 3.6e6;
    res.steps.push({ title: "3. Eau chaude", lines: [{ label: "Énergie journalière", value: r2(e, 4), unit: "kWh/j", formula: "V cp ΔT" }, { label: "Puissance de chauffe", value: r2(e / v.recovery, 4), unit: "kW", formula: "E / durée de réchauffage (pertes du ballon à ajouter)" }] });
    res.bom = [{ name: "Tube multicouche / PER", qty: v.length, unit: "m", spec: `diamètre intérieur ${v.d_in} mm` }, { name: "Robinet / mitigeur", qty: rows(input.fixtures).reduce((a, f) => a + (num(f.qty) ?? 0), 0), unit: "u", spec: "" }, { name: "Compteur d'eau", qty: 1, unit: "u", spec: `${r2(qp * 3.6, 3)} m³/h` }, { name: "Chauffe-eau (électrique ou solaire)", qty: 1, unit: "u", spec: `${v.v_hot} L, ${r2(e / v.recovery, 3)} kW` }, ...(v.p_in > 3 ? [{ name: "Réducteur de pression", qty: 1, unit: "u", spec: "" }] : [])];
    res.summary = [{ label: "Débit probable", value: r2(qp, 3), unit: "L/s" }, { label: "Pression au point défavorisé", value: r2(pEnd, 3), unit: "bar" }];
    return finish(res);
  },
};

export const ROBOT: Software = {
  key: "robotique", title: "Robotique : motorisation d'un robot mobile, couple, vitesse, autonomie", discipline: "ia_robotique", lab: "mechanical",
  summary: "Effort de traction (accélération, pente, roulement), couple et vitesse de chaque roue motrice, puissance, réduction nécessaire et autonomie sur batterie.",
  sections: [{ title: "1. Robot", fields: [nf("m", "Masse totale", "kg"), nf("r", "Rayon de roue", "mm"), nf("n", "Roues motrices", ""), nf("v", "Vitesse maximale", "m/s"), nf("a", "Accélération", "m/s²"), nf("slope", "Pente maximale", "%"), nf("crr", "Coefficient de résistance au roulement (sol)", ""), nf("eta", "Rendement de la chaîne de traction", "%"), nf("motor_rpm", "Vitesse nominale du moteur (fiche)", "tr/min"), nf("v_bat", "Tension de la batterie", "V"), nf("cap", "Capacité de la batterie", "Ah"), nf("duty", "Part de la puissance maximale en moyenne", "%"), nf("p_elec", "Électronique embarquée", "W")] }],
  example: { m: 12, r: 50, n: 2, v: 1, a: 0.5, slope: 10, crr: 0.02, eta: 70, motor_rpm: 3000, v_bat: 12, cap: 10, duty: 40, p_elec: 8 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { m: ["masse (kg)", { positive: true }], r: ["rayon de roue (mm)", { positive: true }], n: ["roues motrices", { positive: true }], v: ["vitesse (m/s)", { positive: true }], a: ["accélération (m/s²)", { min: 0 }], slope: ["pente (%)", { min: 0 }], crr: ["résistance au roulement", { min: 0, max: 1 }], eta: ["rendement (%)", { positive: true, max: 100 }], motor_rpm: ["vitesse du moteur (tr/min)", { positive: true }], v_bat: ["tension (V)", { positive: true }], cap: ["capacité (Ah)", { positive: true }], duty: ["part de puissance moyenne (%)", { positive: true, max: 100 }], p_elec: ["électronique (W)", { min: 0 }] });
    if (res.missing.length) return finish(res);
    const th = Math.atan(v.slope / 100), F = v.m * (v.a + G * Math.sin(th) + G * v.crr * Math.cos(th));
    const rm = v.r / 1000, Cw = (F * rm) / v.n, nW = (v.v / (2 * Math.PI * rm)) * 60, Pmech = F * v.v, Pel = Pmech / (v.eta / 100);
    const ratio = v.motor_rpm / nW, auto = (v.v_bat * v.cap) / (Pel * v.duty / 100 + v.p_elec);
    res.steps.push({ title: "1. Motorisation", lines: [{ label: "Effort de traction", value: r2(F, 4), unit: "N", formula: "m (a + g sin θ + g Crr cos θ)" }, { label: "Couple par roue", value: r2(Cw, 4), unit: "N·m", formula: "F r / n" }, { label: "Vitesse de roue", value: r2(nW, 4), unit: "tr/min" }, { label: "Puissance mécanique", value: r2(Pmech, 4), unit: "W" }, { label: "Puissance électrique", value: r2(Pel, 4), unit: "W" }, { label: "Rapport de réduction", value: r2(ratio, 4), formula: "n_moteur / n_roue" }, { label: "Couple moteur (par roue)", value: r2(Cw / ratio / (v.eta / 100), 4), unit: "N·m" }, { label: "Autonomie", value: r2(auto, 3), unit: "h", formula: "V × C / (P moyenne + électronique)" }] });
    res.bom = [{ name: "Moteur à courant continu (petit)", qty: v.n, unit: "u", spec: `≥ ${r2(Pel / v.n, 3)} W, ${v.motor_rpm} tr/min` }, { name: "Réducteur à engrenages", qty: v.n, unit: "u", spec: `i ≈ ${r2(ratio, 3)}` }, { name: "Driver de moteur DC double pont en H", qty: Math.ceil(v.n / 2), unit: "u", spec: `≥ ${r2(Pel / v.n / v.v_bat * 2, 3)} A crête` }, { name: "Châssis de robot mobile", qty: 1, unit: "u", spec: `${v.m} kg` }, { name: "Codeur rotatif", qty: v.n, unit: "u", spec: "" }, { name: "Batterie Li-ion 18650", qty: 1, unit: "lot", spec: `${v.v_bat} V, ${v.cap} Ah` }];
    res.summary = [{ label: "Couple par roue", value: r2(Cw, 3), unit: "N·m" }, { label: "Autonomie", value: r2(auto, 3), unit: "h" }];
    return finish(res);
  },
};

export const DRONE: Software = {
  key: "drones", title: "Drones : rapport poussée/poids, vol stationnaire, autonomie", discipline: "drone", lab: "mechanical",
  summary: "Masse au décollage, poussée disponible et rapport poussée/poids, poussée de stationnaire par moteur et autonomie estimée d'après les essais du fabricant (moteur + hélice). Aucun pilotage réel : conception et pré-vol seulement.",
  sections: [{ title: "1. Configuration", equipment: [{ label: "Batterie", names: ["Batterie LiPo"], map: {} }], fields: [nf("m_frame", "Masse du châssis, moteurs et électronique", "g"), nf("m_bat", "Masse de la batterie", "g"), nf("m_payload", "Charge utile", "g"), nf("n", "Nombre de moteurs", ""), nf("thrust", "Poussée maximale par moteur (essai fabricant)", "g"), nf("p_hover", "Puissance par moteur au stationnaire (essai fabricant)", "W"), nf("v_bat", "Tension de la batterie", "V"), nf("cap", "Capacité", "mAh"), nf("usable", "Capacité utilisable", "%"), nf("tw_min", "Rapport poussée/poids minimal visé", "")] }],
  example: { m_frame: 900, m_bat: 450, m_payload: 300, n: 4, thrust: 1100, p_hover: 85, v_bat: 14.8, cap: 5000, usable: 80, tw_min: 2 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { m_frame: ["masse du châssis (g)", { positive: true }], m_bat: ["masse de la batterie (g)", { positive: true }], m_payload: ["charge utile (g)", { min: 0 }], n: ["nombre de moteurs", { positive: true }], thrust: ["poussée maximale par moteur (g)", { positive: true }], p_hover: ["puissance au stationnaire (W)", { positive: true }], v_bat: ["tension (V)", { positive: true }], cap: ["capacité (mAh)", { positive: true }], usable: ["capacité utilisable (%)", { positive: true, max: 100 }], tw_min: ["rapport poussée/poids minimal", { positive: true }] });
    if (res.missing.length) return finish(res);
    const mTot = v.m_frame + v.m_bat + v.m_payload, tw = (v.n * v.thrust) / mTot, hoverPerMotor = mTot / v.n;
    const wh = (v.v_bat * v.cap / 1000) * (v.usable / 100), time = (wh / (v.n * v.p_hover)) * 60;
    res.steps.push({ title: "1. Vol", ok: tw >= v.tw_min, lines: [{ label: "Masse au décollage", value: mTot, unit: "g" }, { label: "Rapport poussée/poids", value: r2(tw, 3), formula: "n × poussée max / masse" }, { label: "Poussée de stationnaire par moteur", value: r2(hoverPerMotor, 4), unit: "g", formula: `soit ${r2((100 * hoverPerMotor) / v.thrust, 3)} % de la poussée maximale` }, { label: "Énergie utilisable", value: r2(wh, 4), unit: "Wh" }, { label: "Autonomie en stationnaire", value: r2(time, 3), unit: "min", formula: "E / (n × P_stationnaire)" }] });
    if (tw < v.tw_min) res.warnings.push("Rapport poussée/poids insuffisant : alléger ou changer de motorisation");
    res.warnings.push("Pré-dimensionnement : aucune commande de vol réelle ; vol soumis à la réglementation aérienne locale et aux essais au sol");
    res.bom = [{ name: "Contrôleur de vol", qty: 1, unit: "u", spec: "" }, { name: "Moteur sans balais (brushless)", qty: v.n, unit: "u", spec: `${v.thrust} g de poussée max (essai)` }, { name: "Contrôleur de vitesse (ESC)", qty: v.n, unit: "u", spec: `≥ ${r2((v.p_hover * 2.5) / v.v_bat, 3)} A (marge à confirmer)` }, { name: "Hélice", qty: v.n, unit: "u", spec: "selon l'essai moteur" }, { name: "Batterie LiPo", qty: 1, unit: "u", spec: `${v.v_bat} V, ${v.cap} mAh` }, { name: "Récepteur GNSS + compas", qty: 1, unit: "u", spec: "" }];
    res.summary = [{ label: "Rapport poussée/poids", value: r2(tw, 3) }, { label: "Autonomie", value: r2(time, 3), unit: "min" }];
    return finish(res);
  },
};

export const IRRIGATION: Software = {
  key: "irrigation", title: "Agriculture intelligente : irrigation goutte-à-goutte (ET0, besoins, goutteurs, secteurs)", discipline: "agriculture", lab: "solar",
  summary: "Évapotranspiration de référence (saisie ou calculée par la formule de Hargreaves FAO-56), besoin de la culture (Kc), pluie efficace, besoin brut, nombre de goutteurs, durée d'arrosage et secteurs selon le débit disponible ; schéma hydraulique et automate IoT.",
  sections: [{ title: "1. Culture et climat", fields: [nf("area", "Surface irriguée", "m²"), nf("kc", "Coefficient cultural Kc (FAO-56, stade)", ""), nf("et0", "ET0 (si connue)", "mm/j", { optional: true }), nf("lat", "Latitude (pour Hargreaves)", "°", { optional: true }), nf("month", "Mois (1–12, pour Hargreaves)", "", { optional: true }), nf("tmin", "Température minimale moyenne", "°C", { optional: true }), nf("tmax", "Température maximale moyenne", "°C", { optional: true }), nf("rain", "Pluie efficace", "mm/j"), nf("eff", "Efficience du système d'irrigation", "%")] },
    { title: "2. Réseau goutte-à-goutte", fields: [nf("row", "Écartement des lignes", "m"), nf("spacing", "Écartement des goutteurs", "m"), nf("q_drip", "Débit d'un goutteur (fiche)", "L/h"), nf("q_avail", "Débit disponible (pompe ou réseau)", "m³/h")] }],
  example: { area: 2000, kc: 1.05, et0: null, lat: 14.8, month: 4, tmin: 20, tmax: 36, rain: 0, eff: 90, row: 1, spacing: 0.3, q_drip: 2, q_avail: 6 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { area: ["surface (m²)", { positive: true }], kc: ["coefficient cultural Kc", { positive: true, max: 2 }], rain: ["pluie efficace (mm/j)", { min: 0 }], eff: ["efficience (%)", { positive: true, max: 100 }], row: ["écartement des lignes (m)", { positive: true }], spacing: ["écartement des goutteurs (m)", { positive: true }], q_drip: ["débit d'un goutteur (L/h)", { positive: true }], q_avail: ["débit disponible (m³/h)", { positive: true }] });
    let et0 = num(input.et0), how = "saisie";
    if (et0 == null) {
      const g2 = grab(res, input, { lat: ["latitude (Hargreaves)", { min: -66, max: 66 }], month: ["mois (Hargreaves)", { min: 1, max: 12 }], tmin: ["température minimale (°C)"], tmax: ["température maximale (°C)"] });
      if (!res.missing.length) {
        if (g2.tmax <= g2.tmin) res.missing.push("Tmax > Tmin");
        else { const raMJ = h0Daily(g2.lat, MEAN_DAYS[Math.round(g2.month) - 1]) * 3.6; et0 = 0.0023 * (raMJ * 0.408) * ((g2.tmin + g2.tmax) / 2 + 17.8) * Math.sqrt(g2.tmax - g2.tmin); how = `Hargreaves : 0,0023 × Ra(${r2(raMJ * 0.408, 3)} mm/j) × (Tmoy + 17,8) × √(Tmax − Tmin)`; }
      }
    }
    if (res.missing.length || et0 == null) return finish(res);
    const etc = v.kc * et0, net = Math.max(0, etc - v.rain), gross = net / (v.eff / 100), litres = gross * v.area;
    const nDrip = Math.floor(v.area / (v.row * v.spacing)), qTot = (nDrip * v.q_drip) / 1000, sectors = Math.ceil(qTot / v.q_avail);
    const time = (litres / (nDrip * v.q_drip)) * 60;
    res.steps.push({ title: "1. Besoins en eau", lines: [{ label: "ET0", value: r2(et0, 4), unit: "mm/j", formula: how }, { label: "ETc", value: r2(etc, 4), unit: "mm/j", formula: "Kc × ET0" }, { label: "Besoin net", value: r2(net, 4), unit: "mm/j", formula: "ETc − pluie efficace" }, { label: "Besoin brut", value: r2(gross, 4), unit: "mm/j", formula: "net / efficience" }, { label: "Volume journalier", value: r2(litres / 1000, 4), unit: "m³/j", formula: "1 mm = 1 L/m²" }] });
    res.steps.push({ title: "2. Réseau et arrosage", lines: [{ label: "Goutteurs", value: nDrip }, { label: "Débit total", value: r2(qTot, 4), unit: "m³/h" }, { label: "Secteurs", value: sectors, formula: "⌈débit total / débit disponible⌉" }, { label: "Durée d'arrosage par secteur", value: r2(time, 4), unit: "min/j" }, { label: "Durée totale", value: r2((time * sectors) / 60, 4), unit: "h/j" }] });
    if ((time * sectors) / 60 > 20) res.warnings.push("Durée totale d'arrosage trop longue : augmenter le débit disponible");
    res.references.push("FAO Irrigation and Drainage Paper 56 (Allen et al., 1998) : ETc = Kc ET0, équation de Hargreaves (éq. 52), Ra en équivalent d'évaporation (× 0,408)");
    res.bom = [{ name: "Goutteur / ligne de goutte-à-goutte", qty: Math.round(v.area / v.row), unit: "m", spec: `${v.q_drip} L/h tous les ${v.spacing} m` }, { name: "Électrovanne", qty: sectors, unit: "u", spec: "une par secteur" }, { name: "Filtre à disques / tamis", qty: 1, unit: "u", spec: `${r2(v.q_avail, 3)} m³/h` }, { name: "Capteur d'humidité du sol capacitif", qty: sectors, unit: "u", spec: "" }, { name: "Carte ESP32", qty: 1, unit: "u", spec: "programmateur connecté" }, { name: "Module relais", qty: sectors, unit: "u", spec: "" }];
    res.summary = [{ label: "Volume journalier", value: r2(litres / 1000, 3), unit: "m³" }, { label: "Secteurs", value: sectors }];
    res.diagram = { kind: "pompage_hydraulique", params: { zones: Math.min(8, sectors) } };
    return finish(res);
  },
};

export const DOMOTICS: Software = {
  key: "domotique", title: "Domotique : économies d'énergie par l'automatisation, passerelles", discipline: "domotique", lab: "electrical",
  summary: "Consommation avant et après automatisation (présence, programmation, coupure des veilles), économies annuelles d'énergie et en FCFA, temps de retour, nombre de passerelles selon le protocole.",
  sections: [{ title: "1. Appareils", fields: [{ key: "apps", label: "Appareils", type: "rows", cols: [{ key: "name", label: "Appareil", type: "text" }, { key: "p", label: "Puissance", unit: "W", type: "number" }, { key: "h_before", label: "Durée actuelle", unit: "h/j", type: "number" }, { key: "h_after", label: "Durée automatisée", unit: "h/j", type: "number" }, { key: "standby", label: "Veille supprimée", unit: "W", type: "number" }] }, nf("price", "Prix de l'électricité", "FCFA/kWh"), nf("invest", "Coût de l'automatisation", "FCFA"), nf("devices", "Objets connectés", ""), nf("per_gw", "Objets par passerelle (fiche)", "")] }],
  example: { apps: [{ name: "Climatiseur bureau", p: 1200, h_before: 10, h_after: 7, standby: 3 }, { name: "Éclairage couloir", p: 120, h_before: 14, h_after: 4, standby: 0 }, { name: "Chauffe-eau", p: 2000, h_before: 4, h_after: 3, standby: 0 }], price: 110, invest: 250000, devices: 12, per_gw: 50 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { price: ["prix de l'électricité (FCFA/kWh)", { positive: true }], invest: ["coût de l'automatisation (FCFA)", { min: 0 }], devices: ["objets connectés", { min: 0 }], per_gw: ["objets par passerelle", { positive: true }] });
    let before = 0, after = 0;
    for (const a of rows(input.apps)) { const p = num(a.p), hb = num(a.h_before), ha = num(a.h_after), sb = num(a.standby) ?? 0; if (req(res, p, `${a.name || "appareil"} : puissance`, { min: 0 }) && req(res, hb, `${a.name || "appareil"} : durée actuelle`, { min: 0, max: 24 }) && req(res, ha, `${a.name || "appareil"} : durée automatisée`, { min: 0, max: 24 })) { before += p * hb + sb * (24 - hb); after += p * ha; } }
    if (res.missing.length) return finish(res);
    const saved = ((before - after) * 365) / 1000, money = saved * v.price;
    res.steps.push({ title: "1. Économies", lines: [{ label: "Consommation actuelle", value: r2((before * 365) / 1000, 4), unit: "kWh/an" }, { label: "Consommation automatisée", value: r2((after * 365) / 1000, 4), unit: "kWh/an" }, { label: "Économie", value: r2(saved, 4), unit: "kWh/an" }, { label: "Économie financière", value: Math.round(money), unit: "FCFA/an" }, { label: "Temps de retour", value: money > 0 ? r2(v.invest / money, 3) : "—", unit: "ans" }, { label: "Passerelles", value: Math.max(1, Math.ceil(v.devices / v.per_gw)) }] });
    res.bom = [{ name: "Box domotique", qty: Math.max(1, Math.ceil(v.devices / v.per_gw)), unit: "u", spec: "" }, { name: "Prise connectée", qty: rows(input.apps).length, unit: "u", spec: "avec mesure de consommation" }, { name: "Détecteur de présence domotique", qty: Math.ceil(rows(input.apps).length / 2), unit: "u", spec: "" }];
    res.summary = [{ label: "Économie annuelle", value: r2(saved, 4), unit: "kWh" }, { label: "Économie financière", value: Math.round(money), unit: "FCFA/an" }];
    return finish(res);
  },
};

export const CARBON: Software = {
  key: "environnement", title: "Environnement : bilan carbone énergétique et émissions évitées", discipline: "environnement", lab: "solar",
  summary: "Émissions de gaz à effet de serre des postes énergétiques (quantité × facteur d'émission saisi avec sa source) et émissions évitées par une production renouvelable ou une économie.",
  sections: [{ title: "1. Postes d'émission", fields: [{ key: "items", label: "Postes", type: "rows", cols: [{ key: "name", label: "Poste", type: "text" }, { key: "qty", label: "Quantité annuelle", type: "number" }, { key: "unit", label: "Unité", type: "text" }, { key: "ef", label: "Facteur d'émission", unit: "kgCO2e/unité", type: "number" }, { key: "source", label: "Source du facteur", type: "text" }] }, nf("avoided_kwh", "Électricité produite ou économisée", "kWh/an", { optional: true }), nf("grid_ef", "Facteur d'émission du réseau électrique (source officielle)", "kgCO2e/kWh", { optional: true })] }],
  example: { items: [{ name: "Électricité du réseau", qty: 12000, unit: "kWh", ef: 0.6, source: "valeur d'exemple — remplacer par la valeur officielle du pays" }, { name: "Gazole du groupe électrogène", qty: 1500, unit: "L", ef: 2.7, source: "valeur d'exemple — remplacer par la valeur de référence" }], avoided_kwh: 5000, grid_ef: 0.6 },
  run: (input): StudyResult => {
    const res = empty();
    let tot = 0;
    const lines: StudyResult["steps"][number]["lines"] = [];
    for (const it of rows(input.items)) {
      const q = num(it.qty), ef = num(it.ef), n = String(it.name || "poste");
      if (!req(res, q, `${n} : quantité`, { min: 0 }) || !req(res, ef, `${n} : facteur d'émission`, { min: 0 })) continue;
      if (!String(it.source ?? "").trim()) res.warnings.push(`${n} : source du facteur d'émission non indiquée`);
      tot += q * ef; lines.push({ label: n, value: r2((q * ef) / 1000, 4), unit: "tCO2e/an", formula: `${q} ${it.unit ?? ""} × ${ef} — ${it.source || "source à préciser"}` });
    }
    if (!rows(input.items).length) res.missing.push("au moins un poste");
    if (res.missing.length) return finish(res);
    res.steps.push({ title: "1. Émissions", lines: [...lines, { label: "Total", value: r2(tot / 1000, 4), unit: "tCO2e/an" }] });
    const ak = num(input.avoided_kwh), gef = num(input.grid_ef);
    if (ak != null && gef != null) res.steps.push({ title: "2. Émissions évitées", lines: [{ label: "Émissions évitées", value: r2((ak * gef) / 1000, 4), unit: "tCO2e/an", formula: "kWh × facteur du réseau" }, { label: "Bilan net", value: r2((tot - ak * gef) / 1000, 4), unit: "tCO2e/an" }] });
    res.summary = [{ label: "Émissions", value: r2(tot / 1000, 4), unit: "tCO2e/an" }];
    return finish(res);
  },
};
