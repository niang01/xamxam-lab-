/**
 * Logiciels : électronique, électronique de puissance, automatisme, instrumentation, objet connecté (IoT),
 * technologies médicales (chaîne d'acquisition pédagogique). Moteurs purs ; aucune caractéristique de composant
 * n'est supposée (fiches techniques saisies).
 */
import { cylinderForce } from "@/lib/eng/mechanical";
import { CONDUCTORS } from "@/lib/eng/electrical";
import { empty, finish, grab, nearestE12, nextE12, nf, num, r2, req, rows, type BomLine, type Software, type StudyResult } from "./types";

const fmtR = (r: number) => (r >= 1e6 ? `${r2(r / 1e6, 3)} MΩ` : r >= 1e3 ? `${r2(r / 1e3, 3)} kΩ` : `${r2(r, 3)} Ω`);

export const ELECTRONICS: Software = {
  key: "electronique", title: "Électronique : alimentation régulée, LED, diviseur, filtre RC", discipline: "electronique", lab: "electronics",
  summary: "Conception de la partie alimentation et polarisation d'une carte : régulateur linéaire (dissipation, température de jonction, dissipateur), résistance de LED, pont diviseur et filtre RC avec valeurs normalisées E12.",
  sections: [
    { title: "1. Régulateur linéaire", equipment: [{ label: "Régulateur", names: ["Régulateur de tension linéaire"], map: {} }], fields: [nf("vin", "Tension d'entrée", "V"), nf("vout", "Tension de sortie", "V"), nf("iload", "Courant de charge", "A"), nf("dropout", "Tension de déchet (fiche)", "V"), nf("rth_ja", "Résistance thermique jonction-ambiance (fiche)", "°C/W"), nf("t_amb", "Température ambiante maximale", "°C"), nf("tj_max", "Température de jonction maximale (fiche)", "°C")] },
    { title: "2. LED", fields: [nf("led_vs", "Tension d'alimentation", "V"), nf("led_vf", "Tension directe de la LED (fiche)", "V"), nf("led_if", "Courant souhaité", "mA")] },
    { title: "3. Pont diviseur", fields: [nf("div_vin", "Tension à mesurer (maximum)", "V"), nf("div_vout", "Tension maximale admise par l'entrée", "V"), nf("div_r2", "Résistance basse choisie R2", "Ω")] },
    { title: "4. Filtre RC passe-bas", fields: [nf("rc_fc", "Fréquence de coupure visée", "Hz"), nf("rc_c", "Condensateur choisi", "nF")] },
  ],
  example: { vin: 12, vout: 5, iload: 0.3, dropout: 2, rth_ja: 65, t_amb: 40, tj_max: 125, led_vs: 5, led_vf: 2, led_if: 10, div_vin: 15, div_vout: 3.3, div_r2: 10000, rc_fc: 100, rc_c: 100 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { vin: ["tension d'entrée (V)", { positive: true }], vout: ["tension de sortie (V)", { positive: true }], iload: ["courant de charge (A)", { positive: true }], dropout: ["tension de déchet (V)", { min: 0 }], rth_ja: ["résistance thermique (°C/W)", { positive: true }], t_amb: ["température ambiante (°C)"], tj_max: ["température de jonction maximale (°C)", { positive: true }], led_vs: ["tension d'alimentation de la LED (V)", { positive: true }], led_vf: ["tension directe de la LED (V)", { positive: true }], led_if: ["courant de la LED (mA)", { positive: true }], div_vin: ["tension à mesurer (V)", { positive: true }], div_vout: ["tension admise (V)", { positive: true }], div_r2: ["résistance R2 (Ω)", { positive: true }], rc_fc: ["fréquence de coupure (Hz)", { positive: true }], rc_c: ["condensateur (nF)", { positive: true }] });
    if (res.missing.length) return finish(res);
    const p = (v.vin - v.vout) * v.iload, tj = v.t_amb + p * v.rth_ja, headroom = v.vin - v.vout - v.dropout;
    const rthMax = (v.tj_max - v.t_amb) / p;
    res.steps.push({ title: "1. Régulateur linéaire", ok: tj <= v.tj_max && headroom >= 0, lines: [
      { label: "Marge de tension", value: r2(headroom, 3), unit: "V", formula: "Vin − Vout − Vdéchet ≥ 0" },
      { label: "Puissance dissipée", value: r2(p, 3), unit: "W", formula: "(Vin − Vout) × I" },
      { label: "Température de jonction", value: r2(tj, 3), unit: "°C", formula: "Ta + P × Rth,ja" },
      { label: "Rth jonction-ambiance maximale admise", value: r2(rthMax, 3), unit: "°C/W", formula: "(Tj,max − Ta) / P" },
      { label: "Rendement", value: r2((100 * v.vout) / v.vin, 3), unit: "%", formula: "Vout / Vin (régulateur linéaire)" },
    ] });
    if (headroom < 0) res.warnings.push("Tension d'entrée insuffisante pour la régulation (tension de déchet)");
    if (tj > v.tj_max) res.warnings.push(`Dissipateur nécessaire : résistance thermique totale ≤ ${r2(rthMax, 3)} °C/W, ou convertisseur à découpage`);
    const rLed = ((v.led_vs - v.led_vf) / v.led_if) * 1000, rLedStd = nextE12(rLed), iReal = ((v.led_vs - v.led_vf) / rLedStd) * 1000;
    res.steps.push({ title: "2. Résistance de LED", lines: [{ label: "Résistance calculée", value: fmtR(rLed), formula: "(Vs − Vf) / If" }, { label: "Valeur normalisée E12 (supérieure)", value: fmtR(rLedStd) }, { label: "Courant obtenu", value: r2(iReal, 3), unit: "mA" }, { label: "Puissance dans la résistance", value: r2((iReal / 1000) ** 2 * rLedStd * 1000, 3), unit: "mW" }] });
    const r1 = v.div_r2 * (v.div_vin / v.div_vout - 1), r1Std = nextE12(r1), vReal = (v.div_vin * v.div_r2) / (r1Std + v.div_r2);
    res.steps.push({ title: "3. Pont diviseur", ok: vReal <= v.div_vout, lines: [{ label: "R1 calculée", value: fmtR(r1), formula: "R2 (Vin / Vout − 1)" }, { label: "R1 normalisée E12 (supérieure, côté sûr)", value: fmtR(r1Std) }, { label: "Tension de sortie obtenue", value: r2(vReal, 4), unit: "V" }, { label: "Courant de pont", value: r2((v.div_vin / (r1Std + v.div_r2)) * 1e6, 3), unit: "µA" }] });
    const rRc = 1 / (2 * Math.PI * v.rc_fc * v.rc_c * 1e-9), rRcStd = nearestE12(rRc);
    res.steps.push({ title: "4. Filtre RC", lines: [{ label: "R calculée", value: fmtR(rRc), formula: "R = 1 / (2π fc C)" }, { label: "R normalisée E12", value: fmtR(rRcStd) }, { label: "Fréquence de coupure obtenue", value: r2(1 / (2 * Math.PI * rRcStd * v.rc_c * 1e-9), 4), unit: "Hz" }] });
    res.bom = [{ name: "Régulateur de tension linéaire", qty: 1, unit: "u", spec: `${v.vout} V, ≥ ${v.iload} A` }, { name: "Résistance", qty: 4, unit: "u", spec: `${fmtR(rLedStd)} ; ${fmtR(r1Std)} ; ${fmtR(v.div_r2)} ; ${fmtR(rRcStd)}` }, { name: "Condensateur", qty: 3, unit: "u", spec: `${v.rc_c} nF (filtre) + découplage du régulateur selon la fiche` }, { name: "LED", qty: 1, unit: "u", spec: `Vf ${v.led_vf} V` }, ...(tj > v.tj_max ? [{ name: "Radiateur (dissipateur thermique)", qty: 1, unit: "u", spec: `Rth totale ≤ ${r2(rthMax, 3)} °C/W` }] : [])];
    res.references.push("Série E12 : CEI 60063", "Modèle thermique : Tj = Ta + P × Rth (fiche du composant)");
    res.summary = [{ label: "Dissipation du régulateur", value: r2(p, 3), unit: "W" }, { label: "Température de jonction", value: r2(tj, 3), unit: "°C" }, { label: "Résistance de LED", value: fmtR(rLedStd) }];
    res.diagram = null;
    return finish(res);
  },
};

