/**
 * Logiciel « Séchage solaire et naturel » — moteur pur (bilans de masse et d'énergie, psychrométrie).
 * Eau à évaporer → air de séchage (chauffage à humidité constante puis évolution adiabatique jusqu'à l'humidité de
 * sortie choisie) → débit d'air → besoin thermique (+ pertes des parois) → surface de capteur → claies et chambre →
 * ventilateur et énergie des auxiliaires → rendement. Les données du produit (teneurs en eau, température maximale,
 * charge par m²) sont saisies : rien n'est supposé. La CINÉTIQUE de séchage d'un produit n'est pas modélisée :
 * la durée est une donnée de conception à confirmer par un essai.
 */
import { CP_AIR, CP_VAPOUR, adiabaticTo, airDensity, hfg, humidityRatio } from "./thermo";
import { atmPressure, G } from "./hydraulics";
import { empty, finish, num, r2, req, type BomLine, type Software, type StudyResult } from "./types";

const pct = (v: number | null) => (v == null ? null : v / 100);
const TYPES = [{ v: "indirect", l: "Indirect (capteur à air + chambre)" }, { v: "direct", l: "Direct (produit exposé sous vitrage)" }, { v: "mixte", l: "Mixte" }, { v: "hybride", l: "Hybride (solaire + appoint)" }];

