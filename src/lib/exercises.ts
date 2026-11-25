/**
 * Banque d'exercices paramétrés : chaque modèle produit, pour un numéro de variante, un énoncé chiffré original et son
 * corrigé calculé par les fonctions testées de la plateforme (src/lib/eng). Ressources ORIGINALES de XAM-XAM LAB :
 * aucun sujet officiel d'examen n'est reproduit. La correspondance avec un référentiel (Sénégal ou autre) est indiquée
 * par le formateur.
 */
import * as el from "./eng/electrical";
import * as so from "./eng/solar";
import * as me from "./eng/mechanical";
import * as th from "./eng/thermal";
import * as nw from "./eng/network";
import type { CalcResult } from "./eng/result";

export type ExLevel = "debutant" | "intermediaire" | "avance";
export interface Exercise {
  id: string; template: string; title: string; filiere: string; level: ExLevel; statement: string; question: string;
  answer: { value: number; unit: string; label: string; tolerancePct: number }; steps: string[]; method: string;
}
interface Template { key: string; title: string; filiere: string; level: ExLevel; method: string; make: (r: () => number) => Omit<Exercise, "id" | "template" | "title" | "filiere" | "level" | "method"> }

/** Générateur pseudo-aléatoire reproductible (mulberry32) : même variante → même énoncé. */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length) % xs.length];
const fr = (x: number) => String(+x.toPrecision(6)).replace(".", ",");
const stepsOf = (res: CalcResult, data: string) => [`Données : ${data}`, ...res.formulas.map((f) => `Formule : ${f}`), ...Object.values(res.outputs).map((o) => `Résultat : ${o.label} = ${fr(o.value)} ${o.unit}`.trim())];
const out = (res: CalcResult, key: string, tol = 1) => ({ value: res.outputs[key].value, unit: res.outputs[key].unit, label: res.outputs[key].label, tolerancePct: tol });