export const POWER: Software = {
  key: "electronique-puissance", title: "Électronique de puissance : redresseur filtré, hacheur abaisseur", discipline: "puissance", lab: "electronics",
  summary: "Redresseur en pont avec condensateur de filtrage (tension crête, ondulation, capacité, tension inverse des diodes) et hacheur abaisseur (rapport cyclique, inductance, condensateur, courants crête).",
  sections: [
    { title: "1. Redresseur en pont filtré", fields: [nf("vac", "Tension alternative efficace au secondaire", "V"), nf("f", "Fréquence du réseau", "Hz"), nf("idc", "Courant continu demandé", "A"), nf("ripple", "Ondulation crête-à-crête admise", "V"), nf("vf", "Chute de tension d'une diode (fiche)", "V")] },
    { title: "2. Hacheur abaisseur (buck)", fields: [nf("bvin", "Tension d'entrée", "V"), nf("bvout", "Tension de sortie", "V"), nf("biout", "Courant de sortie", "A"), nf("fsw", "Fréquence de découpage", "kHz"), nf("kr", "Ondulation de courant (fraction de Iout)", "", { hint: "Choix de conception, ex. 0,3" }), nf("dvout", "Ondulation de tension admise", "mV"), nf("eta", "Rendement estimé (fiche du contrôleur)", "%")] },
  ],
  example: { vac: 12, f: 50, idc: 1, ripple: 1, vf: 0.9, bvin: 24, bvout: 5, biout: 2, fsw: 200, kr: 0.3, dvout: 20, eta: 90 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { vac: ["tension efficace (V)", { positive: true }], f: ["fréquence (Hz)", { positive: true }], idc: ["courant continu (A)", { positive: true }], ripple: ["ondulation admise (V)", { positive: true }], vf: ["chute de tension d'une diode (V)", { min: 0 }], bvin: ["tension d'entrée du hacheur (V)", { positive: true }], bvout: ["tension de sortie du hacheur (V)", { positive: true }], biout: ["courant de sortie (A)", { positive: true }], fsw: ["fréquence de découpage (kHz)", { positive: true }], kr: ["ondulation de courant (fraction)", { positive: true, max: 1 }], dvout: ["ondulation de tension (mV)", { positive: true }], eta: ["rendement (%)", { positive: true, max: 100 }] });
    if (!res.missing.length && v.bvout >= v.bvin) res.missing.push("tension de sortie inférieure à la tension d'entrée (hacheur abaisseur)");
    if (res.missing.length) return finish(res);
    const vpk = Math.SQRT2 * v.vac - 2 * v.vf, c = v.idc / (2 * v.f * v.ripple), vdc = vpk - v.ripple / 2;
    res.steps.push({ title: "1. Redresseur en pont filtré", lines: [
      { label: "Tension crête redressée", value: r2(vpk, 4), unit: "V", formula: "√2 Veff − 2 Vf" }, { label: "Capacité de filtrage", value: r2(c * 1e6, 4), unit: "µF", formula: "C = I / (2 f ΔV)" },
      { label: "Tension continue moyenne", value: r2(vdc, 4), unit: "V", formula: "Vcrête − ΔV/2" }, { label: "Tension inverse sur chaque diode", value: r2(Math.SQRT2 * v.vac, 4), unit: "V", formula: "√2 Veff (choisir une marge selon la fiche)" },
      { label: "Courant moyen par diode", value: r2(v.idc / 2, 3), unit: "A" },
    ] });
    const d = v.bvout / v.bvin, di = v.kr * v.biout, fs = v.fsw * 1000;
    const l = ((v.bvin - v.bvout) * d) / (fs * di), cOut = di / (8 * fs * v.dvout / 1000);
    res.steps.push({ title: "2. Hacheur abaisseur", lines: [
      { label: "Rapport cyclique (idéal)", value: r2(d, 3), formula: "D = Vout / Vin" }, { label: "Ondulation de courant", value: r2(di, 3), unit: "A", formula: "ΔI = k × Iout" },
      { label: "Inductance", value: r2(l * 1e6, 4), unit: "µH", formula: "L = (Vin − Vout) D / (f ΔI)" }, { label: "Courant crête de l'inductance", value: r2(v.biout + di / 2, 3), unit: "A", formula: "Iout + ΔI/2 (courant de saturation de L supérieur)" },
      { label: "Condensateur de sortie (capacitif seul)", value: r2(cOut * 1e6, 4), unit: "µF", formula: "C = ΔI / (8 f ΔV) — la résistance série du condensateur s'ajoute" },
      { label: "Puissance d'entrée", value: r2((v.bvout * v.biout) / (v.eta / 100), 4), unit: "W", formula: "Pout / η" }, { label: "Pertes", value: r2((v.bvout * v.biout) / (v.eta / 100) - v.bvout * v.biout, 4), unit: "W" },
    ] });
    res.bom = [{ name: "Pont de diodes (redresseur)", qty: 1, unit: "u", spec: `PIV ≥ ${r2(Math.SQRT2 * v.vac * 1.5, 3)} V (marge 1,5), I ≥ ${v.idc} A` }, { name: "Condensateur", qty: 2, unit: "u", spec: `≥ ${r2(c * 1e6, 3)} µF / ${r2(vpk * 1.25, 3)} V ; ≥ ${r2(cOut * 1e6, 3)} µF faible ESR` }, { name: "Hacheur (convertisseur DC-DC)", qty: 1, unit: "u", spec: `${v.bvin} → ${v.bvout} V, ${v.biout} A, ${v.fsw} kHz` }, { name: "Inductance de lissage", qty: 1, unit: "u", spec: `${r2(l * 1e6, 3)} µH, Isat > ${r2(v.biout + di / 2, 3)} A` }, { name: "Radiateur (dissipateur thermique)", qty: 1, unit: "u", spec: "selon les pertes et la fiche" }];
    res.assumptions.push("Hacheur en conduction continue, composants idéaux pour D ; pertes globales via le rendement saisi", "Filtrage : approximation de la décharge linéaire du condensateur");
    res.summary = [{ label: "Capacité de filtrage", value: r2(c * 1e6, 4), unit: "µF" }, { label: "Inductance du hacheur", value: r2(l * 1e6, 4), unit: "µH" }];
    return finish(res);
  },
};