export const DRYING: Software = {
  key: "sechage-solaire", title: "Séchage solaire : produit, air, énergie, capteur, claies, ventilation", discipline: "agriculture", lab: "solar",
  summary: "Dimensionnement d'un séchoir solaire direct, indirect, mixte ou hybride, à convection naturelle ou forcée, pour poisson, fruits, légumes, céréales ou plantes : eau à évaporer, débit et vitesse d'air, besoin thermique, surface de capteur, claies, chambre, ventilateur, appoint, rendement, nomenclature et rapport.",
  sections: [
    { title: "1. Produit", fields: [
      { key: "product", label: "Produit", type: "text" },
      { key: "m0", label: "Masse fraîche par lot", unit: "kg", type: "number" },
      { key: "xi", label: "Teneur en eau initiale (base humide)", unit: "%", type: "number", hint: "Mesure ou fiche du produit" },
      { key: "xf", label: "Teneur en eau finale visée (base humide)", unit: "%", type: "number", hint: "Norme de conservation du produit" },
      { key: "t_max", label: "Température maximale admise par le produit", unit: "°C", type: "number" },
      { key: "load", label: "Charge du produit par m² de claie", unit: "kg/m²", type: "number", hint: "Essai ou référence documentée" },
    ] },
    { title: "2. Séchoir et conditions", fields: [
      { key: "type", label: "Type de séchoir", type: "select", options: TYPES },
      { key: "convection", label: "Convection", type: "select", options: [{ v: "forcee", l: "Forcée (ventilateur)" }, { v: "naturelle", l: "Naturelle (tirage)" }] },
      { key: "duration_days", label: "Durée de séchage visée", unit: "j", type: "number", hint: "À confirmer par un essai de séchage du produit" },
      { key: "sun_hours", label: "Heures de fonctionnement solaire par jour", unit: "h/j", type: "number" },
      { key: "t_amb", label: "Température ambiante moyenne (période de séchage)", unit: "°C", type: "number" },
      { key: "rh_amb", label: "Humidité relative ambiante", unit: "%", type: "number" },
      { key: "rh_out", label: "Humidité relative de l'air en sortie de chambre", unit: "%", type: "number", hint: "Choix de conception (air non saturé en sortie)" },
      { key: "altitude", label: "Altitude", unit: "m", type: "number" },
      { key: "h_collector", label: "Irradiation journalière sur le plan du capteur", unit: "kWh/m²/j", type: "number", hint: "Logiciel photovoltaïque (plan incliné) ou mesures" },
      { key: "eta_collector", label: "Rendement thermique du capteur à air", unit: "%", type: "number", hint: "Essai du capteur (fiche)" },
    ] },
    { title: "3. Chambre, claies et ventilation", fields: [
      { key: "tray_area", label: "Surface d'une claie", unit: "m²", type: "number" }, { key: "tray_spacing", label: "Espacement vertical des claies", unit: "m", type: "number" },
      { key: "chamber_width", label: "Largeur intérieure de la chambre", unit: "m", type: "number" },
      { key: "u_wall", label: "Coefficient de transmission des parois U", unit: "W/(m²·K)", type: "number" },
      { key: "dp", label: "Perte de charge du circuit d'air (capteur + claies)", unit: "Pa", type: "number", optional: true, hint: "Convection forcée : fiche du capteur, essais" },
      { key: "eta_fan", label: "Rendement du ventilateur", unit: "%", type: "number", optional: true },
      { key: "chimney", label: "Hauteur de cheminée (tirage naturel)", unit: "m", type: "number", optional: true },
      { key: "aux_fraction", label: "Part d'énergie fournie par l'appoint (hybride)", unit: "%", type: "number", optional: true },
    ] },
  ],
  example: {
    product: "Exemple : mangue en tranches", m0: 100, xi: 85, xf: 12, t_max: 60, load: 8,
    type: "indirect", convection: "forcee", duration_days: 2, sun_hours: 8, t_amb: 30, rh_amb: 60, rh_out: 70, altitude: 50, h_collector: 5.5, eta_collector: 40,
    tray_area: 1, tray_spacing: 0.2, chamber_width: 1, u_wall: 1.2, dp: 80, eta_fan: 30,
  },
  run: (input): StudyResult => {
    const res = empty();
    const m0 = num(input.m0), xi = pct(num(input.xi)), xf = pct(num(input.xf)), tMax = num(input.t_max), load = num(input.load);
    const days = num(input.duration_days), hours = num(input.sun_hours), ta = num(input.t_amb), rhA = pct(num(input.rh_amb)), rhO = pct(num(input.rh_out)), alt = num(input.altitude), hCol = num(input.h_collector), etaC = pct(num(input.eta_collector));
    const trayA = num(input.tray_area), spacing = num(input.tray_spacing), width = num(input.chamber_width), u = num(input.u_wall);
    req(res, m0, "masse fraîche par lot (kg)", { positive: true }); req(res, num(input.xi), "teneur en eau initiale (%)", { positive: true, max: 99 }); req(res, num(input.xf), "teneur en eau finale (%)", { min: 0, max: 99 });
    req(res, tMax, "température maximale admise par le produit (°C)", { positive: true, max: 120 }); req(res, load, "charge par m² de claie (kg/m²)", { positive: true });
    req(res, days, "durée de séchage visée (j)", { positive: true }); req(res, hours, "heures de fonctionnement par jour", { positive: true, max: 24 });
    req(res, ta, "température ambiante (°C)", { min: -20, max: 50 }); req(res, num(input.rh_amb), "humidité relative ambiante (%)", { positive: true, max: 100 }); req(res, num(input.rh_out), "humidité relative de sortie (%)", { positive: true, max: 100 });
    req(res, alt, "altitude (m)", { min: -400, max: 5000 }); req(res, hCol, "irradiation sur le capteur (kWh/m²/j)", { positive: true }); req(res, num(input.eta_collector), "rendement du capteur (%)", { positive: true, max: 100 });
    req(res, trayA, "surface d'une claie (m²)", { positive: true }); req(res, spacing, "espacement des claies (m)", { positive: true }); req(res, width, "largeur de la chambre (m)", { positive: true }); req(res, u, "coefficient U des parois", { min: 0 });
    if (xi != null && xf != null && xf >= xi) res.missing.push("teneur en eau finale inférieure à la teneur initiale");
    if (res.missing.length) return finish(res);
    const type = String(input.type || "indirect"), forced = input.convection !== "naturelle";
    const p = atmPressure(alt!);
    // 1. Eau à évaporer
    const mDry = m0! * (1 - xi!);
    const mFinal = mDry / (1 - xf!);
    const water = m0! - mFinal;
    res.steps.push({ title: "1. Bilan de masse du produit", lines: [
      { label: "Matière sèche", value: r2(mDry, 4), unit: "kg", formula: "m0 (1 − Xi)" }, { label: "Masse finale", value: r2(mFinal, 4), unit: "kg", formula: "Ms / (1 − Xf)" },
      { label: "Eau à évaporer", value: r2(water, 4), unit: "kg", formula: "m0 − mf" }, { label: "Évaporation moyenne", value: r2(water / (days! * hours!), 4), unit: "kg/h" },
    ] });
    // 2. Air de séchage
    const tDry = tMax!;
    const wa = humidityRatio(ta!, rhA!, p);
    const out = adiabaticTo(tDry, wa, rhO!, p);
    if (!out || out.w <= wa) { res.warnings.push("Avec ces conditions, l'air ne peut pas absorber d'humidité (air ambiant trop humide ou température de séchage trop basse)"); return finish(res); }
    const dw = out.w - wa;
    const mAir = water / dw;
    const flowKgS = mAir / (days! * hours! * 3600);
    const rhoD = airDensity(tDry, wa, p);
    const flowM3h = (flowKgS / rhoD) * 3600 * (1 + wa);
    const cross = width! * Math.sqrt(trayA!); // section de passage approximée : largeur × profondeur d'une claie carrée
    res.steps.push({ title: "2. Air de séchage (psychrométrie)", lines: [
      { label: "Humidité absolue de l'air ambiant", value: r2(wa * 1000, 4), unit: "g/kg air sec", formula: "w = 0,622 pv / (p − pv)" },
      { label: "Température de l'air chaud (limite produit)", value: tDry, unit: "°C" },
      { label: "Air en sortie (évolution adiabatique)", value: `${r2(out.t, 3)} °C ; ${r2(out.w * 1000, 4)} g/kg`, formula: `enthalpie constante jusqu'à φ = ${input.rh_out} %` },
      { label: "Eau absorbée par kg d'air sec", value: r2(dw * 1000, 4), unit: "g/kg" },
      { label: "Masse d'air sec nécessaire", value: r2(mAir, 4), unit: "kg", formula: "m_eau / Δw" },
      { label: "Débit d'air", value: r2(flowM3h, 4), unit: "m³/h", formula: `à ${tDry} °C, ρ = ${r2(rhoD, 4)} kg/m³` },
      { label: "Vitesse d'air dans la chambre (indicative)", value: r2(flowM3h / 3600 / cross, 3), unit: "m/s", formula: "Q / (largeur × profondeur de claie)" },
    ] });
    // 3. Énergie
    const qSens = mAir * (CP_AIR + wa * CP_VAPOUR) * (tDry - ta!) / 3.6e6; // kWh
    const nTrays = Math.ceil(m0! / load! / trayA!);
    const height = nTrays * spacing! + 2 * spacing!;
    const depth = Math.sqrt(trayA!);
    const wallArea = 2 * (width! * height + depth * height + width! * depth);
    const qLoss = (u! * wallArea * (tDry - ta!) * days! * hours!) / 1000; // kWh
    const qTot = qSens + qLoss;
    const qLatent = (water * hfg((tDry + out.t) / 2)) / 3600; // kWh (énergie de vaporisation, pour le rendement)
    const aux = pct(num(input.aux_fraction));
    if (type === "hybride") req(res, num(input.aux_fraction), "part d'énergie fournie par l'appoint (%)", { min: 0, max: 100 });
    const qSolar = qTot * (1 - (type === "hybride" ? aux ?? 0 : 0));
    const area = qSolar / (hCol! * etaC! * days!);
    res.steps.push({ title: "3. Besoin thermique et capteur", lines: [
      { label: "Chauffage de l'air", value: r2(qSens, 4), unit: "kWh", formula: "m_air (cp_air + w cp_vap) (Tc − Ta)" },
      { label: "Pertes des parois", value: r2(qLoss, 4), unit: "kWh", formula: `U A ΔT t ; A = ${r2(wallArea, 3)} m²` },
      { label: "Besoin thermique total", value: r2(qTot, 4), unit: "kWh" },
      ...(type === "hybride" ? [{ label: "Fourni par l'appoint", value: r2(qTot - qSolar, 4), unit: "kWh" }] : []),
      { label: "Surface de capteur solaire à air", value: r2(area, 3), unit: "m²", formula: "Q_solaire / (H × η × jours)" },
      { label: "Énergie de vaporisation de l'eau", value: r2(qLatent, 4), unit: "kWh", formula: "m_eau × hfg" },
      { label: "Rendement global du séchoir", value: r2((100 * qLatent) / (area * hCol! * days! + (qTot - qSolar)), 3), unit: "%", formula: "énergie de vaporisation / énergie fournie" },
    ] });
    if (type === "direct") res.warnings.push("Séchoir direct : le produit reçoit le rayonnement ; la surface de capteur calculée correspond à la surface vitrée exposée minimale (vérifier la température du produit)");
    // 4. Claies, chambre
    res.steps.push({ title: "4. Claies et chambre", lines: [
      { label: "Surface de claies nécessaire", value: r2(m0! / load!, 4), unit: "m²", formula: "m0 / charge" }, { label: "Nombre de claies", value: nTrays },
      { label: "Hauteur intérieure de la chambre", value: r2(height, 3), unit: "m", formula: "n × espacement + 2 espacements (plénums)" },
      { label: "Dimensions intérieures (L × l × h)", value: `${r2(depth, 3)} × ${width} × ${r2(height, 3)}`, unit: "m" },
    ] });
    // 5. Ventilation
    const bom: BomLine[] = [];
    if (forced) {
      const dp = num(input.dp), etaF = pct(num(input.eta_fan));
      if (req(res, dp, "perte de charge du circuit d'air (Pa)", { positive: true }) && req(res, num(input.eta_fan), "rendement du ventilateur (%)", { positive: true, max: 100 })) {
        const pFan = (flowM3h / 3600) * dp / etaF!;
        res.steps.push({ title: "5. Ventilateur", lines: [{ label: "Puissance électrique", value: r2(pFan, 4), unit: "W", formula: "Q Δp / η" }, { label: "Énergie des auxiliaires", value: r2((pFan * hours!) / 1000, 4), unit: "kWh/j" }] });
        bom.push({ name: "Ventilateur de séchage", qty: 1, unit: "u", spec: `${r2(flowM3h, 4)} m³/h sous ${dp} Pa, ≈ ${r2(pFan, 3)} W` });
      }
    } else {
      const hC = num(input.chimney);
      if (req(res, hC, "hauteur de cheminée (m)", { positive: true })) {
        const draft = (airDensity(ta!, wa, p) - airDensity(out.t, out.w, p)) * G * hC;
        res.steps.push({ title: "5. Tirage naturel", lines: [{ label: "Pression de tirage disponible", value: r2(draft, 3), unit: "Pa", formula: "(ρ_ext − ρ_int) g H" }] });
        res.warnings.push("Convection naturelle : le débit réellement obtenu dépend des pertes de charge des claies et du capteur ; à vérifier par un essai");
      }
    }
    if (res.missing.length) return finish(res);
    bom.unshift({ name: "Chambre de séchage", qty: 1, unit: "u", spec: `${r2(depth, 3)} × ${width} × ${r2(height, 3)} m (intérieur)` }, { name: "Claie / plateau de séchage", qty: nTrays, unit: "u", spec: `${trayA} m², ${load} kg/m²` });
    if (type !== "direct") bom.push({ name: "Capteur solaire à air", qty: r2(area, 3), unit: "m²", spec: `rendement ${input.eta_collector} %` });
    bom.push({ name: "Panneau isolant thermique", qty: r2(wallArea, 3), unit: "m²", spec: `U ≤ ${u} W/(m²·K)` }, { name: "Capteur de température et d'humidité de l'air", qty: 2, unit: "u", spec: "entrée et sortie de chambre" });
    if (type === "hybride") bom.push({ name: "Résistance chauffante d'appoint", qty: 1, unit: "u", spec: `énergie ${r2(qTot - qSolar, 3)} kWh par lot` });
    res.bom = bom;
    res.references.push("Psychrométrie : w = 0,622 pv/(p − pv), pv par l'équation de Buck ; enthalpie de l'air humide ; atmosphère type pour p(z)", "cp air 1005 J/(kg·K), cp vapeur 1860 J/(kg·K), hfg ≈ 2501 − 2,361 T kJ/kg");
    res.assumptions.push("Air chauffé à humidité constante jusqu'à la température maximale du produit, puis évolution adiabatique dans la chambre", "Régime moyen sur la durée de séchage ; cinétique du produit non modélisée (durée à confirmer par essai)");
    res.summary = [{ label: "Eau à évaporer", value: r2(water, 4), unit: "kg" }, { label: "Débit d'air", value: r2(flowM3h, 4), unit: "m³/h" }, { label: "Surface de capteur", value: r2(area, 3), unit: "m²" }];
    return finish(res);
  },
};
