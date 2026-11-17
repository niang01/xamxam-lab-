/**
 * Registre des calculs d'ingénierie : schéma d'entrée (zod) + fonction pure. Utilisé par l'API (/api/calc/[kind])
 * et par les outils de XAM-XAM AI CORE — l'IA ne calcule jamais elle-même : elle appelle ce registre.
 */
import { z } from "zod";
import * as el from "@/lib/eng/electrical";
import * as so from "@/lib/eng/solar";
import * as me from "@/lib/eng/mechanical";
import * as th from "@/lib/eng/thermal";
import * as nw from "@/lib/eng/network";
import { result, type CalcResult } from "@/lib/eng/result";
import { sql, sqlOne } from "./db";
import { ApiFailure } from "./api";

const n = z.number().finite().nullable();
const sys = z.enum(["single", "three"]);

interface CalcDef<S extends z.ZodType> { lab: string; description: string; schema: S; run: (i: z.infer<S>) => Promise<CalcResult> | CalcResult }
const def = <S extends z.ZodType>(d: CalcDef<S>) => d;

export const CALCS = {
  ohm: def({ lab: "electrical", description: "Loi d'Ohm : deux grandeurs parmi U (V), I (A), R (Ω).", schema: z.object({ u: n.optional(), i: n.optional(), r: n.optional() }), run: (i) => el.ohm(i) }),
  ac_power: def({ lab: "electrical", description: "Puissances S, P, Q en alternatif (mono/triphasé).", schema: z.object({ system: sys, u: n, i: n, cosPhi: n }), run: (i) => el.acPower(i) }),
  design_current: def({ lab: "electrical", description: "Courant d'emploi à partir de la puissance.", schema: z.object({ system: sys, pW: n, u: n, cosPhi: n, efficiency: n }), run: (i) => el.designCurrent(i) }),
  voltage_drop: def({ lab: "electrical", description: "Chute de tension d'une canalisation (λ requise si cos φ < 1).", schema: z.object({ system: sys, u: n, i: n, lengthM: n, sectionMm2: n, conductor: z.enum(["copper", "aluminium"]), tempC: n, cosPhi: n, lambdaOhmPerM: n.optional() }), run: (i) => el.voltageDrop(i) }),
  cable_section: def({
    lab: "electrical", description: "Choix de section d'après un tableau normatif enregistré (aucun tableau n'est fourni d'office).",
    schema: z.object({ inA: n, correctionFactors: z.array(z.number().positive().max(2)).max(10), tableId: z.string().uuid().nullable() }),
    run: async (i) => {
      const t = i.tableId ? await sqlOne<{ standard: string; table_ref: string; description: string; data: { rows: { s: number; iz: number }[] } }>("SELECT standard, table_ref, description, data FROM normative_tables WHERE id=$1", [i.tableId]) : null;
      return el.cableSection({ inA: i.inA, correctionFactors: i.correctionFactors, table: t ? { reference: `${t.standard} — ${t.table_ref} (${t.description})`, rows: t.data.rows } : null });
    },
  }),
  power_balance: def({ lab: "electrical", description: "Bilan de puissance avec coefficients saisis.", schema: z.object({ loads: z.array(z.object({ name: z.string().max(80), pW: z.number().nonnegative(), qty: z.number().int().positive(), ku: n, ks: n })).min(1).max(100) }), run: (i) => el.powerBalance(i.loads) }),
  pv_production: def({ lab: "solar", description: "Production PV mensuelle E = Pc × H × PR.", schema: z.object({ peakKw: n, monthlyIrradiation: z.array(n).length(12), performanceRatio: n, plane: z.enum(["horizontal", "plane_of_array"]) }), run: (i) => so.pvProduction(i) }),
  string_sizing: def({ lab: "solar", description: "Associations série/parallèle vs plage MPPT.", schema: z.object({ vocStc: n, vmpStc: n, iscStc: n, betaVocPct: n, gammaVmpPct: n, tMinC: n, tMaxCellC: n, vMaxDc: n, mpptMin: n, mpptMax: n, iMaxInput: n, modules: n }), run: (i) => so.stringSizing(i) }),
  battery: def({ lab: "solar", description: "Capacité du parc de batteries.", schema: z.object({ dailyWh: n, autonomyDays: n, voltage: n, dod: n, efficiency: n }), run: (i) => so.batterySizing(i) }),
  pump: def({ lab: "solar", description: "Puissance d'une pompe (hydraulique et électrique).", schema: z.object({ flowM3h: n, headM: n, pumpEff: n, motorEff: n, dailyVolumeM3: n }), run: (i) => so.pumpSizing(i) }),
  economics: def({ lab: "solar", description: "LCOE et temps de retour.", schema: z.object({ capex: n, opexPerYear: n, annualKwh: n, years: n, discountRate: n, tariffPerKwh: n, currency: z.string().max(8) }), run: (i) => so.economics(i) }),
  torque: def({ lab: "mechanical", description: "Couple à partir de la puissance et de la vitesse.", schema: z.object({ powerW: n, rpm: n }), run: (i) => me.torque(i) }),
  gear_train: def({ lab: "mechanical", description: "Train d'engrenages.", schema: z.object({ stages: z.array(z.object({ z1: z.number().int().positive(), z2: z.number().int().positive() })).max(10), rpmIn: n, torqueIn: n, stageEfficiency: n }), run: (i) => me.gearTrain(i) }),
  cylinder: def({ lab: "mechanical", description: "Force d'un vérin.", schema: z.object({ pressureBar: n, boreMm: n, efficiency: n }), run: (i) => me.cylinderForce(i) }),
  carnot_cop: def({ lab: "refrigeration", description: "COP de Carnot (limite théorique).", schema: z.object({ tColdC: n, tHotC: n }), run: (i) => th.carnotCop(i) }),
  measured_cop: def({ lab: "refrigeration", description: "COP à partir de deux puissances mesurées.", schema: z.object({ usefulW: n, electricW: n }), run: (i) => th.measuredCop(i) }),
  wall_load: def({ lab: "refrigeration", description: "Flux thermique à travers les parois.", schema: z.object({ walls: z.array(z.object({ name: z.string().max(60), u: n, areaM2: n })).max(30), tInC: n, tOutC: n }), run: (i) => th.wallLoad(i) }),
  subnet: def({
    lab: "network", description: "Calcul d'un sous-réseau IPv4 (CIDR).", schema: z.object({ cidr: z.string().max(40) }),
    run: (i) => {
      const s = nw.subnet(i.cidr);
      if (!s) return result({ missing: ["adresse CIDR valide (ex. 192.168.1.0/24)"] });
      return result({ outputs: { hosts: { value: s.hosts, unit: "hôtes", label: "Hôtes utilisables" }, prefix: { value: s.prefix, unit: "", label: "Préfixe" } }, formulas: ["hôtes = 2^(32−p) − 2"], warnings: [`Réseau ${s.network}/${s.prefix} · masque ${s.mask} · diffusion ${s.broadcast} · plage ${s.first} – ${s.last}`] });
    },
  }),
  vlsm: def({
    lab: "network", description: "Découpage VLSM d'un bloc.", schema: z.object({ block: z.string().max(40), needs: z.array(z.object({ name: z.string().max(40), hosts: z.number().int().positive().max(16_000_000) })).min(1).max(50) }),
    run: (i) => {
      const r = nw.vlsm(i.block, i.needs);
      return { ...r, warnings: [...r.warnings, ...(r.subnets ?? []).map((s) => `${s.name} : ${s.network}/${s.prefix} (${s.first} – ${s.last}, ${s.hosts} hôtes)`)] };
    },
  }),
} as const;

export type CalcKind = keyof typeof CALCS;
export const CALC_KINDS = Object.keys(CALCS) as CalcKind[];

export async function runCalc(kind: string, input: unknown, ctx: { userId: string; projectId: string | null; by: "human" | "ai" }) {
  const d = (CALCS as Record<string, CalcDef<z.ZodType>>)[kind];
  if (!d) throw new ApiFailure(404, `Calcul inconnu : ${kind}`, "err.notFound");
  const parsed = d.schema.parse(input);
  const r = await d.run(parsed);
  const row = (await sql<{ id: string }>(`INSERT INTO calc_runs(project_id, user_id, calc_kind, inputs, outputs, missing, initiated_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [ctx.projectId, ctx.userId, kind, JSON.stringify(parsed), JSON.stringify(r), JSON.stringify(r.missing), ctx.by]))[0];
  return { id: row.id, result: r };
}