export const AUTOMATION: Software = {
  key: "automatisme", title: "Automatisme : liste d'entrées/sorties, automate, alimentation 24 V, air comprimé", discipline: "automatisme", lab: "electrical",
  summary: "Liste d'entrées/sorties et nombre de modules d'automate (réserve incluse), alimentation 24 V DC, vérins pneumatiques : efforts, consommation d'air et débit du compresseur ; schéma pneumatique et nomenclature.",
  sections: [
    { title: "1. Entrées / sorties", fields: [
      { key: "io", label: "Points d'entrées/sorties", type: "rows", cols: [{ key: "name", label: "Désignation", type: "text" }, { key: "type", label: "Type", type: "select", options: [{ v: "DI", l: "Entrée TOR" }, { v: "DO", l: "Sortie TOR" }, { v: "AI", l: "Entrée analogique" }, { v: "AO", l: "Sortie analogique" }] }, { key: "qty", label: "Nombre", type: "int" }] },
      nf("spare", "Réserve", "%"), nf("ch_di", "Voies par module DI", ""), nf("ch_do", "Voies par module DO", ""), nf("ch_ai", "Voies par module AI", ""), nf("ch_ao", "Voies par module AO", ""),
    ] },
    { title: "2. Alimentation 24 V", fields: [nf("i_di", "Courant par entrée TOR", "mA"), nf("i_do", "Courant par sortie TOR (charge)", "mA"), nf("p_other", "Autres consommateurs 24 V (CPU, IHM, capteurs)", "W"), nf("margin", "Marge de dimensionnement", "%")] },
    { title: "3. Vérins pneumatiques", fields: [
      { key: "cyl", label: "Vérins double effet", type: "rows", cols: [{ key: "name", label: "Vérin", type: "text" }, { key: "bore", label: "Alésage", unit: "mm", type: "number" }, { key: "rod", label: "Tige", unit: "mm", type: "number" }, { key: "stroke", label: "Course", unit: "mm", type: "number" }, { key: "cpm", label: "Cycles par minute", type: "number" }, { key: "qty", label: "Nombre", type: "int" }] },
      nf("pressure", "Pression de service", "bar"), nf("eta_cyl", "Rendement des vérins (fiche)", "%"), nf("air_margin", "Marge sur le débit d'air (fuites)", "%"),
    ] },
  ],
  example: { io: [{ name: "Capteurs de fin de course", type: "DI", qty: 12 }, { name: "Boutons et arrêt d'urgence", type: "DI", qty: 6 }, { name: "Électrovannes", type: "DO", qty: 8 }, { name: "Voyants", type: "DO", qty: 4 }, { name: "Pression, niveau", type: "AI", qty: 3 }, { name: "Consigne variateur", type: "AO", qty: 1 }], spare: 20, ch_di: 16, ch_do: 16, ch_ai: 4, ch_ao: 2, i_di: 6, i_do: 300, p_other: 40, margin: 25, cyl: [{ name: "Serrage", bore: 32, rod: 12, stroke: 100, cpm: 6, qty: 2 }, { name: "Transfert", bore: 50, rod: 20, stroke: 250, cpm: 4, qty: 1 }], pressure: 6, eta_cyl: 85, air_margin: 30 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { spare: ["réserve (%)", { min: 0, max: 100 }], ch_di: ["voies par module DI", { positive: true }], ch_do: ["voies par module DO", { positive: true }], ch_ai: ["voies par module AI", { positive: true }], ch_ao: ["voies par module AO", { positive: true }], i_di: ["courant par entrée (mA)", { min: 0 }], i_do: ["courant par sortie (mA)", { min: 0 }], p_other: ["autres consommateurs (W)", { min: 0 }], margin: ["marge d'alimentation (%)", { min: 0 }], pressure: ["pression de service (bar)", { positive: true }], eta_cyl: ["rendement des vérins (%)", { positive: true, max: 100 }], air_margin: ["marge sur le débit d'air (%)", { min: 0 }] });
    const io = rows(input.io); if (!io.length) res.missing.push("au moins un point d'entrée/sortie");
    if (res.missing.length) return finish(res);
    const tot: Record<string, number> = { DI: 0, DO: 0, AI: 0, AO: 0 };
    for (const x of io) { const q = num(x.qty); if (req(res, q, `${x.name || "point"} : nombre`, { min: 0 })) tot[String(x.type || "DI")] = (tot[String(x.type || "DI")] ?? 0) + q; }
    const ch: Record<string, number> = { DI: v.ch_di, DO: v.ch_do, AI: v.ch_ai, AO: v.ch_ao };
    const withSpare = (n: number) => Math.ceil(n * (1 + v.spare / 100));
    const mods = Object.fromEntries(Object.keys(tot).map((k) => [k, Math.ceil(withSpare(tot[k]) / ch[k])]));
    res.steps.push({ title: "1. Entrées / sorties et modules", lines: Object.keys(tot).map((k) => ({ label: `${k} : ${tot[k]} points → ${withSpare(tot[k])} avec réserve`, value: mods[k], unit: "module(s)", formula: `⌈N × (1 + réserve) / ${ch[k]}⌉` })) });
    const p24 = (withSpare(tot.DI) * v.i_di + tot.DO * v.i_do) * 24 / 1000 + v.p_other, pPsu = p24 * (1 + v.margin / 100);
    res.steps.push({ title: "2. Alimentation 24 V DC", lines: [{ label: "Puissance appelée", value: r2(p24, 4), unit: "W", formula: "(n_DI × I_DI + n_DO × I_DO) × 24 V + autres" }, { label: "Puissance de l'alimentation", value: r2(pPsu, 4), unit: "W", formula: "× (1 + marge)" }, { label: "Courant", value: r2(pPsu / 24, 3), unit: "A" }] });
    const cyl = rows(input.cyl);
    let qTot = 0;
    const clines: StudyResult["steps"][number]["lines"] = [];
    for (const c of cyl) {
      const n = String(c.name || "vérin"), d = num(c.bore), r = num(c.rod), s = num(c.stroke), cpm = num(c.cpm), q = num(c.qty);
      if (!req(res, d, `${n} : alésage`, { positive: true }) || !req(res, r, `${n} : tige`, { positive: true }) || !req(res, s, `${n} : course`, { positive: true }) || !req(res, cpm, `${n} : cycles/min`, { min: 0 }) || !req(res, q, `${n} : nombre`, { min: 0 })) continue;
      const vCycle = (Math.PI / 4) * ((d / 1000) ** 2 * (s / 1000) + ((d / 1000) ** 2 - (r / 1000) ** 2) * (s / 1000)); // m³
      const free = vCycle * ((v.pressure + 1.013) / 1.013) * 1000; // L d'air libre
      qTot += free * cpm * q;
      const f = cylinderForce({ pressureBar: v.pressure, boreMm: d, efficiency: v.eta_cyl / 100 });
      clines.push({ label: `${n} : effort en poussée`, value: f.outputs.f?.value ?? "—", unit: f.outputs.f?.unit ?? "", formula: "F = p × π D²/4 × η" }, { label: `${n} : air libre par cycle`, value: r2(free, 4), unit: "L", formula: "V (aller + retour) × (p + 1,013) / 1,013" });
    }
    if (cyl.length) res.steps.push({ title: "3. Air comprimé", lines: [...clines, { label: "Consommation totale", value: r2(qTot, 4), unit: "L/min (air libre)" }, { label: "Débit du compresseur", value: r2(qTot * (1 + v.air_margin / 100), 4), unit: "L/min", formula: "× (1 + marge fuites)" }] });
    if (res.missing.length) return finish(res);
    res.bom = [{ name: "Automate programmable (API)", qty: 1, unit: "u", spec: "UC + emplacements pour les modules" }, { name: "Module d'entrées TOR", qty: mods.DI, unit: "u", spec: `${v.ch_di} voies` }, { name: "Module de sorties TOR", qty: mods.DO, unit: "u", spec: `${v.ch_do} voies` }, { name: "Module d'entrées analogiques", qty: mods.AI, unit: "u", spec: `${v.ch_ai} voies` }, { name: "Module de sorties analogiques", qty: mods.AO, unit: "u", spec: `${v.ch_ao} voies` }, { name: "Alimentation 24 V DC", qty: 1, unit: "u", spec: `≥ ${r2(pPsu, 3)} W` }, ...(cyl.length ? [{ name: "Vérin pneumatique", qty: cyl.reduce((a, c) => a + (num(c.qty) ?? 0), 0), unit: "u", spec: "selon la liste" }, { name: "Distributeur pneumatique 5/2", qty: cyl.reduce((a, c) => a + (num(c.qty) ?? 0), 0), unit: "u", spec: "" }, { name: "Unité de traitement d'air (FRL)", qty: 1, unit: "u", spec: `${r2(qTot * (1 + v.air_margin / 100), 3)} L/min, ${v.pressure} bar` }] as BomLine[] : [])].filter((b) => b.qty > 0);
    res.references.push("Air libre ramené à la pression atmosphérique (1,013 bar absolu)");
    res.summary = [{ label: "Modules d'E/S", value: Object.values(mods).reduce((a, b) => a + b, 0) }, { label: "Alimentation 24 V", value: r2(pPsu, 3), unit: "W" }, { label: "Débit d'air", value: r2(qTot * (1 + v.air_margin / 100), 3), unit: "L/min" }];
    res.diagram = cyl.length ? { kind: "pneumatique_verin", params: {} } : null;
    return finish(res);
  },
};

