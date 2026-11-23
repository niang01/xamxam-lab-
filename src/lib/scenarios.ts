/**
 * Studio 4D — scénarios temporels (intégration numérique explicite, pas de temps fixe). Fonctions pures, testées.
 * Nature des résultats : SIMULATION à partir des paramètres saisis ; hypothèses de modélisation listées.
 * Chaque modèle vérifie son bilan de conservation (énergie, volume) : l'écart est renvoyé et doit rester ~0.
 */
import { z } from "zod";

const n = z.number().finite().nullable().optional();
const hourly = z.array(z.number().finite().nonnegative()).length(24);

export const solarBatteryInput = z.object({
  pvKwc: n, dailyIrradiationKwhM2: n, performanceRatio: n, sunriseH: n, sunsetH: n,
  batteryKwh: n, socInitPct: n, socMinPct: n, chargeEff: n,
  loadW: n, loadProfileW: hourly.nullable().optional(), days: z.number().int().min(1).max(14).default(2), stepMin: z.number().int().min(5).max(60).default(15),
});
export const tankInput = z.object({
  volumeM3: n, levelInitPct: n, pumpFlowM3h: n, pumpOnBelowPct: n, pumpOffAbovePct: n,
  demandM3h: n, demandProfileM3h: hourly.nullable().optional(), pumpHoursStart: n, pumpHoursEnd: n,
  days: z.number().int().min(1).max(14).default(2), stepMin: z.number().int().min(1).max(60).default(10),
});
export const coldRoomInput = z.object({
  uaWK: n, heatCapacityKJK: n, tOutC: n, tInitC: n, setpointC: n, differentialK: n, coolingW: n, internalW: n,
  outageStartH: n, outageEndH: n, hours: z.number().int().min(1).max(336).default(48), stepMin: z.number().int().min(1).max(30).default(5),
});

export interface Series { t: number[]; [k: string]: number[] }
export interface ScenarioResult {
  model: string; missing: string[]; assumptions: string[]; warnings: string[];
  series: Series | null; units: Record<string, string>; summary: Record<string, { value: number; unit: string; label: string }>;
  balance: { label: string; residual: number; unit: string } | null;
}
const missingOf = (o: Record<string, unknown>, keys: string[]) => keys.filter((k) => o[k] == null);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const empty = (model: string, missing: string[], assumptions: string[]): ScenarioResult => ({ model, missing, assumptions, warnings: [], series: null, units: {}, summary: {}, balance: null });

