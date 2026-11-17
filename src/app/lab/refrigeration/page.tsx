"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { CalcForm } from "@/components/CalcForm";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Page, Select, num } from "@/components/ui";
import { api, post } from "@/lib/client/api";

const FLUIDS = ["R134a", "R404A", "R410A", "R407C", "R32", "R290", "R600a", "R1234yf", "R717", "R744"];
type State = { point: number; name: string; T_C: number; P_kPa: number; h_kJkg: number; s_kJkgK: number };
type Cycle = { engine: string; result: { states: State[]; q_evap_kJkg: number; w_comp_kJkg: number; q_cond_kJkg: number; cop: number; cop_carnot: number; pressure_ratio: number; mass_flow_kgs?: number; compressor_kw?: number; condenser_kw?: number } };
type Sat = { points: { P_kPa: number; h_liq: number; h_vap: number }[] };

export default function Refrigeration() {
  const t = useT();
  const [pid, setPid] = useState("");
  const [fluid, setFluid] = useState("R134a");
  const [v, setV] = useState<Record<string, string>>({});
  const [cyc, setCyc] = useState<Cycle | null>(null);
  const [sat, setSat] = useState<Sat | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const keys = ["t_evap_c", "t_cond_c", "superheat_k", "subcool_k", "isentropic_eff", "cooling_kw"] as const;
  async function run() {
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = { project_id: pid || null, fluid };
      for (const k of keys) body[k] = num(v[k] ?? "");
      const [c, s] = await Promise.all([post<Cycle>("/api/compute/thermo-cycle", body), api<Sat>(`/api/compute/saturation?fluid=${fluid}`)]);
      setCyc(c); setSat(s);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }
  const st = cyc?.result.states ?? [];
  const loop = [...st, st[0]].filter(Boolean);
  return (
    <Page title={t("nav.refrigeration")} subtitle={t("lab.refrigeration.desc")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      <Card title={t("frig.cycle")} testId="thermo-cycle">
        <p className="mb-2 text-xs text-[var(--fg-3)]">{t("frig.cycleInfo")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("frig.fluid")}><Select name="fluid" value={fluid} onChange={(e) => setFluid(e.target.value)}>{FLUIDS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
          {keys.map((k) => <Field key={k} label={t(`frig.${k}`)}><Input name={k} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
        </div>
        <Btn className="mt-3" onClick={run} disabled={busy} data-testid="run-thermo">{t("c.calculate")}</Btn>
        <div className="mt-3"><ErrorBox error={err} /></div>
        {cyc && (
          <div className="mt-3 space-y-3 text-sm" data-testid="thermo-result">
            <div className="flex items-center gap-2"><Nature kind="calculation" /><span>{cyc.engine}</span></div>
            <table className="w-full text-left text-xs"><thead className="text-[var(--fg-3)]"><tr><th>#</th><th>{t("c.name")}</th><th>T (°C)</th><th>P (kPa)</th><th>h (kJ/kg)</th><th>s (kJ/kg·K)</th></tr></thead>
              <tbody>{st.map((x) => <tr key={x.point} className="border-t border-[var(--line)] font-mono"><td>{x.point}</td><td className="font-sans">{x.name}</td><td>{x.T_C.toFixed(2)}</td><td>{x.P_kPa.toFixed(1)}</td><td>{x.h_kJkg.toFixed(2)}</td><td>{x.s_kJkgK.toFixed(4)}</td></tr>)}</tbody></table>
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>COP : <strong className="font-mono" data-testid="cop">{cyc.result.cop.toFixed(3)}</strong> ({t("frig.carnot")} {cyc.result.cop_carnot.toFixed(3)})</li>
              <li>{t("frig.ratio")} : <span className="font-mono">{cyc.result.pressure_ratio.toFixed(2)}</span></li>
              <li>q₀ = {cyc.result.q_evap_kJkg.toFixed(2)} kJ/kg · w = {cyc.result.w_comp_kJkg.toFixed(2)} kJ/kg</li>
              {cyc.result.mass_flow_kgs != null && <li>ṁ = {cyc.result.mass_flow_kgs.toFixed(4)} kg/s · {t("frig.compressor")} {cyc.result.compressor_kw!.toFixed(3)} kW · {t("frig.condenser")} {cyc.result.condenser_kw!.toFixed(3)} kW</li>}
            </ul>
            {sat && <LineChart xLabel="h (kJ/kg)" yLabel={t("frig.logp")} series={[
              { name: t("frig.liquid"), x: sat.points.map((p) => p.h_liq), y: sat.points.map((p) => Math.log10(p.P_kPa)), color: "#1E5BFF" },
              { name: t("frig.vapour"), x: sat.points.map((p) => p.h_vap), y: sat.points.map((p) => Math.log10(p.P_kPa)), color: "#22E3FF" },
              { name: t("frig.cycleCurve"), x: loop.map((s) => s.h_kJkg), y: loop.map((s) => Math.log10(s.P_kPa)), color: "#EF4444" },
            ]} />}
          </div>
        )}
      </Card>
      <CalcForm projectId={pid} kind="carnot_cop" fields={[{ k: "tColdC", type: "num" }, { k: "tHotC", type: "num" }]} />
      <CalcForm projectId={pid} kind="measured_cop" fields={[{ k: "usefulW", type: "num" }, { k: "electricW", type: "num" }]} />
      <CalcForm projectId={pid} kind="wall_load" fields={[{ k: "walls", type: "rows", cols: [{ k: "name", type: "text" }, { k: "u", type: "num", l: "f.uWall" }, { k: "areaM2", type: "num" }] }, { k: "tInC", type: "num" }, { k: "tOutC", type: "num" }]} initial={{ walls: [{}] }} />
    </Page>
  );
}