export const INSTRUMENTATION: Software = {
  key: "instrumentation", title: "Instrumentation : boucle 4–20 mA, mise à l'échelle, incertitude de mesure", discipline: "instrumentation", lab: "electrical",
  summary: "Vérification d'une boucle de courant 4–20 mA (tension disponible, résistance de boucle), conversion courant ↔ grandeur et résolution de l'acquisition, budget d'incertitude composée et élargie (méthode du GUM).",
  sections: [
    { title: "1. Boucle 4–20 mA", fields: [nf("vs", "Tension de l'alimentation de boucle", "V"), nf("v_tx", "Tension minimale du transmetteur (fiche)", "V"), nf("r_in", "Résistance d'entrée du récepteur", "Ω"), nf("length", "Longueur du câble (aller)", "m"), nf("section", "Section des conducteurs", "mm²"), nf("r_other", "Autres résistances en série (barrière, afficheur)", "Ω")] },
    { title: "2. Mise à l'échelle et résolution", fields: [nf("range_min", "Début d'échelle"), nf("range_max", "Fin d'échelle"), { key: "unit", label: "Unité de la grandeur", type: "text" }, nf("i_meas", "Courant mesuré", "mA"), nf("adc_bits", "Résolution du convertisseur", "bits"), nf("adc_span", "Plage du convertisseur utilisée par 4–20 mA", "%", { hint: "Part des codes utilisés par 4–20 mA" })] },
    { title: "3. Budget d'incertitude", fields: [{ key: "u", label: "Sources", type: "rows", cols: [{ key: "name", label: "Source", type: "text" }, { key: "a", label: "Valeur (±)", type: "number" }, { key: "law", label: "Nature", type: "select", options: [{ v: "rect", l: "Limite (loi rectangulaire)" }, { v: "k2", l: "Incertitude élargie k = 2" }, { v: "std", l: "Écart-type" }] }] }] },
  ],
  example: { vs: 24, v_tx: 12, r_in: 250, length: 150, section: 0.75, r_other: 0, range_min: 0, range_max: 10, unit: "bar", i_meas: 13.6, adc_bits: 12, adc_span: 80, u: [{ name: "Transmetteur (fiche)", a: 0.05, law: "rect" }, { name: "Étalonnage", a: 0.02, law: "k2" }, { name: "Acquisition", a: 0.01, law: "rect" }] },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { vs: ["tension d'alimentation (V)", { positive: true }], v_tx: ["tension minimale du transmetteur (V)", { positive: true }], r_in: ["résistance d'entrée (Ω)", { min: 0 }], length: ["longueur du câble (m)", { min: 0 }], section: ["section (mm²)", { positive: true }], r_other: ["autres résistances (Ω)", { min: 0 }], range_min: ["début d'échelle"], range_max: ["fin d'échelle"], i_meas: ["courant mesuré (mA)", { min: 3, max: 22 }], adc_bits: ["résolution du convertisseur (bits)", { min: 6, max: 32 }], adc_span: ["plage utilisée (%)", { positive: true, max: 100 }] });
    if (res.missing.length) return finish(res);
    const rCable = (2 * v.length * CONDUCTORS.copper.rho20) / v.section, rLoop = rCable + v.r_in + v.r_other;
    const vNeed = v.v_tx + 0.02 * rLoop, rMax = (v.vs - v.v_tx) / 0.02;
    res.steps.push({ title: "1. Boucle 4–20 mA", ok: vNeed <= v.vs, lines: [{ label: "Résistance du câble (aller-retour, cuivre à 20 °C)", value: r2(rCable, 3), unit: "Ω", formula: "2 ρ L / S" }, { label: "Résistance totale de boucle", value: r2(rLoop, 4), unit: "Ω" }, { label: "Tension nécessaire à 20 mA", value: r2(vNeed, 4), unit: "V", formula: "V_tx + 0,020 × R_boucle" }, { label: "Résistance de boucle maximale", value: r2(rMax, 4), unit: "Ω", formula: "(Vs − V_tx) / 0,020" }] });
    if (vNeed > v.vs) res.warnings.push("Tension de boucle insuffisante à 20 mA : réduire la résistance de boucle ou augmenter l'alimentation");
    const span = v.range_max - v.range_min, val = v.range_min + ((v.i_meas - 4) / 16) * span, codes = 2 ** v.adc_bits * (v.adc_span / 100);
    const unit = String(input.unit ?? "");
    res.steps.push({ title: "2. Mise à l'échelle", lines: [{ label: "Grandeur mesurée", value: r2(val, 5), unit, formula: "min + (I − 4)/16 × (max − min)" }, { label: "Codes disponibles sur 4–20 mA", value: Math.floor(codes) }, { label: "Résolution", value: r2(span / codes, 4), unit, formula: "étendue / codes" }] });
    const us = rows(input.u).map((x) => { const a = num(x.a); return { n: String(x.name || "source"), u: a == null ? null : x.law === "k2" ? a / 2 : x.law === "std" ? a : a / Math.sqrt(3) }; });
    for (const x of us) if (x.u == null) res.missing.push(`${x.n} : valeur`);
    if (!res.missing.length && us.length) {
      const uc = Math.sqrt(us.reduce((a, x) => a + x.u! ** 2, 0));
      res.steps.push({ title: "3. Incertitude composée (GUM)", lines: [...us.map((x) => ({ label: `u(${x.n})`, value: r2(x.u!, 4), unit, formula: "rectangulaire : a/√3 ; k=2 : U/2" })), { label: "Incertitude-type composée uc", value: r2(uc, 4), unit, formula: "√Σ u²" }, { label: "Incertitude élargie U (k = 2)", value: r2(2 * uc, 4), unit }, { label: "Résultat", value: `${r2(val, 5)} ± ${r2(2 * uc, 3)}`, unit }] });
      res.summary.push({ label: "Incertitude élargie", value: `± ${r2(2 * uc, 3)}`, unit });
    }
    res.references.push("Guide pour l'expression de l'incertitude de mesure (GUM, JCGM 100)", CONDUCTORS.copper.ref);
    res.bom = [{ name: "Transmetteur 4-20 mA", qty: 1, unit: "u", spec: `${v.range_min}–${v.range_max} ${unit}` }, { name: "Alimentation 24 V DC", qty: 1, unit: "u", spec: `${v.vs} V boucle` }, { name: "Module d'entrées analogiques", qty: 1, unit: "u", spec: `${v.adc_bits} bits, entrée ${v.r_in} Ω` }, { name: "Câble électrique", qty: v.length, unit: "m", spec: `2 × ${v.section} mm² blindé` }];
    res.summary.unshift({ label: "Tension nécessaire à 20 mA", value: r2(vNeed, 3), unit: "V" }, { label: "Valeur mesurée", value: r2(val, 4), unit });
    return finish(res);
  },
};