export const TEMPLATES: Template[] = [
  { key: "ohm-courant", title: "Loi d'Ohm : calcul d'un courant", filiere: "elec_batiment", level: "debutant", method: "Appliquer U = R × I, donc I = U / R.",
    make: (r) => { const u = pick(r, [5, 9, 12, 24, 48, 230]), R = pick(r, [10, 22, 47, 100, 220, 470, 1000]); const res = el.ohm({ u, r: R, i: null });
      return { statement: `Un récepteur résistif de résistance R = ${R} Ω est alimenté sous une tension continue U = ${u} V.`, question: "Calculer le courant I qui le traverse.", answer: out(res, "i"), steps: stepsOf(res, `U = ${u} V ; R = ${R} Ω`) }; } },
  { key: "ohm-resistance", title: "Loi d'Ohm : calcul d'une résistance", filiere: "electronique", level: "debutant", method: "R = U / I (unités SI).",
    make: (r) => { const u = pick(r, [3.3, 5, 12]), iMa = pick(r, [5, 10, 15, 20]); const res = el.ohm({ u, i: iMa / 1000, r: null });
      return { statement: `On souhaite limiter à ${iMa} mA le courant dans une branche alimentée sous ${fr(u)} V (chute de tension des autres éléments négligée).`, question: "Calculer la résistance R nécessaire.", answer: out(res, "r"), steps: stepsOf(res, `U = ${fr(u)} V ; I = ${iMa} mA = ${fr(iMa / 1000)} A`) }; } },
  { key: "puissance-mono", title: "Puissances en monophasé", filiere: "elec_batiment", level: "intermediaire", method: "S = U × I ; P = S × cos φ ; Q = S × sin φ.",
    make: (r) => { const u = 230, i = pick(r, [2, 4.5, 6, 8, 10, 13]), c = pick(r, [0.7, 0.8, 0.85, 0.9]); const res = el.acPower({ system: "single", u, i, cosPhi: c });
      return { statement: `Un moteur monophasé absorbe I = ${fr(i)} A sous U = ${u} V avec un facteur de puissance cos φ = ${fr(c)}.`, question: "Calculer la puissance active P absorbée.", answer: out(res, "p"), steps: stepsOf(res, `U = ${u} V ; I = ${fr(i)} A ; cos φ = ${fr(c)}`) }; } },
  { key: "puissance-tri", title: "Puissances en triphasé équilibré", filiere: "electrotechnique", level: "intermediaire", method: "S = √3 × U × I ; P = S × cos φ.",
    make: (r) => { const u = 400, i = pick(r, [5, 8.5, 12, 16, 25, 32]), c = pick(r, [0.78, 0.82, 0.85, 0.88]); const res = el.acPower({ system: "three", u, i, cosPhi: c });
      return { statement: `Un moteur triphasé est alimenté sous U = ${u} V entre phases ; il absorbe I = ${fr(i)} A par phase avec cos φ = ${fr(c)}.`, question: "Calculer la puissance active P absorbée.", answer: out(res, "p"), steps: stepsOf(res, `U = ${u} V ; I = ${fr(i)} A ; cos φ = ${fr(c)}`) }; } },
  { key: "courant-emploi-tri", title: "Courant d'emploi d'un moteur triphasé", filiere: "electrotechnique", level: "intermediaire", method: "Ib = P / (√3 × U × cos φ × η), P étant la puissance utile.",
    make: (r) => { const p = pick(r, [1.5, 2.2, 4, 5.5, 7.5, 11, 15]), c = pick(r, [0.8, 0.83, 0.85, 0.87]), e = pick(r, [0.82, 0.86, 0.88, 0.9]); const res = el.designCurrent({ system: "three", pW: p * 1000, u: 400, cosPhi: c, efficiency: e });
      return { statement: `Plaque signalétique d'un moteur asynchrone triphasé : puissance utile ${fr(p)} kW, 400 V, cos φ = ${fr(c)}, rendement η = ${fr(e)}.`, question: "Calculer le courant d'emploi Ib.", answer: out(res, "ib"), steps: stepsOf(res, `P = ${fr(p)} kW = ${p * 1000} W ; U = 400 V ; cos φ = ${fr(c)} ; η = ${fr(e)}`) }; } },
  { key: "courant-emploi-mono", title: "Courant d'emploi d'un appareil monophasé", filiere: "elec_batiment", level: "debutant", method: "Ib = P / (U × cos φ × η) ; pour un appareil résistif cos φ = 1 et η = 1.",
    make: (r) => { const p = pick(r, [1000, 1500, 2000, 2500, 3000, 3500]); const res = el.designCurrent({ system: "single", pW: p, u: 230, cosPhi: 1, efficiency: 1 });
      return { statement: `Un chauffe-eau électrique résistif de ${p} W est alimenté en 230 V monophasé.`, question: "Calculer le courant d'emploi Ib.", answer: out(res, "ib"), steps: stepsOf(res, `P = ${p} W ; U = 230 V ; cos φ = 1 ; η = 1`) }; } },
  { key: "chute-tension", title: "Chute de tension d'un circuit monophasé", filiere: "elec_batiment", level: "avance", method: "ΔU = 2 × ρθ × L × I / S (cos φ = 1) ; ΔU% = 100 ΔU / U ; ρθ = ρ20 (1 + α(θ − 20)).",
    make: (r) => { const L = pick(r, [15, 25, 30, 40, 50]), S = pick(r, [1.5, 2.5, 4, 6]), I = pick(r, [10, 16, 20, 25]); const res = el.voltageDrop({ system: "single", u: 230, i: I, lengthM: L, sectionMm2: S, conductor: "copper", tempC: 70, cosPhi: 1 });
      return { statement: `Un circuit monophasé 230 V en cuivre (section ${fr(S)} mm², longueur ${L} m) alimente une charge résistive de ${I} A. On prendra la résistivité à 70 °C (ρ20 = 1/58 Ω·mm²/m, α = 0,00393 /K).`, question: "Calculer la chute de tension en pourcentage.", answer: out(res, "pct"), steps: stepsOf(res, `U = 230 V ; I = ${I} A ; L = ${L} m ; S = ${fr(S)} mm² ; θ = 70 °C ; cos φ = 1`) }; } },
  { key: "energie", title: "Énergie consommée et coût", filiere: "elec_batiment", level: "debutant", method: "E = P × t (kWh = kW × h) ; coût = E × tarif.",
    make: (r) => { const p = pick(r, [60, 100, 750, 1200, 2000]), h = pick(r, [2, 4, 6, 8, 10]), d = 30; const e = (p / 1000) * h * d;
      return { statement: `Un appareil de ${p} W fonctionne ${h} h par jour pendant ${d} jours.`, question: "Calculer l'énergie consommée sur la période (kWh).", answer: { value: +e.toPrecision(6), unit: "kWh", label: "Énergie E", tolerancePct: 1 },
        steps: [`Données : P = ${p} W = ${fr(p / 1000)} kW ; durée = ${h} h × ${d} j = ${h * d} h`, "Formule : E = P × t", `Résultat : E = ${fr(p / 1000)} × ${h * d} = ${fr(e)} kWh`] }; } },
  { key: "pv-journalier", title: "Production journalière d'un champ photovoltaïque", filiere: "enr", level: "debutant", method: "E = Pc × H × PR (Pc en kWc, H en kWh/m²/j, PR sans unité).",
    make: (r) => { const pc = pick(r, [0.6, 1.2, 2.4, 3.6]), H = pick(r, [5.2, 5.6, 6.0, 6.3]), pr = pick(r, [0.7, 0.75, 0.8]); const e = pc * H * pr;
      return { statement: `Un champ de ${fr(pc)} kWc reçoit une irradiation moyenne de ${fr(H)} kWh/m²/j (donnée modélisée) ; le ratio de performance est estimé à ${fr(pr)}.`, question: "Calculer la production journalière moyenne.", answer: { value: +e.toPrecision(6), unit: "kWh/j", label: "Production E", tolerancePct: 1 },
        steps: [`Données : Pc = ${fr(pc)} kWc ; H = ${fr(H)} kWh/m²/j ; PR = ${fr(pr)}`, "Formule : E = Pc × H × PR", `Résultat : E = ${fr(e)} kWh/j`] }; } },
  { key: "batterie", title: "Capacité d'un parc de batteries", filiere: "enr", level: "intermediaire", method: "E = besoin × autonomie / (DoD × η) ; C = E / U.",
    make: (r) => { const wh = pick(r, [600, 1200, 1800, 2400]), j = pick(r, [1, 2, 3]), v = pick(r, [12, 24, 48]), dod = pick(r, [0.5, 0.8]); const res = so.batterySizing({ dailyWh: wh, autonomyDays: j, voltage: v, dod, efficiency: 0.9 });
      return { statement: `Une installation consomme ${wh} Wh/j. On veut ${j} jour(s) d'autonomie, un parc en ${v} V, une profondeur de décharge admise de ${fr(dod)} et un rendement de 0,9.`, question: `Calculer la capacité du parc en Ah sous ${v} V.`, answer: out(res, "ah"), steps: stepsOf(res, `besoin = ${wh} Wh/j ; autonomie = ${j} j ; U = ${v} V ; DoD = ${fr(dod)} ; η = 0,9`) }; } },
  { key: "pompe", title: "Puissance d'une pompe", filiere: "plomberie", level: "intermediaire", method: "P_hyd = ρ g Q HMT ; P_élec = P_hyd / (η_pompe × η_moteur).",
    make: (r) => { const q = pick(r, [2, 3, 5, 8]), h = pick(r, [15, 25, 40, 60]), ep = pick(r, [0.5, 0.6, 0.65]), em = pick(r, [0.8, 0.85]); const res = so.pumpSizing({ flowM3h: q, headM: h, pumpEff: ep, motorEff: em, dailyVolumeM3: null });
      return { statement: `Une pompe doit débiter ${q} m³/h sous une hauteur manométrique totale de ${h} m. Rendements : pompe ${fr(ep)}, moteur ${fr(em)} (ρ = 1000 kg/m³, g = 9,81 m/s²).`, question: "Calculer la puissance électrique absorbée.", answer: out(res, "pe"), steps: stepsOf(res, `Q = ${q} m³/h ; HMT = ${h} m ; ηp = ${fr(ep)} ; ηm = ${fr(em)}`) }; } },
  { key: "couple", title: "Couple sur l'arbre d'un moteur", filiere: "mecanique", level: "debutant", method: "C = P / ω avec ω = 2π n / 60.",
    make: (r) => { const p = pick(r, [750, 1500, 2200, 4000]), n = pick(r, [960, 1450, 2900]); const res = me.torque({ powerW: p, rpm: n });
      return { statement: `Un moteur fournit une puissance mécanique de ${p} W à ${n} tr/min.`, question: "Calculer le couple utile C.", answer: out(res, "c"), steps: stepsOf(res, `P = ${p} W ; n = ${n} tr/min`) }; } },
  { key: "engrenages", title: "Train d'engrenages", filiere: "mecanique", level: "intermediaire", method: "i = Π (Z menée / Z menante) ; n_s = n_e / i.",
    make: (r) => { const z1 = pick(r, [12, 15, 18, 20]), z2 = pick(r, [36, 45, 54, 60]); const res = me.gearTrain({ stages: [{ z1, z2 }], rpmIn: 1450, torqueIn: 10, stageEfficiency: 0.97 });
      return { statement: `Un moteur à 1450 tr/min entraîne un pignon de ${z1} dents qui engrène sur une roue de ${z2} dents.`, question: "Calculer la vitesse de sortie.", answer: out(res, "rpmOut"), steps: stepsOf(res, `Z1 = ${z1} ; Z2 = ${z2} ; n = 1450 tr/min`) }; } },
  { key: "verin", title: "Force d'un vérin pneumatique", filiere: "mecanique", level: "debutant", method: "F = p × A × η avec A = π D² / 4.",
    make: (r) => { const p = pick(r, [4, 6, 8]), d = pick(r, [25, 32, 40, 50, 63]); const res = me.cylinderForce({ pressureBar: p, boreMm: d, efficiency: 0.9 });
      return { statement: `Un vérin d'alésage ${d} mm est alimenté sous ${p} bar ; rendement 0,9.`, question: "Calculer la force de poussée.", answer: out(res, "f"), steps: stepsOf(res, `p = ${p} bar ; D = ${d} mm ; η = 0,9`) }; } },
  { key: "cop-carnot", title: "COP de Carnot d'une machine frigorifique", filiere: "froid", level: "intermediaire", method: "COP = Tf / (Tc − Tf), températures en kelvins.",
    make: (r) => { const tf = pick(r, [-25, -10, 0, 5]), tc = pick(r, [35, 40, 45]); const res = th.carnotCop({ tColdC: tf, tHotC: tc });
      return { statement: `Une machine frigorifique fonctionne entre une source froide à ${tf} °C et une source chaude à ${tc} °C.`, question: "Calculer le COP froid maximal théorique (Carnot).", answer: out(res, "copF"), steps: stepsOf(res, `Tf = ${tf} °C ; Tc = ${tc} °C`) }; } },
  { key: "parois", title: "Apports thermiques par les parois", filiere: "froid", level: "intermediaire", method: "Q = U × A × (Text − Tint).",
    make: (r) => { const u = pick(r, [0.25, 0.3, 0.4]), a = pick(r, [40, 60, 80]), tin = pick(r, [2, 4, -18]), tout = pick(r, [32, 35, 38]); const res = th.wallLoad({ walls: [{ name: "parois", u, areaM2: a }], tInC: tin, tOutC: tout });
      return { statement: `Une chambre froide maintenue à ${tin} °C a ${a} m² de parois de coefficient U = ${fr(u)} W/(m²·K) ; l'air extérieur est à ${tout} °C.`, question: "Calculer les apports thermiques par les parois.", answer: out(res, "q"), steps: stepsOf(res, `U = ${fr(u)} W/(m²·K) ; A = ${a} m² ; Tint = ${tin} °C ; Text = ${tout} °C`) }; } },
  { key: "sous-reseau", title: "Hôtes d'un sous-réseau IPv4", filiere: "reseaux", level: "intermediaire", method: "Nombre d'hôtes = 2^(32 − p) − 2.",
    make: (r) => { const p = pick(r, [24, 25, 26, 27, 28, 29]), net = pick(r, ["192.168.10.0", "10.0.4.0", "172.16.8.0"]); const s = nw.subnet(`${net}/${p}`)!;
      return { statement: `Une entreprise utilise le réseau ${net}/${p}.`, question: "Combien d'hôtes peut-on adresser dans ce sous-réseau ?", answer: { value: s.hosts, unit: "hôtes", label: "Hôtes utilisables", tolerancePct: 0 },
        steps: [`Données : préfixe p = ${p}`, "Formule : hôtes = 2^(32 − p) − 2", `Résultat : 2^${32 - p} − 2 = ${s.hosts} hôtes (masque ${s.mask}, diffusion ${s.broadcast})`] }; } },
  { key: "diviseur", title: "Pont diviseur de tension", filiere: "electronique", level: "debutant", method: "Vs = Ve × R2 / (R1 + R2), à vide.",
    make: (r) => { const ve = pick(r, [5, 9, 12, 24]), r1 = pick(r, [1000, 2200, 4700, 10000]), r2 = pick(r, [1000, 2200, 3300, 4700]); const vs = (ve * r2) / (r1 + r2);
      return { statement: `Un pont diviseur à vide est formé de R1 = ${r1} Ω (côté alimentation) et R2 = ${r2} Ω (côté masse), alimenté sous ${ve} V.`, question: "Calculer la tension de sortie Vs aux bornes de R2.", answer: { value: +vs.toPrecision(6), unit: "V", label: "Tension Vs", tolerancePct: 1 },
        steps: [`Données : Ve = ${ve} V ; R1 = ${r1} Ω ; R2 = ${r2} Ω`, "Formule : Vs = Ve × R2 / (R1 + R2)", `Résultat : Vs = ${fr(vs)} V`] }; } },
  { key: "rc-coupure", title: "Fréquence de coupure d'un filtre RC", filiere: "electronique", level: "intermediaire", method: "fc = 1 / (2π R C).",
    make: (r) => { const R = pick(r, [1000, 4700, 10000]), cnF = pick(r, [10, 47, 100, 220]); const fc = 1 / (2 * Math.PI * R * cnF * 1e-9);
      return { statement: `Un filtre passe-bas RC est formé de R = ${R} Ω et C = ${cnF} nF.`, question: "Calculer sa fréquence de coupure fc.", answer: { value: +fc.toPrecision(6), unit: "Hz", label: "Fréquence de coupure", tolerancePct: 1 },
        steps: [`Données : R = ${R} Ω ; C = ${cnF} nF = ${fr(cnF * 1e-9)} F`, "Formule : fc = 1 / (2π R C)", `Résultat : fc = ${fr(fc)} Hz`] }; } },
];

