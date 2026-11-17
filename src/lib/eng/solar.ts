/**
 * Solar Energy Lab — dimensionnement photovoltaïque (fonctions pures).
 * Toutes les caractéristiques d'équipement (modules, onduleur, batterie) et le ratio de performance sont saisis
 * depuis les fiches techniques / l'étude : aucune valeur par défaut n'est supposée.
 * Constantes physiques : g = 9,81 m/s², masse volumique de l'eau 1000 kg/m³ ; éclairement de référence STC 1000 W/m².
 */
import { result, round, need, type CalcResult } from "./result";

const G = 9.81;
const RHO_WATER = 1000;

/** Production : E = Pc × H × PR (H en kWh/m²/j sur le plan des modules, rapporté à 1 kW/m² STC). */
export function pvProduction(p: { peakKw: number | null; monthlyIrradiation: (number | null)[]; performanceRatio: number | null; plane: "horizontal" | "plane_of_array" }): CalcResult {
  const missing: string[] = [];
  need(missing, p.peakKw, "puissance crête Pc (kWc)"); need(missing, p.performanceRatio, "ratio de performance PR (étude ou retour d'expérience)");
  if (p.monthlyIrradiation.length !== 12 || p.monthlyIrradiation.some((h) => h == null)) missing.push("irradiation journalière moyenne des 12 mois (kWh/m²/j)");
  if (missing.length) return result({ missing });
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const outputs: CalcResult["outputs"] = {};
  let year = 0;
  p.monthlyIrradiation.forEach((h, m) => {
    const e = p.peakKw! * h! * p.performanceRatio! * days[m];
    year += e;
    outputs[`m${m + 1}`] = { value: round(e), unit: "kWh", label: `Production mois ${m + 1}` };
  });
  outputs.year = { value: round(year), unit: "kWh/an", label: "Production annuelle" };
  outputs.daily = { value: round(year / 365), unit: "kWh/j", label: "Moyenne journalière" };
  return result({
    outputs, formulas: ["E_mois = Pc × H × PR × nombre de jours"],
    assumptions: [p.plane === "horizontal" ? "Irradiation sur plan HORIZONTAL (pas de transposition au plan incliné : production sous-estimée ou surestimée selon l'inclinaison)" : "Irradiation sur le plan des modules", "Année non bissextile"],
  });
}

/** Tension en circuit ouvert corrigée en température : Voc(T) = Voc,STC × (1 + β (T − 25)), β en %/°C (fiche technique, négatif). */
export function vocAtTemp(vocStc: number, betaPctPerC: number, tC: number) { return vocStc * (1 + (betaPctPerC / 100) * (tC - 25)); }

/** Associations série/parallèle compatibles avec la plage MPPT et la tension maximale de l'onduleur/régulateur. */
export function stringSizing(p: {
  vocStc: number | null; vmpStc: number | null; iscStc: number | null; betaVocPct: number | null; gammaVmpPct: number | null;
  tMinC: number | null; tMaxCellC: number | null; vMaxDc: number | null; mpptMin: number | null; mpptMax: number | null; iMaxInput: number | null;
  modules: number | null;
}): CalcResult {
  const missing: string[] = [];
  const names: [keyof typeof p, string][] = [["vocStc", "Voc STC du module (V)"], ["vmpStc", "Vmp STC du module (V)"], ["iscStc", "Isc STC du module (A)"], ["betaVocPct", "coefficient de température de Voc (%/°C)"], ["gammaVmpPct", "coefficient de température de Vmp ou Pmax (%/°C)"], ["tMinC", "température ambiante minimale du site (°C)"], ["tMaxCellC", "température maximale de cellule (°C)"], ["vMaxDc", "tension d'entrée DC maximale de l'onduleur (V)"], ["mpptMin", "tension MPPT minimale (V)"], ["mpptMax", "tension MPPT maximale (V)"], ["iMaxInput", "courant d'entrée maximal par MPPT (A)"]];
  for (const [k, n] of names) need(missing, p[k], n);
  if (missing.length) return result({ missing });
  const vocCold = vocAtTemp(p.vocStc!, p.betaVocPct!, p.tMinC!);
  const vmpHot = p.vmpStc! * (1 + (p.gammaVmpPct! / 100) * (p.tMaxCellC! - 25));
  const vmpCold = p.vmpStc! * (1 + (p.gammaVmpPct! / 100) * (p.tMinC! - 25));
  const nMax = Math.min(Math.floor(p.vMaxDc! / vocCold), Math.floor(p.mpptMax! / vmpCold));
  const nMin = Math.ceil(p.mpptMin! / vmpHot);
  const pMax = Math.floor(p.iMaxInput! / p.iscStc!);
  const warnings: string[] = [];
  if (nMin > nMax) warnings.push("Aucun nombre de modules en série ne respecte à la fois la plage MPPT et la tension maximale");
  const outputs: CalcResult["outputs"] = {
    vocCold: { value: round(vocCold), unit: "V", label: "Voc d'un module au froid" },
    vmpHot: { value: round(vmpHot), unit: "V", label: "Vmp d'un module à chaud" },
    nMin: { value: nMin, unit: "modules", label: "Modules en série (minimum)" },
    nMax: { value: nMax, unit: "modules", label: "Modules en série (maximum)" },
    pMax: { value: pMax, unit: "chaînes", label: "Chaînes en parallèle par MPPT (maximum)" },
  };
  if (p.modules != null && nMin <= nMax) {
    const opts: string[] = [];
    for (let s = nMin; s <= nMax; s++) if (p.modules % s === 0 && p.modules / s <= pMax) opts.push(`${s} en série × ${p.modules / s} en parallèle`);
    if (!opts.length) warnings.push(`Aucune association exacte pour ${p.modules} modules`);
    else warnings.push(`Associations possibles pour ${p.modules} modules : ${opts.join(" ; ")}`);
  }
  return result({ outputs, warnings, formulas: ["Voc(T) = Voc,STC (1 + β (T − 25))", "Ns,max = min(⌊Vdc,max / Voc(Tmin)⌋, ⌊V_MPPT,max / Vmp(Tmin)⌋)", "Ns,min = ⌈V_MPPT,min / Vmp(Tcell,max)⌉", "Np,max = ⌊I_max,entrée / Isc⌋"], assumptions: ["Isc non corrigé en température (faible coefficient positif) : marge à conserver"] });
}