export const IOT_NODE: Software = {
  key: "objet-connecte", title: "Objet connecté (IoT) : bilan énergétique, autonomie, recharge solaire, volume de données", discipline: "iot", lab: "iot",
  summary: "Courant moyen d'un nœud selon ses phases (mesure, émission, veille), autonomie sur batterie, bilan de recharge solaire et volume de données transmis.",
  sections: [
    { title: "1. Cycle de fonctionnement", fields: [{ key: "phases", label: "Phases actives par cycle", type: "rows", cols: [{ key: "name", label: "Phase", type: "text" }, { key: "i", label: "Courant", unit: "mA", type: "number" }, { key: "t", label: "Durée", unit: "s", type: "number" }] }, nf("i_sleep", "Courant de veille (fiche)", "µA"), nf("period", "Période du cycle", "s")] },
    { title: "2. Batterie", fields: [nf("cap", "Capacité de la batterie", "mAh"), nf("v_bat", "Tension nominale", "V"), nf("usable", "Capacité utilisable", "%"), nf("self", "Autodécharge", "%/mois")] },
    { title: "3. Recharge solaire (facultatif)", fields: [nf("pv_w", "Puissance crête du panneau", "Wc", { optional: true }), nf("psh", "Heures équivalentes plein soleil", "h/j", { optional: true }), nf("eta_ch", "Rendement de charge", "%", { optional: true })] },
    { title: "4. Données", fields: [nf("payload", "Taille d'un message", "octets"), nf("msgs", "Messages par cycle", "")] },
  ],
  example: { phases: [{ name: "Réveil et mesure", i: 45, t: 1.5 }, { name: "Connexion Wi-Fi et envoi", i: 160, t: 3 }], i_sleep: 15, period: 600, cap: 3000, v_bat: 3.7, usable: 80, self: 2, pv_w: 1, psh: 4.5, eta_ch: 70, payload: 120, msgs: 1 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { i_sleep: ["courant de veille (µA)", { min: 0 }], period: ["période du cycle (s)", { positive: true }], cap: ["capacité (mAh)", { positive: true }], v_bat: ["tension de la batterie (V)", { positive: true }], usable: ["capacité utilisable (%)", { positive: true, max: 100 }], self: ["autodécharge (%/mois)", { min: 0, max: 50 }], payload: ["taille d'un message (octets)", { min: 0 }], msgs: ["messages par cycle", { min: 0 }] });
    const ph = rows(input.phases); if (!ph.length) res.missing.push("au moins une phase active");
    let qa = 0, ta = 0;
    for (const p of ph) { const i = num(p.i), t = num(p.t); if (req(res, i, `${p.name || "phase"} : courant (mA)`, { min: 0 }) && req(res, t, `${p.name || "phase"} : durée (s)`, { min: 0 })) { qa += i * t; ta += t; } }
    if (!res.missing.length && ta > v.period) res.missing.push("durée des phases actives supérieure à la période");
    if (res.missing.length) return finish(res);
    const iAvg = (qa + (v.i_sleep / 1000) * (v.period - ta)) / v.period; // mA
    const daily = iAvg * 24; // mAh/j
    const selfDay = (v.cap * v.self / 100) / 30;
    const autonomyDays = (v.cap * v.usable / 100) / (daily + selfDay);
    res.steps.push({ title: "1. Consommation", lines: [{ label: "Charge active par cycle", value: r2(qa, 4), unit: "mA·s" }, { label: "Courant moyen", value: r2(iAvg, 4), unit: "mA", formula: "(Σ I t + I_veille (T − Σ t)) / T" }, { label: "Consommation journalière", value: r2(daily, 4), unit: "mAh/j" }, { label: "Autodécharge", value: r2(selfDay, 3), unit: "mAh/j" }, { label: "Autonomie sur batterie", value: r2(autonomyDays, 4), unit: "jours", formula: "C × utilisable / (conso + autodécharge)" }] });
    const pv = num(input.pv_w), psh = num(input.psh), eta = num(input.eta_ch);
    if (pv != null && psh != null && eta != null) {
      const gain = (pv * psh * eta / 100 / v.v_bat) * 1000;
      res.steps.push({ title: "2. Recharge solaire", ok: gain >= daily + selfDay, lines: [{ label: "Charge apportée", value: r2(gain, 4), unit: "mAh/j", formula: "P × heures × η / V" }, { label: "Bilan journalier", value: r2(gain - daily - selfDay, 4), unit: "mAh/j" }] });
      if (gain < daily + selfDay) res.warnings.push("Recharge solaire insuffisante en moyenne : augmenter le panneau ou réduire la consommation");
    }
    const bytesDay = v.payload * v.msgs * (86400 / v.period);
    res.steps.push({ title: "3. Données", lines: [{ label: "Messages par jour", value: Math.round(v.msgs * 86400 / v.period) }, { label: "Volume par jour", value: r2(bytesDay / 1024, 4), unit: "Kio" }, { label: "Volume par mois", value: r2((bytesDay * 30) / 1048576, 4), unit: "Mio", formula: "hors en-têtes de protocole" }] });
    res.bom = [{ name: "Carte ESP32", qty: 1, unit: "u", spec: `veille ${v.i_sleep} µA (fiche)` }, { name: "Batterie Li-ion 18650", qty: 1, unit: "u", spec: `${v.cap} mAh` }, { name: "Chargeur de batterie Li-ion (module)", qty: 1, unit: "u", spec: "" }, ...(pv ? [{ name: "Module photovoltaïque", qty: 1, unit: "u", spec: `${pv} Wc` }] : [])];
    res.summary = [{ label: "Courant moyen", value: r2(iAvg, 3), unit: "mA" }, { label: "Autonomie sans recharge", value: r2(autonomyDays, 3), unit: "jours" }];
    res.diagram = { kind: "architecture_iot", params: {} };
    return finish(res);
  },
};

