/**
 * Logiciel « Biomasse et bioénergie » — moteur pur.
 * Méthanisation : matières sèches et volatiles, production de biogaz et de méthane d'après les potentiels SAISIS
 * (analyse de laboratoire ou référence documentée), volume du digesteur (temps de séjour), charge organique, besoins
 * de chauffage, stockage, valorisation (chaleur, cogénération), digestat. Combustion : énergie d'une biomasse solide
 * d'après son PCI sec et son humidité. Aucun potentiel méthanogène ni pouvoir calorifique n'est supposé.
 */
import { CP_WATER, LHV_CH4, RHO_CH4, RHO_CO2 } from "./thermo";
import { empty, finish, num, r2, req, rows, type BomLine, type Software, type StudyResult } from "./types";

const pct = (v: number | null) => (v == null ? null : v / 100);

export const BIOMASS: Software = {
  key: "biomasse-biogaz", title: "Biomasse et biogaz : méthanisation, digesteur, valorisation, combustion", discipline: "environnement", lab: "solar",
  summary: "Méthanisation (déchets agricoles, d'élevage, agroalimentaires) : matière volatile, biogaz et méthane, digesteur (temps de séjour, charge organique), chauffage, stockage, chaleur et électricité, digestat ; combustion d'une biomasse solide ; bilan énergétique, nomenclature et rapport.",
  sections: [
    { title: "1. Intrants", fields: [
      { key: "feeds", label: "Substrats", type: "rows", cols: [
        { key: "name", label: "Substrat", type: "text" }, { key: "mass", label: "Apport", unit: "kg/j", type: "number" },
        { key: "ms", label: "Matière sèche MS", unit: "% brut", type: "number" }, { key: "mv", label: "Matière volatile MV", unit: "% MS", type: "number" },
        { key: "bmp", label: "Potentiel biogaz", unit: "Nm³/kg MV", type: "number", hint: "Analyse BMP ou référence" }, { key: "ch4", label: "Teneur en méthane", unit: "%", type: "number" },
      ] },
      { key: "water", label: "Eau de dilution ajoutée", unit: "L/j", type: "number" },
    ] },
    { title: "2. Digesteur", equipment: [{ label: "Digesteur", names: ["Digesteur de méthanisation"], map: { v: "v_dig" } }], fields: [
      { key: "hrt", label: "Temps de séjour hydraulique", unit: "j", type: "number" },
      { key: "olr_max", label: "Charge organique maximale admise", unit: "kg MV/(m³·j)", type: "number" },
      { key: "t_dig", label: "Température de fonctionnement", unit: "°C", type: "number" }, { key: "t_in", label: "Température des intrants", unit: "°C", type: "number" },
      { key: "ua", label: "Coefficient de pertes du digesteur UA", unit: "W/K", type: "number" }, { key: "t_amb", label: "Température ambiante", unit: "°C", type: "number" },
      { key: "storage_h", label: "Autonomie du stockage de biogaz", unit: "h", type: "number" },
    ] },
    { title: "3. Valorisation", fields: [
      { key: "use", label: "Usage du biogaz", type: "select", options: [{ v: "chp", l: "Cogénération (électricité + chaleur)" }, { v: "chaleur", l: "Chaleur (brûleur, cuisson)" }] },
      { key: "eta_el", label: "Rendement électrique du groupe", unit: "%", type: "number", optional: true }, { key: "eta_th", label: "Rendement thermique (groupe ou brûleur)", unit: "%", type: "number" },
      { key: "hours", label: "Heures de fonctionnement du groupe", unit: "h/j", type: "number", optional: true },
    ] },
    { title: "4. Combustion d'une biomasse solide (facultatif)", fields: [
      { key: "solid_mass", label: "Biomasse solide disponible", unit: "kg/j", type: "number", optional: true },
      { key: "solid_moisture", label: "Humidité (base humide)", unit: "%", type: "number", optional: true },
      { key: "pci_dry", label: "PCI sur sec", unit: "MJ/kg", type: "number", optional: true, hint: "Analyse calorimétrique ou référence" },
      { key: "eta_boiler", label: "Rendement de la chaudière", unit: "%", type: "number", optional: true },
    ] },
  ],
  example: {
    feeds: [{ name: "Bouse de bovins (exemple)", mass: 500, ms: 12, mv: 80, bmp: 0.3, ch4: 60 }, { name: "Déchets de marché (exemple)", mass: 200, ms: 15, mv: 85, bmp: 0.6, ch4: 58 }],
    water: 200, hrt: 40, olr_max: 3, t_dig: 37, t_in: 25, ua: 60, t_amb: 25, storage_h: 12, use: "chp", eta_el: 28, eta_th: 50, hours: 8,
  },
  run: (input): StudyResult => {
    const res = empty();
    const feeds = rows(input.feeds);
    if (!feeds.length) res.missing.push("au moins un substrat");
    let mIn = 0, ms = 0, mv = 0, biogas = 0, ch4 = 0;
    const lines: StudyResult["steps"][number]["lines"] = [];
    feeds.forEach((f, i) => {
      const n = String(f.name || `Substrat ${i + 1}`), m = num(f.mass), s = pct(num(f.ms)), v = pct(num(f.mv)), b = num(f.bmp), c = pct(num(f.ch4));
      if (!req(res, m, `${n} : apport (kg/j)`, { min: 0 }) || !req(res, num(f.ms), `${n} : matière sèche (%)`, { positive: true, max: 100 }) || !req(res, num(f.mv), `${n} : matière volatile (% MS)`, { positive: true, max: 100 }) || !req(res, b, `${n} : potentiel biogaz (Nm³/kg MV)`, { positive: true, max: 1.5 }) || !req(res, num(f.ch4), `${n} : teneur en méthane (%)`, { positive: true, max: 100 })) return;
      const mvi = m * s! * v!, gi = mvi * b;
      mIn += m; ms += m * s!; mv += mvi; biogas += gi; ch4 += gi * c!;
      lines.push({ label: `${n} : matière volatile`, value: r2(mvi, 4), unit: "kg MV/j", formula: "m × MS × MV" }, { label: `${n} : biogaz`, value: r2(gi, 4), unit: "Nm³/j", formula: "MV × potentiel" });
    });
    const water = num(input.water), hrt = num(input.hrt), olrMax = num(input.olr_max), tDig = num(input.t_dig), tIn = num(input.t_in), ua = num(input.ua), tAmb = num(input.t_amb), stH = num(input.storage_h), etaTh = pct(num(input.eta_th));
    req(res, water, "eau de dilution (L/j)", { min: 0 }); req(res, hrt, "temps de séjour (j)", { positive: true }); req(res, olrMax, "charge organique maximale (kg MV/m³/j)", { positive: true });
    req(res, tDig, "température du digesteur (°C)"); req(res, tIn, "température des intrants (°C)"); req(res, ua, "coefficient UA du digesteur (W/K)", { min: 0 }); req(res, tAmb, "température ambiante (°C)"); req(res, stH, "autonomie du stockage (h)", { min: 0 });
    req(res, num(input.eta_th), "rendement thermique (%)", { positive: true, max: 100 });
    const chp = input.use !== "chaleur";
    if (chp) { req(res, num(input.eta_el), "rendement électrique du groupe (%)", { positive: true, max: 60 }); req(res, num(input.hours), "heures de fonctionnement du groupe (h/j)", { positive: true, max: 24 }); }
    if (res.missing.length) return finish(res);
    const ch4Pct = ch4 / biogas;
    res.steps.push({ title: "1. Intrants et production", lines: [...lines,
      { label: "Apport total", value: r2(mIn + water!, 4), unit: "kg/j", formula: "intrants + eau" }, { label: "Matière sèche", value: r2(ms, 4), unit: "kg/j" }, { label: "Matière volatile", value: r2(mv, 4), unit: "kg MV/j" },
      { label: "Teneur en MS du mélange", value: r2((100 * ms) / (mIn + water!), 3), unit: "%" },
      { label: "Biogaz", value: r2(biogas, 4), unit: "Nm³/j" }, { label: "Méthane", value: r2(ch4, 4), unit: "Nm³/j" }, { label: "Teneur moyenne en méthane", value: r2(100 * ch4Pct, 3), unit: "%" },
    ] });
    // Digesteur
    const qIn = (mIn + water!) / 1000; // m³/j (masse volumique des intrants prise à 1000 kg/m³)
    const vHrt = qIn * hrt!;
    const vOlr = mv / olrMax!;
    const vDig = Math.max(vHrt, vOlr);
    const heat = ((mIn + water!) * CP_WATER * (tDig! - tIn!)) / 3.6e6 + (ua! * (tDig! - tAmb!) * 24) / 1000; // kWh/j
    res.steps.push({ title: "2. Digesteur", lines: [
      { label: "Débit d'intrants", value: r2(qIn, 4), unit: "m³/j", formula: "masse volumique prise à 1000 kg/m³" },
      { label: "Volume pour le temps de séjour", value: r2(vHrt, 4), unit: "m³", formula: "Q × TSH" },
      { label: "Volume pour la charge organique", value: r2(vOlr, 4), unit: "m³", formula: "MV / Cv,max" },
      { label: "Volume utile retenu", value: r2(vDig, 4), unit: "m³", formula: "max des deux" },
      { label: "Charge organique obtenue", value: r2(mv / vDig, 3), unit: "kg MV/(m³·j)" },
      { label: "Besoin de chauffage", value: r2(heat, 4), unit: "kWh/j", formula: "m cp (Td − Te) + UA (Td − Ta) × 24 h" },
      { label: "Stockage de biogaz", value: r2((biogas * stH!) / 24, 4), unit: "m³", formula: "production × autonomie" },
    ] });
    // Valorisation
    const eCh4 = (ch4 * LHV_CH4) / 3.6; // kWh/j
    const vlines: StudyResult["steps"][number]["lines"] = [{ label: "Énergie primaire du méthane", value: r2(eCh4, 4), unit: "kWh/j", formula: `CH4 × PCI (${LHV_CH4} MJ/Nm³)` }];
    let netHeat: number;
    if (chp) {
      const etaEl = pct(num(input.eta_el))!, h = num(input.hours)!;
      const el = eCh4 * etaEl, th = eCh4 * etaTh!;
      netHeat = th - heat;
      vlines.push({ label: "Électricité produite", value: r2(el, 4), unit: "kWh/j" }, { label: "Puissance électrique du groupe", value: r2(el / h, 4), unit: "kW", formula: "E / heures de marche" }, { label: "Chaleur récupérée", value: r2(th, 4), unit: "kWh/j" });
    } else { const th = eCh4 * etaTh!; netHeat = th - heat; vlines.push({ label: "Chaleur utile", value: r2(th, 4), unit: "kWh/j" }); }
    vlines.push({ label: "Chaleur nette après chauffage du digesteur", value: r2(netHeat, 4), unit: "kWh/j" });
    if (netHeat < 0) res.warnings.push("La chaleur produite ne couvre pas le chauffage du digesteur : isolation, apport externe ou fonctionnement à plus basse température");
    res.steps.push({ title: "3. Valorisation énergétique", lines: vlines });
    // Digestat
    const gasMass = biogas * (ch4Pct * RHO_CH4 + (1 - ch4Pct) * RHO_CO2);
    res.steps.push({ title: "4. Digestat", lines: [{ label: "Masse de biogaz", value: r2(gasMass, 4), unit: "kg/j", formula: "CH4 × 0,717 + CO2 × 1,977 (kg/Nm³)" }, { label: "Digestat", value: r2(mIn + water! - gasMass, 4), unit: "kg/j", formula: "entrées − biogaz" }] });
    res.assumptions.push("Biogaz assimilé à un mélange CH4 + CO2 (H2S, vapeur d'eau négligés dans le bilan de masse)", "Potentiels biogaz et teneurs saisis par l'utilisateur (analyses ou références documentées)");
    res.references.push(`PCI du méthane ${LHV_CH4} MJ/Nm³ ; masses volumiques normales CH4 0,717 et CO2 1,977 kg/Nm³ ; cp de l'eau 4186 J/(kg·K)`);
    // Combustion (facultatif)
    const sm = num(input.solid_mass);
    if (sm != null) {
      const w = pct(num(input.solid_moisture)), pciD = num(input.pci_dry), eb = pct(num(input.eta_boiler));
      if (req(res, num(input.solid_moisture), "humidité de la biomasse solide (%)", { min: 0, max: 90 }) && req(res, pciD, "PCI sur sec (MJ/kg)", { positive: true, max: 30 }) && req(res, num(input.eta_boiler), "rendement de la chaudière (%)", { positive: true, max: 100 })) {
        const pciH = pciD * (1 - w!) - 2.443 * w!;
        res.steps.push({ title: "5. Combustion de biomasse solide", lines: [{ label: "PCI sur brut", value: r2(pciH, 4), unit: "MJ/kg", formula: "PCI_sec (1 − w) − 2,443 w" }, { label: "Énergie utile", value: r2((sm * pciH * eb!) / 3.6, 4), unit: "kWh/j", formula: "m × PCI × η" }] });
        res.references.push("Chaleur latente de vaporisation de l'eau à 25 °C : 2,443 MJ/kg");
      }
    }
    if (res.missing.length) return finish(res);
    const bom: BomLine[] = [
      { name: "Digesteur de méthanisation", qty: 1, unit: "u", spec: `${r2(vDig, 4)} m³ utiles, ${tDig} °C` },
      { name: "Gazomètre / stockage de biogaz", qty: 1, unit: "u", spec: `${r2((biogas * stH!) / 24, 4)} m³` },
      { name: "Agitateur de digesteur", qty: 1, unit: "u", spec: "" }, { name: "Broyeur de biomasse", qty: 1, unit: "u", spec: `${r2(mIn / 8, 3)} kg/h sur 8 h` },
      { name: "Filtre à H2S (épuration du biogaz)", qty: 1, unit: "u", spec: `${r2(biogas / 24, 3)} Nm³/h moyen` },
      chp ? { name: "Groupe électrogène à biogaz", qty: 1, unit: "u", spec: `${r2((eCh4 * pct(num(input.eta_el))!) / num(input.hours)!, 3)} kWe` } : { name: "Brûleur à biogaz", qty: 1, unit: "u", spec: `${r2(eCh4 * etaTh! / 24, 3)} kW moyen` },
      { name: "Torchère", qty: 1, unit: "u", spec: "sécurité (excédent de biogaz)" }, { name: "Échangeur à plaques", qty: 1, unit: "u", spec: `chauffage du digesteur ${r2(heat / 24, 3)} kW` },
      { name: "Capteur de pression", qty: 1, unit: "u", spec: "pression du biogaz" }, { name: "Sonde de température étanche", qty: 2, unit: "u", spec: "digesteur" }, { name: "Capteur de gaz", qty: 1, unit: "u", spec: "détection de fuite (prototype, non certifié ATEX)" },
    ];
    if (sm != null) bom.push({ name: "Chaudière à biomasse solide", qty: 1, unit: "u", spec: "" });
    res.bom = bom;
    res.warnings.push("Installation de biogaz : atmosphères explosives et H2S toxique — conception et exploitation selon la réglementation, matériel certifié ; un prototype pédagogique n'est pas un équipement de sécurité");
    res.summary = [{ label: "Biogaz", value: r2(biogas, 4), unit: "Nm³/j" }, { label: "Volume utile du digesteur", value: r2(vDig, 4), unit: "m³" }, { label: "Énergie du méthane", value: r2(eCh4, 4), unit: "kWh/j" }];
    return finish(res);
  },
};
