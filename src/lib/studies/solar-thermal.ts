/**
 * Logiciel « Solaire thermique » — moteur pur (chauffe-eau solaire individuel ou collectif, thermosiphon ou
 * circulation forcée, capteurs plans ou à tubes sous vide).
 * Besoins mensuels d'eau chaude → irradiation sur le plan des capteurs (modèle mensuel) → rendement du capteur
 * d'après ses coefficients d'essai (η0, a1, a2) → surface pour la couverture visée au mois de dimensionnement →
 * couverture mensuelle → ballon et pertes → débit, conduites, circulateur → économies.
 */
import { CP_WATER } from "./thermo";
import { MONTH_DAYS, monthlyPoa } from "./solar-geometry";
import { empty, finish, num, r2, req, type BomLine, type Software, type StudyResult } from "./types";

const pct = (v: number | null) => (v == null ? null : v / 100);
const months = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map(num) : []);

export const SOLAR_THERMAL: Software = {
  key: "solaire-thermique", title: "Solaire thermique : eau chaude, capteurs, ballon, circulation, économies", discipline: "solaire", lab: "solar",
  summary: "Dimensionnement d'un chauffe-eau solaire domestique ou collectif (thermosiphon ou circulation forcée, capteurs plans ou à tubes sous vide) : besoins, irradiation, rendement du capteur, surface, couverture solaire mensuelle, ballon, pertes, débit, conduites, circulateur, économies d'énergie, nomenclature et rapport.",
  sections: [
    { title: "1. Site", geo: true, fields: [
      { key: "lat", label: "Latitude", unit: "°", type: "number" }, { key: "lon", label: "Longitude", unit: "°", type: "number", optional: true },
      { key: "ghi", label: "Irradiation globale horizontale", unit: "kWh/m²/j", type: "months" }, { key: "tmean", label: "Température ambiante moyenne", unit: "°C", type: "months" },
      { key: "tilt", label: "Inclinaison des capteurs", unit: "°", type: "number" }, { key: "azimuth", label: "Azimut", unit: "°", type: "number" }, { key: "albedo", label: "Albédo", type: "number" },
      { key: "sun_hours", label: "Durée journalière de captage utile", unit: "h", type: "number", hint: "Pour l'éclairement moyen pendant le captage" },
    ] },
    { title: "2. Besoins en eau chaude", fields: [
      { key: "volume", label: "Consommation d'eau chaude", unit: "L/j", type: "number" }, { key: "t_hot", label: "Température de l'eau chaude", unit: "°C", type: "number" },
      { key: "t_cold", label: "Température de l'eau froide", unit: "°C", type: "months" },
      { key: "coverage", label: "Couverture solaire visée au mois de dimensionnement", unit: "%", type: "number" },
      { key: "design_month", label: "Mois de dimensionnement (1–12)", type: "int", hint: "Souvent le mois le moins ensoleillé d'usage" },
    ] },
    { title: "3. Capteur (rapport d'essai)", equipment: [{ label: "Capteur", names: ["Capteur solaire plan", "Capteur à tubes sous vide"], map: { area: "col_area", eta0: "eta0", a1: "a1", a2: "a2" } }], fields: [
      { key: "col_type", label: "Type", type: "select", options: [{ v: "plan", l: "Capteur plan" }, { v: "tubes", l: "Tubes sous vide" }] },
      { key: "col_area", label: "Surface d'entrée d'un capteur", unit: "m²", type: "number" },
      { key: "eta0", label: "Rendement optique η0", type: "number" }, { key: "a1", label: "Coefficient a1", unit: "W/(m²·K)", type: "number" }, { key: "a2", label: "Coefficient a2", unit: "W/(m²·K²)", type: "number" },
    ] },
    { title: "4. Ballon, circuit, économies", fields: [
      { key: "circulation", label: "Circulation", type: "select", options: [{ v: "thermosiphon", l: "Thermosiphon" }, { v: "forcee", l: "Circulation forcée" }] },
      { key: "tank_ratio", label: "Volume de stockage par litre consommé", type: "number", hint: "Ex. 1 = volume du ballon égal à la consommation journalière (choix de conception)" },
      { key: "ua_tank", label: "Coefficient de pertes du ballon UA", unit: "W/K", type: "number", hint: "Fiche du ballon" },
      { key: "flow_spec", label: "Débit spécifique du circuit primaire", unit: "L/(h·m²)", type: "number", hint: "Recommandation du fabricant du capteur" },
      { key: "v_pipe", label: "Vitesse visée dans les conduites", unit: "m/s", type: "number" },
      { key: "dp", label: "Perte de charge du circuit primaire", unit: "kPa", type: "number", optional: true }, { key: "eta_pump", label: "Rendement du circulateur", unit: "%", type: "number", optional: true },
      { key: "price", label: "Prix de l'énergie d'appoint", unit: "FCFA/kWh", type: "number", optional: true }, { key: "eta_aux", label: "Rendement de l'appoint", unit: "%", type: "number", optional: true },
    ] },
  ],
  example: {
    lat: 14.69, lon: -17.44, ghi: [5.2, 6, 6.7, 6.9, 6.8, 6.2, 5.6, 5.3, 5.4, 5.5, 5.2, 4.9], tmean: [22, 22, 23, 23, 24, 26, 27, 27, 28, 28, 26, 24], tilt: 20, azimuth: 0, albedo: 0.2, sun_hours: 8,
    volume: 200, t_hot: 50, t_cold: [22, 21, 21, 21, 22, 24, 26, 27, 27, 27, 25, 23], coverage: 80, design_month: 12,
    col_type: "plan", col_area: 2, eta0: 0.78, a1: 3.8, a2: 0.015, circulation: "thermosiphon", tank_ratio: 1, ua_tank: 1.8, flow_spec: 50, v_pipe: 0.5, price: 120, eta_aux: 95,
  },
  run: (input): StudyResult => {
    const res = empty();
    const lat = num(input.lat), ghi = months(input.ghi), ta = months(input.tmean), tilt = num(input.tilt), az = num(input.azimuth), alb = num(input.albedo), sh = num(input.sun_hours);
    const vol = num(input.volume), tHot = num(input.t_hot), tCold = months(input.t_cold), cov = pct(num(input.coverage)), dm = num(input.design_month);
    const ca = num(input.col_area), eta0 = num(input.eta0), a1 = num(input.a1), a2 = num(input.a2);
    const tr = num(input.tank_ratio), ua = num(input.ua_tank), fs = num(input.flow_spec), vp = num(input.v_pipe);
    req(res, lat, "latitude", { min: -66, max: 66 });
    for (const [arr, n] of [[ghi, "irradiation des 12 mois"], [ta, "température ambiante des 12 mois"], [tCold, "température de l'eau froide des 12 mois"]] as const) if (arr.length !== 12 || arr.some((x) => x == null)) res.missing.push(n);
    req(res, tilt, "inclinaison (°)", { min: 0, max: 90 }); req(res, az, "azimut (°)", { min: -180, max: 180 }); req(res, alb, "albédo", { min: 0, max: 1 }); req(res, sh, "durée de captage (h)", { positive: true, max: 14 });
    req(res, vol, "consommation d'eau chaude (L/j)", { positive: true }); req(res, tHot, "température de l'eau chaude (°C)", { positive: true, max: 95 });
    req(res, num(input.coverage), "couverture visée (%)", { positive: true, max: 100 }); req(res, dm, "mois de dimensionnement", { min: 1, max: 12 });
    req(res, ca, "surface d'un capteur (m²)", { positive: true }); req(res, eta0, "rendement optique η0", { positive: true, max: 1 }); req(res, a1, "coefficient a1", { min: 0 }); req(res, a2, "coefficient a2", { min: 0 });
    req(res, tr, "volume de stockage par litre consommé", { positive: true, max: 5 }); req(res, ua, "UA du ballon (W/K)", { min: 0 }); req(res, fs, "débit spécifique (L/(h·m²))", { positive: true }); req(res, vp, "vitesse dans les conduites (m/s)", { positive: true });
    if (res.missing.length) return finish(res);
    const geo = monthlyPoa({ lat: lat!, ghi: ghi as number[], tilt: tilt!, azimuth: az!, albedo: alb! });
    res.warnings.push(...geo.warnings);
    const tm = (m: number) => (tHot! + (tCold[m] as number)) / 2;
    const rows = geo.months.map((g, m) => {
      const need = (vol! * CP_WATER * (tHot! - (tCold[m] as number))) / 3.6e6; // kWh/j
      const gMean = (g.poa * 1000) / sh!; // W/m²
      const dT = tm(m) - (ta[m] as number);
      const eta = Math.max(0, eta0! - (a1! * dT) / gMean - (a2! * dT * dT) / gMean);
      return { m: m + 1, need, poa: g.poa, gMean, eta, yieldM2: eta * g.poa };
    });
    const d = rows[dm! - 1];
    if (d.yieldM2 <= 0) { res.warnings.push("Rendement nul au mois de dimensionnement : capteur inadapté à ces températures"); return finish(res); }
    const area = (cov! * d.need) / d.yieldM2;
    const nCol = Math.ceil(area / ca!);
    const aInst = nCol * ca!;
    res.steps.push({ title: "1. Besoins et rendement mensuel du capteur", lines: rows.map((r) => ({ label: `Mois ${r.m}`, value: `besoin ${r2(r.need, 3)} kWh/j ; η = ${r2(100 * r.eta, 3)} % ; ${r2(r.yieldM2, 3)} kWh/m²/j`, formula: `G = ${r2(r.gMean, 3)} W/m² ; η = η0 − a1 ΔT/G − a2 ΔT²/G` })) });
    res.steps.push({ title: "2. Surface de capteurs", lines: [
      { label: "Besoin du mois de dimensionnement", value: r2(d.need, 4), unit: "kWh/j", formula: "V ρ cp (Tc − Tf)" },
      { label: "Surface nécessaire", value: r2(area, 4), unit: "m²", formula: "couverture × besoin / (η H_T)" }, { label: "Nombre de capteurs", value: nCol }, { label: "Surface installée", value: r2(aInst, 4), unit: "m²" },
    ] });
    const tank = vol! * tr!;
    const lossDay = (ua! * (tHot! - (ta.reduce((a, b) => a! + b!, 0)! / 12)) * 24) / 1000;
    let yearNeed = 0, yearSolar = 0;
    const cover = rows.map((r, i) => { const solar = Math.max(0, Math.min(r.need, aInst * r.yieldM2 - lossDay)); yearNeed += r.need * MONTH_DAYS[i]; yearSolar += solar * MONTH_DAYS[i]; return { label: `Mois ${r.m}`, value: r2((100 * solar) / r.need, 3), unit: "%" }; });
    res.steps.push({ title: "3. Couverture solaire mensuelle (pertes du ballon déduites)", lines: [...cover, { label: "Besoin annuel", value: r2(yearNeed, 4), unit: "kWh/an" }, { label: "Apport solaire annuel", value: r2(yearSolar, 4), unit: "kWh/an" }, { label: "Couverture annuelle", value: r2((100 * yearSolar) / yearNeed, 3), unit: "%" }] });
    const flowLh = fs! * aInst;
    const dPipe = 1000 * Math.sqrt((4 * flowLh / 3.6e6) / (Math.PI * vp!));
    const circ: StudyResult["steps"][number]["lines"] = [{ label: "Volume du ballon", value: r2(tank, 4), unit: "L" }, { label: "Pertes du ballon", value: r2(lossDay, 4), unit: "kWh/j", formula: "UA (Tc − Ta) × 24 h" }, { label: "Débit du circuit primaire", value: r2(flowLh, 4), unit: "L/h", formula: "débit spécifique × surface" }, { label: "Diamètre intérieur de conduite", value: r2(dPipe, 3), unit: "mm", formula: "√(4Q / (π v))" }];
    const forced = input.circulation === "forcee";
    let pPump = 0;
    if (forced) { const dp = num(input.dp), ep = pct(num(input.eta_pump)); if (req(res, dp, "perte de charge du circuit (kPa)", { positive: true }) && req(res, num(input.eta_pump), "rendement du circulateur (%)", { positive: true, max: 100 })) { pPump = ((flowLh / 3.6e6) * dp * 1000) / ep!; circ.push({ label: "Puissance du circulateur", value: r2(pPump, 3), unit: "W", formula: "Q Δp / η" }); } }
    else res.assumptions.push("Thermosiphon : ballon placé au-dessus des capteurs ; débit naturel non calculé (conception selon le fabricant)");
    res.steps.push({ title: "4. Ballon et circuit", lines: circ });
    const price = num(input.price), etaAux = pct(num(input.eta_aux));
    if (price != null && etaAux) res.steps.push({ title: "5. Économies", lines: [{ label: "Énergie d'appoint évitée", value: r2(yearSolar / etaAux, 4), unit: "kWh/an", formula: "apport solaire / η appoint" }, { label: "Économie annuelle", value: Math.round((yearSolar / etaAux) * price), unit: "FCFA/an" }] });
    if (res.missing.length) return finish(res);
    const bom: BomLine[] = [
      { name: input.col_type === "tubes" ? "Capteur à tubes sous vide" : "Capteur solaire plan", qty: nCol, unit: "u", spec: `${ca} m², η0 = ${eta0}, a1 = ${a1}, a2 = ${a2}` },
      { name: "Ballon de stockage solaire", qty: 1, unit: "u", spec: `${r2(tank, 4)} L, UA ≤ ${ua} W/K` },
      { name: "Soupape de sécurité", qty: 1, unit: "u", spec: "tarage selon la pression de service du ballon" },
      { name: "Tube cuivre", qty: 1, unit: "lot", spec: `diamètre intérieur ≥ ${r2(dPipe, 3)} mm` }, { name: "Isolant de tuyauterie", qty: 1, unit: "lot", spec: "circuit primaire et départ d'eau chaude" },
      { name: "Structure de support PV", qty: 1, unit: "u", spec: `support de capteurs, ${tilt}°` },
    ];
    if (forced) bom.push({ name: "Circulateur", qty: 1, unit: "u", spec: `${r2(flowLh / 1000, 3)} m³/h` }, { name: "Régulation différentielle solaire", qty: 1, unit: "u", spec: "" }, { name: "Vase d'expansion / réservoir à vessie", qty: 1, unit: "u", spec: "volume selon le fluide et le circuit (fabricant)" });
    res.bom = bom;
    res.references.push("Rendement instantané du capteur : η = η0 − a1 ΔT/G − a2 ΔT²/G (coefficients d'essai normalisés du capteur, ISO 9806)", "Irradiation sur plan incliné : modèle mensuel isotrope (voir logiciel photovoltaïque)", "cp de l'eau 4186 J/(kg·K), masse volumique 1 kg/L");
    res.assumptions.push("Éclairement moyen pendant le captage = H_T / durée de captage ; température moyenne du capteur = (Tc + Tf)/2 — méthode simplifiée (estimation)");
    res.summary = [{ label: "Capteurs", value: `${nCol} (${r2(aInst, 3)} m²)` }, { label: "Ballon", value: r2(tank, 4), unit: "L" }, { label: "Couverture annuelle", value: r2((100 * yearSolar) / yearNeed, 3), unit: "%" }];
    return finish(res);
  },
};
