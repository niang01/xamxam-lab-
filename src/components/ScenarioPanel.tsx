"use client";
/**
 * Studio 4D : scénarios temporels (énergie solaire + batterie, réservoir + pompe, chambre froide) calculés par le
 * moteur xamxam-4d (src/lib/scenarios.ts), puis rejoués dans le temps (curseur et lecture animée).
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Pill, Select } from "./ui";
import { ProjectPicker } from "./ProjectPicker";
import { post } from "@/lib/client/api";
import type { ScenarioResult } from "@/lib/scenarios";

type FieldDef = { k: string; label: string; unit: string; example: string };
const MODELS: Record<string, { title: string; fields: FieldDef[]; profile?: { k: string; label: string } }> = {
  solar_battery: { title: "Énergie solaire + batterie", profile: { k: "loadProfileW", label: "Profil de charge horaire (24 valeurs en W, facultatif)" }, fields: [
    { k: "pvKwc", label: "Puissance crête PV", unit: "kWc", example: "1.2" }, { k: "dailyIrradiationKwhM2", label: "Irradiation journalière (NASA POWER, Earth & Space)", unit: "kWh/m²/j", example: "5.8" },
    { k: "performanceRatio", label: "Ratio de performance", unit: "0–1", example: "0.75" }, { k: "sunriseH", label: "Lever du soleil", unit: "h", example: "7" }, { k: "sunsetH", label: "Coucher du soleil", unit: "h", example: "19" },
    { k: "batteryKwh", label: "Capacité de la batterie", unit: "kWh", example: "4.8" }, { k: "socInitPct", label: "État de charge initial", unit: "%", example: "60" }, { k: "socMinPct", label: "État de charge minimal admis", unit: "%", example: "20" },
    { k: "chargeEff", label: "Rendement de charge", unit: "0–1", example: "0.9" }, { k: "loadW", label: "Charge constante (si pas de profil)", unit: "W", example: "200" }] },
  tank: { title: "Réservoir et pompe", profile: { k: "demandProfileM3h", label: "Profil de demande horaire (24 valeurs en m³/h, facultatif)" }, fields: [
    { k: "volumeM3", label: "Volume du réservoir", unit: "m³", example: "10" }, { k: "levelInitPct", label: "Niveau initial", unit: "%", example: "50" },
    { k: "pumpFlowM3h", label: "Débit de la pompe", unit: "m³/h", example: "3" }, { k: "pumpOnBelowPct", label: "Démarrage sous", unit: "%", example: "30" }, { k: "pumpOffAbovePct", label: "Arrêt au-dessus de", unit: "%", example: "95" },
    { k: "pumpHoursStart", label: "Pompage autorisé de", unit: "h", example: "8" }, { k: "pumpHoursEnd", label: "à", unit: "h", example: "17" }, { k: "demandM3h", label: "Demande constante (si pas de profil)", unit: "m³/h", example: "0.6" }] },
  cold_room: { title: "Chambre froide (coupure de courant)", fields: [
    { k: "uaWK", label: "Déperditions UA (Refrigeration Lab : wall_load)", unit: "W/K", example: "25" }, { k: "heatCapacityKJK", label: "Capacité thermique (air + produits)", unit: "kJ/K", example: "2000" },
    { k: "tOutC", label: "Température extérieure", unit: "°C", example: "35" }, { k: "tInitC", label: "Température initiale", unit: "°C", example: "4" },
    { k: "setpointC", label: "Consigne", unit: "°C", example: "3" }, { k: "differentialK", label: "Différentiel", unit: "K", example: "2" },
    { k: "coolingW", label: "Puissance frigorifique", unit: "W", example: "1500" }, { k: "internalW", label: "Apports internes", unit: "W", example: "100" },
    { k: "outageStartH", label: "Coupure de (facultatif)", unit: "h", example: "10" }, { k: "outageEndH", label: "à", unit: "h", example: "16" }] },
};
const MAIN: Record<string, { key: string; unit: string; max: number }> = { solar_battery: { key: "soc_pct", unit: "%", max: 100 }, tank: { key: "level_pct", unit: "%", max: 100 }, cold_room: { key: "temp_c", unit: "°C", max: 40 } };
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function ScenarioPanel() {
  const { t } = useApp();
  const [model, setModel] = useState("solar_battery");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState("");
  const [days, setDays] = useState("2");
  const [pid, setPid] = useState("");
  const [res, setRes] = useState<(ScenarioResult & { id: string; engine_version: string }) | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [frame, setFrame] = useState(0); const [play, setPlay] = useState(false);
  const m = MODELS[model];
  const n = res?.series?.t.length ?? 0;
  useEffect(() => {
    if (!play || !n) return;
    const id = setInterval(() => setFrame((f) => { if (f + 1 >= n) { setPlay(false); return f; } return f + 1; }), 60);
    return () => clearInterval(id);
  }, [play, n]);
  async function run() {
    setErr(null); setRes(null); setFrame(0);
    const input: Record<string, unknown> = Object.fromEntries(m.fields.map((f) => [f.k, num(vals[f.k] ?? "")]));
    if (m.profile && profile.trim()) { const p = profile.split(/[\s;]+/).filter(Boolean).map((x) => Number(x.replace(",", "."))); input[m.profile.k] = p; }
    if (model === "cold_room") input.hours = Number(days) * 24; else input.days = Number(days);
    try { setRes(await post("/api/scenarios", { model, input, project_id: pid || null })); } catch (e) { setErr(e); }
  }
  const main = MAIN[model];
  const chart = useMemo(() => {
    const s = res?.series; if (!s) return [];
    return Object.keys(s).filter((k) => k !== "t").map((k, i) => ({ name: `${k} (${res!.units[k] ?? ""})`, x: s.t, y: s[k], color: ["#8B5CF6", "#22C55E", "#F59E0B", "#06B6D4"][i % 4] }));
  }, [res]);
  const at = res?.series ? Object.fromEntries(Object.entries(res.series).map(([k, v]) => [k, v[Math.min(frame, v.length - 1)]])) : null;
  const level = at ? Math.max(0, Math.min(1, at[main.key] / main.max)) : 0;
  return (
    <Card title={t("sc.title")} testId="scenario-panel">
      <div className="flex flex-wrap gap-2 text-xs"><Nature kind="simulation" /><span>{t("sc.nature")}</span></div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Field label={t("sc.model")}><Select name="scenario-model" value={model} onChange={(e) => { setModel(e.target.value); setVals({}); setRes(null); setProfile(""); }}>{Object.entries(MODELS).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}</Select></Field>
        <Field label={model === "cold_room" ? t("sc.days") : t("sc.days")}><Input name="scenario-days" type="number" min={1} max={14} value={days} onChange={(e) => setDays(e.target.value)} className="!w-20" /></Field>
        <ProjectPicker value={pid} onChange={setPid} />
        <Btn kind="ghost" onClick={() => setVals(Object.fromEntries(m.fields.map((f) => [f.k, f.example])))} data-testid="scenario-example">{t("sc.example")}</Btn>
      </div>
      <p className="mt-1 text-xs text-[var(--fg-3)]">{t("sc.exampleInfo")}</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">{m.fields.map((f) => (
        <Field key={f.k} label={`${f.label} (${f.unit})`}><Input name={`sc-${f.k}`} inputMode="decimal" value={vals[f.k] ?? ""} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} /></Field>))}</div>
      {m.profile && <Field label={m.profile.label}><Input name="sc-profile" value={profile} onChange={(e) => setProfile(e.target.value)} /></Field>}
      <Btn className="mt-2" onClick={run} data-testid="scenario-run">{t("sc.run")}</Btn>
      <ErrorBox error={err} />
      {res && (
        <div className="mt-3 space-y-3 text-sm" data-testid="scenario-result">
          <p className="text-xs text-[var(--fg-3)]">{res.engine_version} · {t("sc.saved")}</p>
          {res.missing.length > 0 && <ul className="list-disc pl-5 text-[var(--warn)]">{res.missing.map((x) => <li key={x}>{t("sc.missing")} : {x}</li>)}</ul>}
          {res.series && <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{Object.entries(res.summary).map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--bg-2)] p-2"><div className="text-xs text-[var(--fg-3)]">{v.label}</div><div className="font-mono">{v.value} {v.unit}</div></div>)}</div>
            {res.balance && <p data-testid="scenario-balance"><Pill tone={res.balance.residual < 1e-6 ? "ok" : "warn"}>{res.balance.label} : {res.balance.residual} {res.balance.unit}</Pill></p>}
            {res.warnings.map((w) => <p key={w} className="text-[var(--warn)]">⚠ {w}</p>)}
            <LineChart xLabel="t (h)" series={chart} />
            <div className="rounded-lg border border-[var(--line)] p-3" data-testid="scenario-player">
              <div className="flex flex-wrap items-center gap-3">
                <Btn kind="ghost" onClick={() => { if (frame >= n - 1) setFrame(0); setPlay((p) => !p); }}>{play ? "⏸" : "▶"} {t("sc.play")}</Btn>
                <input type="range" min={0} max={Math.max(0, n - 1)} value={frame} onChange={(e) => { setPlay(false); setFrame(Number(e.target.value)); }} aria-label={t("sc.time")} className="min-w-40 flex-1" />
                <span className="font-mono text-xs">t = {at?.t} h</span>
              </div>
              <div className="mt-3 flex items-end gap-4">
                <svg viewBox="0 0 60 120" className="h-32 w-16" aria-label={main.key}>
                  <rect x={10} y={5} width={40} height={110} rx={6} fill="none" stroke="var(--fg-2)" />
                  <rect x={12} y={7 + 106 * (1 - level)} width={36} height={106 * level} rx={4} fill={model === "cold_room" ? (at && at.temp_c > 8 ? "var(--danger)" : "var(--cyan)") : "var(--ok)"} />
                </svg>
                <ul className="text-xs">{at && Object.entries(at).filter(([k]) => k !== "t").map(([k, v]) => <li key={k}><span className="text-[var(--fg-3)]">{k}</span> : <span className="font-mono">{v} {res.units[k]}</span></li>)}</ul>
              </div>
            </div>
            <details className="text-xs"><summary className="cursor-pointer">{t("sc.assumptions")}</summary><ul className="mt-1 list-disc pl-5">{res.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
          </>}
        </div>
      )}
    </Card>
  );
}