export const exerciseTemplate = (k: string) => TEMPLATES.find((t) => t.key === k) ?? null;

export function makeExercise(template: string, variant: number): Exercise | null {
  const t = exerciseTemplate(template);
  if (!t || !Number.isInteger(variant) || variant < 1 || variant > 100000) return null;
  const r = rng(variant * 7919 + template.length * 104729);
  return { id: `${template}#${variant}`, template, title: t.title, filiere: t.filiere, level: t.level, method: t.method, ...t.make(r) };
}

/** Correction d'une réponse (tolérance relative du modèle ; valeur nulle : égalité stricte). */
export function grade(ex: Exercise, given: number): { correct: boolean; deviationPct: number | null } {
  if (!Number.isFinite(given)) return { correct: false, deviationPct: null };
  const v = ex.answer.value;
  const dev = v === 0 ? (given === 0 ? 0 : 100) : (Math.abs(given - v) / Math.abs(v)) * 100;
  return { correct: dev <= ex.answer.tolerancePct + 1e-9, deviationPct: Math.round(dev * 100) / 100 };
}

/** Épreuve d'entraînement : n exercices tirés des modèles d'une filière (ou de toutes), barème égal. */
export function makeExam(seed: number, n: number, filiere?: string): Exercise[] {
  const pool = TEMPLATES.filter((t) => !filiere || t.filiere === filiere);
  const r = rng(seed);
  const out: Exercise[] = [];
  for (let i = 0; i < Math.min(n, 20) && pool.length; i++) { const t = pool[Math.floor(r() * pool.length)]; out.push(makeExercise(t.key, 1 + Math.floor(r() * 1000))!); }
  return out;
}