/** Énergie solaire + batterie + charge. */
export function solarBattery(i: z.infer<typeof solarBatteryInput>): ScenarioResult {
  const assumptions = [
    "Irradiation journalière répartie selon une demi-sinusoïde entre le lever et le coucher du soleil (journée claire idéalisée, identique chaque jour).",
    "Production = puissance crête × irradiance (kW/m²) × ratio de performance.",
    "Batterie : rendement appliqué à la charge ; décharge limitée au seuil minimal ; surplus non stocké = écrêté.",
  ];
  const need = ["pvKwc", "dailyIrradiationKwhM2", "performanceRatio", "sunriseH", "sunsetH", "batteryKwh", "socInitPct", "socMinPct", "chargeEff"];
  const missing = missingOf(i, need);
  if (i.loadW == null && !i.loadProfileW) missing.push("loadW ou loadProfileW");
  if (missing.length) return empty("solar_battery", missing, assumptions);
  const dt = i.stepMin / 60, steps = Math.round((i.days * 24) / dt);
  const dayLen = i.sunsetH! - i.sunriseH!;
  if (dayLen <= 0) return { ...empty("solar_battery", [], assumptions), warnings: ["Le coucher doit suivre le lever du soleil."] };
  const peak = (Math.PI * i.dailyIrradiationKwhM2!) / (2 * dayLen); // kW/m² au zénith tel que ∫ = H
  const cap = i.batteryKwh!, minE = (cap * i.socMinPct!) / 100;
  let e = (cap * i.socInitPct!) / 100;
  const s: Series = { t: [], pv_kw: [], load_kw: [], soc_pct: [] };
  let ePv = 0, eLoad = 0, unmet = 0, curtailed = 0, charged = 0, discharged = 0, losses = 0;
  const e0 = e;
  for (let k = 0; k <= steps; k++) {
    const t = k * dt, h = t % 24;
    const irr = h > i.sunriseH! && h < i.sunsetH! ? peak * Math.sin((Math.PI * (h - i.sunriseH!)) / dayLen) : 0;
    const pv = i.pvKwc! * irr * i.performanceRatio!;
    const load = (i.loadProfileW ? i.loadProfileW[Math.floor(h)] : i.loadW!) / 1000;
    s.t.push(r3(t)); s.pv_kw.push(r3(pv)); s.load_kw.push(r3(load)); s.soc_pct.push(r3((100 * e) / cap));
    if (k === steps) break;
    ePv += pv * dt; eLoad += load * dt;
    const net = (pv - load) * dt;
    if (net >= 0) {
      const room = cap - e;
      const stored = Math.min(net * i.chargeEff!, room);
      const usedForCharge = stored / i.chargeEff!;
      e += stored; charged += usedForCharge; losses += usedForCharge - stored; curtailed += net - usedForCharge;
    } else {
      const want = -net, avail = Math.max(0, e - minE), give = Math.min(want, avail);
      e -= give; discharged += give; unmet += want - give;
    }
  }
  // Bilan : PV + déstockage + non servi = charge + énergie chargée (avant pertes) + écrêtage ; ΔE = stocké − déstocké
  const residual = ePv + discharged + unmet - (eLoad + charged + curtailed);
  const deltaE = e - e0 - ((charged - losses) - discharged);
  return {
    model: "solar_battery", missing: [], assumptions, warnings: unmet > 0 ? [`Énergie non servie : ${r3(unmet)} kWh sur ${i.days} jour(s).`] : [],
    series: s, units: { t: "h", pv_kw: "kW", load_kw: "kW", soc_pct: "%" },
    summary: {
      pv: { value: r3(ePv), unit: "kWh", label: "Production PV" }, load: { value: r3(eLoad), unit: "kWh", label: "Consommation" },
      unmet: { value: r3(unmet), unit: "kWh", label: "Énergie non servie" }, curtailed: { value: r3(curtailed), unit: "kWh", label: "Énergie écrêtée" },
      socMin: { value: r3(Math.min(...s.soc_pct)), unit: "%", label: "État de charge minimal" }, socEnd: { value: r3((100 * e) / cap), unit: "%", label: "État de charge final" },
    },
    balance: { label: "Bilan d'énergie (doit être nul)", residual: r3(Math.abs(residual) + Math.abs(deltaE)), unit: "kWh" },
  };
}

/** Réservoir alimenté par une pompe (plage horaire + commande par niveau) et vidé par la demande. */
export function tank(i: z.infer<typeof tankInput>): ScenarioResult {
  const assumptions = ["Pompe à débit constant (point de fonctionnement fixe).", "Commande : la pompe démarre sous le seuil bas et s'arrête au-dessus du seuil haut, seulement dans la plage horaire autorisée.", "Le volume excédentaire déborde ; la demande non satisfaite est comptée en déficit."];
  const missing = missingOf(i, ["volumeM3", "levelInitPct", "pumpFlowM3h", "pumpOnBelowPct", "pumpOffAbovePct", "pumpHoursStart", "pumpHoursEnd"]);
  if (i.demandM3h == null && !i.demandProfileM3h) missing.push("demandM3h ou demandProfileM3h");
  if (missing.length) return empty("tank", missing, assumptions);
  const dt = i.stepMin / 60, steps = Math.round((i.days * 24) / dt), V = i.volumeM3!;
  let v = (V * i.levelInitPct!) / 100, on = false;
  const v0 = v;
  const s: Series = { t: [], level_pct: [], pump: [], demand_m3h: [] };
  let pumped = 0, served = 0, shortage = 0, overflow = 0, onHours = 0;
  for (let k = 0; k <= steps; k++) {
    const t = k * dt, h = t % 24;
    const allowed = i.pumpHoursStart! <= i.pumpHoursEnd! ? h >= i.pumpHoursStart! && h < i.pumpHoursEnd! : h >= i.pumpHoursStart! || h < i.pumpHoursEnd!;
    const pct = (100 * v) / V;
    if (pct <= i.pumpOnBelowPct!) on = true;
    if (pct >= i.pumpOffAbovePct!) on = false;
    const running = on && allowed;
    const dem = i.demandProfileM3h ? i.demandProfileM3h[Math.floor(h)] : i.demandM3h!;
    s.t.push(r3(t)); s.level_pct.push(r3(pct)); s.pump.push(running ? 1 : 0); s.demand_m3h.push(dem);
    if (k === steps) break;
    const qin = running ? i.pumpFlowM3h! * dt : 0, want = dem * dt;
    pumped += qin; if (running) onHours += dt;
    v += qin;
    if (v > V) { overflow += v - V; v = V; }
    const give = Math.min(want, v); v -= give; served += give; shortage += want - give;
  }
  const residual = v0 + pumped - served - overflow - v;
  return {
    model: "tank", missing: [], assumptions, warnings: shortage > 0 ? [`Demande non satisfaite : ${r3(shortage)} m³.`] : [],
    series: s, units: { t: "h", level_pct: "%", pump: "marche=1", demand_m3h: "m³/h" },
    summary: {
      pumped: { value: r3(pumped), unit: "m³", label: "Volume pompé" }, served: { value: r3(served), unit: "m³", label: "Volume distribué" },
      shortage: { value: r3(shortage), unit: "m³", label: "Déficit" }, overflow: { value: r3(overflow), unit: "m³", label: "Débordement" },
      onHours: { value: r3(onHours), unit: "h", label: "Durée de pompage" }, levelMin: { value: r3(Math.min(...s.level_pct)), unit: "%", label: "Niveau minimal" },
    },
    balance: { label: "Bilan de volume (doit être nul)", residual: r3(Math.abs(residual)), unit: "m³" },
  };
}

