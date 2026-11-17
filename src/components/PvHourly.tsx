"use client";
/** Simulation photovoltaïque horaire (pvlib) sur une année réelle NASA POWER — paramètres tous fournis par l'utilisateur. */
import Link from "next/link";
import { useState } from "react";
import { useT } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Select, num } from "./ui";
import { post } from "@/lib/client/api";

type R = { id: string; engine: string; weather: { source: string; fetched_at: string }; result: { hours: number; missing_hours: number; monthly: { month: number; energy_kwh: number; poa_kwh_m2: number; ghi_kwh_m2: number }[]; annual_kwh: number; specific_yield_kwh_kwp: number; poa_kwh_m2: number; performance_ratio: number | null; tcell_max_c: number; models: Record<string, string> } };
const F = ["lat", "lon", "year", "tilt", "azimuth", "pdc0_kw", "gamma_pdc_pct", "losses_pct", "inverter_eff", "dc_ac_ratio"] as const;

export function PvHourly({ projectId, lat, lon }: { projectId: string; lat: string; lon: string }) {
  const t = useT();
  const [v, setV] = useState<Record<string, string>>({ year: String(new Date().getUTCFullYear() - 1) });
  const [tm, setTm] = useState("open_rack_glass_glass");
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const val = (k: string) => v[k] ?? (k === "lat" ? lat : k === "lon" ? lon : "");
  async function run() {
    setBusy(true); setErr(null); setR(null);
    try {
      const body: Record<string, unknown> = { project_id: projectId || null, temp_model: tm };
      for (const k of F) body[k] = num(val(k));
      setR(await post<R>("/api/compute/pv-hourly", body));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }
  return (
    <Card title={t("pvh.title")} testId="pv-hourly">
      <p className="mb-2 text-xs text-[var(--fg-3)]">{t("pvh.info")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {F.map((k) => <Field key={k} label={t(`pvh.${k}` as "pvh.lat")}><Input name={`pvh-${k}`} value={val(k)} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
        <Field label={t("pvh.temp_model")}><Select value={tm} onChange={(e) => setTm(e.target.value)}>{["open_rack_glass_glass", "close_mount_glass_glass", "open_rack_glass_polymer", "insulated_back_glass_polymer"].map((m) => <option key={m}>{m}</option>)}</Select></Field>
      </div>
      <Btn className="mt-3" onClick={run} disabled={busy} data-testid="run-pv-hourly">{busy ? t("pvh.running") : t("pvh.run")}</Btn>
      <div className="mt-3"><ErrorBox error={err} /></div>
      {r && (
        <div className="mt-3 space-y-2 text-sm" data-testid="pv-hourly-result">
          <div className="flex flex-wrap items-center gap-2"><Nature kind="simulation" /><span>{r.engine}</span><Nature kind="modelled" /><span className="text-xs text-[var(--fg-3)]">{r.weather.source}</span><Link href={`/studio?sim=${r.id}`} className="text-xs text-[var(--cyan)] underline">{t("sim.openStudio")}</Link></div>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>{t("pvh.annual")} : <strong className="font-mono">{r.result.annual_kwh.toLocaleString()} kWh</strong></li>
            <li>{t("pvh.yield")} : <strong className="font-mono">{r.result.specific_yield_kwh_kwp} kWh/kWc</strong></li>
            <li>{t("pvh.poa")} : <span className="font-mono">{r.result.poa_kwh_m2} kWh/m²</span></li>
            <li>PR : <span className="font-mono">{r.result.performance_ratio ?? "—"}</span> · {t("pvh.tcell")} <span className="font-mono">{r.result.tcell_max_c} °C</span></li>
          </ul>
          <LineChart xLabel={t("geo.month")} yLabel="kWh" series={[{ name: t("pvh.monthly"), x: r.result.monthly.map((m) => m.month), y: r.result.monthly.map((m) => m.energy_kwh) }]} height={200} />
          <p className="text-xs text-[var(--fg-3)]">{t("pvh.models")} : {Object.entries(r.result.models).map(([k, m]) => `${k} = ${m}`).join(" · ")} · {r.result.hours} h ({r.result.missing_hours} {t("pvh.missing")})</p>
        </div>
      )}
    </Card>
  );
}
