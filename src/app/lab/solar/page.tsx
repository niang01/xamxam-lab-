"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { CalcForm } from "@/components/CalcForm";
import { PvHourly } from "@/components/PvHourly";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Page } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { CalcResult } from "@/lib/eng/result";

type Geo = { source: string; resolution: string; period: string; fetched_at: string; parameters: Record<string, { label: string; unit: string; values: { period: string; value: number | null }[] }> };

export default function Solar() {
  const t = useT();
  const [pid, setPid] = useState("");
  const [loc, setLoc] = useState({ lat: "", lon: "" });
  const [geo, setGeo] = useState<Geo | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [prod, setProd] = useState<CalcResult | null>(null);
  const [key, setKey] = useState(0);
  const irr = geo?.parameters.ALLSKY_SFC_SW_DWN?.values.map((v) => (v.value == null ? "" : String(v.value))) ?? Array(12).fill("");

  async function load() {
    setBusy(true); setErr(null);
    try { setGeo(await api<Geo>(`/api/geo/climatology?lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lon)}&params=ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN`)); setKey((k) => k + 1); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  }
  function here() {
    navigator.geolocation?.getCurrentPosition((p) => setLoc({ lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4) }), (e) => setErr(new Error(e.message)));
  }
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <Page title={t("nav.solar")} subtitle={t("lab.solar.desc")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      <Card title={t("solar.site")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("geo.lat")}><Input name="lat" value={loc.lat} onChange={(e) => setLoc({ ...loc, lat: e.target.value })} className="!w-32" /></Field>
          <Field label={t("geo.lon")}><Input name="lon" value={loc.lon} onChange={(e) => setLoc({ ...loc, lon: e.target.value })} className="!w-32" /></Field>
          <Btn kind="ghost" onClick={here}>{t("geo.here")}</Btn>
          <Btn onClick={load} disabled={busy || !loc.lat || !loc.lon} data-testid="load-irradiation">{busy ? t("c.loading") : t("solar.loadNasa")}</Btn>
        </div>
        <div className="mt-3"><ErrorBox error={err} /></div>
        {geo && (
          <div className="mt-3 space-y-2 text-sm" data-testid="nasa-climatology">
            <div className="flex flex-wrap items-center gap-2"><Nature kind="modelled" /><span>{geo.source} · {geo.period}</span></div>
            <p className="text-xs text-[var(--fg-3)]">{t("geo.resolution")} : {geo.resolution} · {t("geo.fetched")} {new Date(geo.fetched_at).toLocaleString()}</p>
            <LineChart xLabel={t("geo.month")} yLabel="kWh/m²/j" series={[{ name: t("solar.ghi"), x: months, y: geo.parameters.ALLSKY_SFC_SW_DWN.values.map((v) => v.value ?? NaN) }]} height={200} />
            <p className="text-xs text-[var(--fg-2)]">{t("solar.tempRange")} : {Math.min(...geo.parameters.T2M_MIN.values.map((v) => v.value ?? Infinity))} °C → {Math.max(...geo.parameters.T2M_MAX.values.map((v) => v.value ?? -Infinity))} °C ({t("solar.tempNote")})</p>
          </div>
        )}
      </Card>
      <CalcForm key={`prod-${key}`} projectId={pid} kind="pv_production" onResult={setProd}
        fields={[{ k: "peakKw", type: "num" }, { k: "performanceRatio", type: "num" }, { k: "plane", type: "select", options: [{ v: "horizontal", l: "f.horizontal" }, { v: "plane_of_array", l: "f.plane_of_array" }] }, { k: "monthlyIrradiation", type: "months" }]}
        initial={{ monthlyIrradiation: irr, plane: "horizontal" }} />
      {prod?.ok && (
        <Card title={t("solar.monthly")}>
          <LineChart xLabel={t("geo.month")} yLabel="kWh" series={[{ name: t("calc.pv_production"), x: months, y: months.map((m) => prod.outputs[`m${m}`]?.value ?? NaN) }]} height={200} />
        </Card>
      )}
      <PvHourly projectId={pid} lat={loc.lat} lon={loc.lon} />
      <CalcForm projectId={pid} kind="string_sizing" fields={["vocStc", "vmpStc", "iscStc", "betaVocPct", "gammaVmpPct", "tMinC", "tMaxCellC", "vMaxDc", "mpptMin", "mpptMax", "iMaxInput", "modules"].map((k) => ({ k, type: "num" as const }))} />
      <CalcForm projectId={pid} kind="battery" fields={["dailyWh", "autonomyDays", "voltage", "dod", "efficiency"].map((k) => ({ k, type: "num" as const }))} />
      <CalcForm projectId={pid} kind="pump" fields={["flowM3h", "headM", "pumpEff", "motorEff", "dailyVolumeM3"].map((k) => ({ k, type: "num" as const }))} />
      <CalcForm projectId={pid} kind="economics" fields={[...["capex", "opexPerYear", "annualKwh", "years", "discountRate", "tariffPerKwh"].map((k) => ({ k, type: "num" as const })), { k: "currency", type: "text" as const }]}
        initial={{ currency: "FCFA", annualKwh: prod?.outputs.year ? String(prod.outputs.year.value) : "" }} key={`eco-${prod?.outputs.year?.value ?? 0}`} />
    </Page>
  );
}