export const MEDICAL: Software = {
  key: "technologies-medicales", title: "Technologies médicales (pédagogique) : chaîne d'acquisition d'un signal physiologique", discipline: "sante", lab: "electronics",
  summary: "Dimensionnement pédagogique d'une chaîne d'acquisition (ECG, pouls…) : gain, fréquence d'échantillonnage (Shannon-Nyquist), filtre anti-repliement, résolution ramenée à l'entrée, débit de données. Ni dispositif médical, ni outil de diagnostic.",
  sections: [{ title: "1. Signal et acquisition", fields: [nf("amp", "Amplitude maximale du signal (crête)", "mV"), nf("fmax", "Fréquence maximale utile", "Hz"), nf("vref", "Pleine échelle du convertisseur", "V"), nf("bits", "Résolution du convertisseur", "bits"), nf("usage", "Part de la pleine échelle visée", "%"), nf("fs", "Fréquence d'échantillonnage choisie", "Hz"), nf("c_aa", "Condensateur du filtre anti-repliement", "nF"), nf("channels", "Nombre de voies", "")] }],
  example: { amp: 5, fmax: 150, vref: 3.3, bits: 12, usage: 80, fs: 500, c_aa: 100, channels: 1 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { amp: ["amplitude du signal (mV)", { positive: true }], fmax: ["fréquence maximale (Hz)", { positive: true }], vref: ["pleine échelle (V)", { positive: true }], bits: ["résolution (bits)", { min: 6, max: 32 }], usage: ["part de la pleine échelle (%)", { positive: true, max: 100 }], fs: ["fréquence d'échantillonnage (Hz)", { positive: true }], c_aa: ["condensateur (nF)", { positive: true }], channels: ["nombre de voies", { positive: true }] });
    if (res.missing.length) return finish(res);
    const gain = (v.usage / 100) * v.vref / (2 * v.amp / 1000);
    const lsbIn = (v.vref / 2 ** v.bits) / gain * 1e6;
    const r = 1 / (2 * Math.PI * v.fmax * v.c_aa * 1e-9);
    const ok = v.fs >= 2 * v.fmax;
    res.steps.push({ title: "1. Chaîne d'acquisition", ok, lines: [
      { label: "Gain nécessaire", value: r2(gain, 4), formula: "part × Vref / (2 × amplitude) (signal bipolaire centré)" },
      { label: "Fréquence de Nyquist minimale", value: 2 * v.fmax, unit: "Hz", formula: "fs ≥ 2 fmax (Shannon-Nyquist)" }, { label: "Fréquence choisie", value: v.fs, unit: "Hz" },
      { label: "Résolution ramenée à l'entrée", value: r2(lsbIn, 4), unit: "µV", formula: "(Vref / 2ⁿ) / gain" },
      { label: "Filtre anti-repliement : R (fc = fmax)", value: r2(r / 1000, 4), unit: "kΩ", formula: "R = 1 / (2π fmax C) ; ordre supérieur recommandé" },
      { label: "Débit de données brut", value: r2((v.fs * v.bits * v.channels) / 1000, 4), unit: "kbit/s" },
    ] });
    if (!ok) res.warnings.push("Fréquence d'échantillonnage inférieure à 2 fmax : repliement spectral");
    res.warnings.push("Prototype pédagogique : ni dispositif médical certifié ni outil de diagnostic ; isolement galvanique et sécurité électrique du patient obligatoires (normes des appareils électromédicaux)");
    res.bom = [{ name: "Module ECG (pédagogique)", qty: v.channels, unit: "u", spec: `gain ≈ ${r2(gain, 3)}` }, { name: "Carte ESP32", qty: 1, unit: "u", spec: `ADC ${v.bits} bits, ${v.fs} Hz` }, { name: "Résistance", qty: v.channels, unit: "u", spec: `${r2(r / 1000, 3)} kΩ` }, { name: "Condensateur", qty: v.channels, unit: "u", spec: `${v.c_aa} nF` }, { name: "Batterie Li-ion 18650", qty: 1, unit: "u", spec: "alimentation sur batterie (isolement)" }];
    res.summary = [{ label: "Gain", value: r2(gain, 3) }, { label: "Résolution à l'entrée", value: r2(lsbIn, 3), unit: "µV" }];
    return finish(res);
  },
};