/** Capacité de batterie : C = E_j × N / (V × DoD × η). */
export function batterySizing(p: { dailyWh: number | null; autonomyDays: number | null; voltage: number | null; dod: number | null; efficiency: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.dailyWh, "consommation journalière (Wh/j)"); need(missing, p.autonomyDays, "jours d'autonomie"); need(missing, p.voltage, "tension du parc (V)"); need(missing, p.dod, "profondeur de décharge admissible DoD (fiche technique)"); need(missing, p.efficiency, "rendement de la batterie (fiche technique)");
  if (missing.length) return result({ missing });
  const wh = (p.dailyWh! * p.autonomyDays!) / (p.dod! * p.efficiency!);
  return result({ outputs: { wh: { value: round(wh), unit: "Wh", label: "Énergie nominale du parc" }, ah: { value: round(wh / p.voltage!), unit: "Ah", label: `Capacité à ${p.voltage} V` } }, formulas: ["C (Wh) = E_j × N / (DoD × η)", "C (Ah) = C (Wh) / V"] });
}

/** Pompage : P_hyd = ρ g Q H ; P_élec = P_hyd / (η_pompe × η_moteur) ; énergie journalière = P_élec × durée. */
export function pumpSizing(p: { flowM3h: number | null; headM: number | null; pumpEff: number | null; motorEff: number | null; dailyVolumeM3: number | null }): CalcResult {
  const missing: string[] = [];
  need(missing, p.flowM3h, "débit Q (m³/h)"); need(missing, p.headM, "hauteur manométrique totale HMT (m)"); need(missing, p.pumpEff, "rendement de la pompe (courbe constructeur)"); need(missing, p.motorEff, "rendement du moteur (plaque)");
  if (missing.length) return result({ missing });
  const q = p.flowM3h! / 3600;
  const ph = RHO_WATER * G * q * p.headM!;
  const pe = ph / (p.pumpEff! * p.motorEff!);
  const outputs: CalcResult["outputs"] = { ph: { value: round(ph), unit: "W", label: "Puissance hydraulique" }, pe: { value: round(pe), unit: "W", label: "Puissance électrique absorbée" } };
  if (p.dailyVolumeM3 != null) {
    const hours = p.dailyVolumeM3 / p.flowM3h!;
    outputs.hours = { value: round(hours), unit: "h/j", label: "Durée de pompage" };
    outputs.ewh = { value: round(pe * hours), unit: "Wh/j", label: "Énergie électrique journalière" };
  }
  return result({ outputs, formulas: ["P_hyd = ρ × g × Q × HMT", "P_élec = P_hyd / (η_pompe × η_moteur)"], references: ["ρ = 1000 kg/m³, g = 9,81 m/s²"], assumptions: ["Point de fonctionnement constant (débit et HMT fixes)"] });
}

/** Rentabilité : coût actualisé de l'énergie (LCOE) et temps de retour simple. Toutes les valeurs économiques sont saisies. */
export function economics(p: { capex: number | null; opexPerYear: number | null; annualKwh: number | null; years: number | null; discountRate: number | null; tariffPerKwh: number | null; currency: string }): CalcResult {
  const missing: string[] = [];
  need(missing, p.capex, "investissement (CAPEX)"); need(missing, p.opexPerYear, "coût annuel d'exploitation (OPEX)"); need(missing, p.annualKwh, "production annuelle (kWh)"); need(missing, p.years, "durée d'analyse (ans)"); need(missing, p.discountRate, "taux d'actualisation");
  if (missing.length) return result({ missing });
  let costs = p.capex!, energy = 0;
  for (let t = 1; t <= p.years!; t++) { const d = (1 + p.discountRate!) ** t; costs += p.opexPerYear! / d; energy += p.annualKwh! / d; }
  const outputs: CalcResult["outputs"] = { lcoe: { value: round(costs / energy), unit: `${p.currency}/kWh`, label: "Coût actualisé de l'énergie (LCOE)" } };
  const warnings: string[] = [];
  if (p.tariffPerKwh != null) {
    const saving = p.annualKwh! * p.tariffPerKwh - p.opexPerYear!;
    if (saving > 0) outputs.payback = { value: round(p.capex! / saving, 3), unit: "ans", label: "Temps de retour simple" };
    else warnings.push("Économie annuelle nulle ou négative : pas de retour sur investissement");
  }
  return result({ outputs, warnings, formulas: ["LCOE = (CAPEX + Σ OPEX/(1+r)^t) / Σ E/(1+r)^t", "Retour simple = CAPEX / (E × tarif − OPEX)"], assumptions: ["Production constante (dégradation des modules non prise en compte)"] });
}