/** Chambre froide : modèle à une capacité (C·dT/dt = UA·(Text − T) + apports − froid), thermostat à hystérésis, coupure. */
export function coldRoom(i: z.infer<typeof coldRoomInput>): ScenarioResult {
  const assumptions = ["Modèle à une capacité thermique (température homogène).", "Apports par les parois = UA × (Text − T) ; apports internes constants.", "Groupe frigorifique tout-ou-rien à puissance constante, commandé par thermostat à différentiel ; arrêt pendant la coupure."];
  const missing = missingOf(i, ["uaWK", "heatCapacityKJK", "tOutC", "tInitC", "setpointC", "differentialK", "coolingW", "internalW"]);
  if (missing.length) return empty("cold_room", missing, assumptions);
  const dt = (i.stepMin * 60), steps = Math.round((i.hours * 3600) / dt), C = i.heatCapacityKJK! * 1000;
  let T = i.tInitC!, on = T > i.setpointC!;
  const T0 = T;
  const s: Series = { t: [], temp_c: [], compressor: [] };
  let qWalls = 0, qInt = 0, qCool = 0, above = 0, onH = 0;
  const outage = (h: number) => i.outageStartH != null && i.outageEndH != null && h >= i.outageStartH && h < i.outageEndH;
  for (let k = 0; k <= steps; k++) {
    const h = (k * dt) / 3600;
    if (T >= i.setpointC! + i.differentialK!) on = true;
    if (T <= i.setpointC!) on = false;
    const running = on && !outage(h);
    s.t.push(r3(h)); s.temp_c.push(r3(T)); s.compressor.push(running ? 1 : 0);
    if (k === steps) break;
    const walls = i.uaWK! * (i.tOutC! - T), cool = running ? i.coolingW! : 0;
    qWalls += walls * dt; qInt += i.internalW! * dt; qCool += cool * dt;
    if (T > i.setpointC! + i.differentialK!) above += dt / 3600;
    if (running) onH += dt / 3600;
    T += ((walls + i.internalW! - cool) * dt) / C;
  }
  const residual = (C * (T - T0) - (qWalls + qInt - qCool)) / 3.6e6;
  return {
    model: "cold_room", missing: [], assumptions, warnings: above > 0 ? [`Température au-dessus de la consigne + différentiel pendant ${r3(above)} h.`] : [],
    series: s, units: { t: "h", temp_c: "°C", compressor: "marche=1" },
    summary: {
      tMax: { value: r3(Math.max(...s.temp_c)), unit: "°C", label: "Température maximale" }, tMin: { value: r3(Math.min(...s.temp_c)), unit: "°C", label: "Température minimale" },
      above: { value: r3(above), unit: "h", label: "Durée hors consigne" }, onH: { value: r3(onH), unit: "h", label: "Durée de marche du groupe" },
      cool: { value: r3(qCool / 3.6e6), unit: "kWh", label: "Froid produit" },
    },
    balance: { label: "Bilan d'énergie (doit être nul)", residual: r3(Math.abs(residual)), unit: "kWh" },
  };
}

export const SCENARIOS = {
  solar_battery: { title: "Énergie solaire + batterie", schema: solarBatteryInput, run: solarBattery },
  tank: { title: "Réservoir et pompe", schema: tankInput, run: tank },
  cold_room: { title: "Chambre froide (coupure de courant)", schema: coldRoomInput, run: coldRoom },
} as const;
export type ScenarioKey = keyof typeof SCENARIOS;
