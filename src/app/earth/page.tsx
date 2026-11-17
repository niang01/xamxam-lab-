"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Page, Select, Unavailable } from "@/components/ui";
import { api } from "@/lib/client/api";

type Geo = { source: string; nature: "modelled" | "prediction"; resolution: string; period: string; fetched_at: string; url: string; parameters: Record<string, { label: string; unit: string; values: { period: string; value: number | null }[] }> };

const DAILY = ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "PRECTOTCORR", "WS2M", "ALLSKY_SFC_SW_DWN", "GWETROOT"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

function csv(g: Geo) {
  const params = Object.keys(g.parameters);
  const periods = g.parameters[params[0]]?.values.map((v) => v.period) ?? [];
  const lines = [`# ${g.source} | ${g.nature} | ${g.resolution} | récupéré ${g.fetched_at}`, ["period", ...params.map((p) => `${p} (${g.parameters[p].unit})`)].join(",")];
  periods.forEach((p, i) => lines.push([p, ...params.map((k) => g.parameters[k].values[i]?.value ?? "")].join(",")));
  return lines.join("\n");
}

function GeoView({ g }: { g: Geo }) {
  const t = useT();
  const keys = Object.keys(g.parameters);
  const [k, setK] = useState(keys[0]);
  const p = g.parameters[k];
  return (
    <div className="space-y-2 text-sm" data-testid="geo-result">
      <div className="flex flex-wrap items-center gap-2"><Nature kind={g.nature} /><strong>{g.source}</strong><span className="text-xs text-[var(--fg-3)]">{g.period}</span></div>
      <p className="text-xs text-[var(--fg-3)]">{t("geo.resolution")} : {g.resolution} · {t("geo.fetched")} {new Date(g.fetched_at).toLocaleString()}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("earth.parameter")}><Select value={k} onChange={(e) => setK(e.target.value)} className="!w-auto">{keys.map((x) => <option key={x} value={x}>{g.parameters[x].label} ({x})</option>)}</Select></Field>
        <Btn kind="ghost" onClick={() => { const b = new Blob([csv(g)], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "xamxam-earth.csv"; a.click(); }}>{t("c.export")} CSV</Btn>
      </div>
      {p && <LineChart xLabel={t("earth.index")} yLabel={p.unit} series={[{ name: p.label, x: p.values.map((_, i) => i + 1), y: p.values.map((v) => v.value ?? NaN) }]} height={220} />}
      {p && <p className="text-xs text-[var(--fg-3)]">{p.values[0]?.period} → {p.values.at(-1)?.period} · {t("earth.missing", { n: p.values.filter((v) => v.value == null).length })}</p>}
    </div>
  );
}

export default function Earth() {
  const t = useT();
  const [loc, setLoc] = useState({ lat: "", lon: "" });
  const today = new Date();
  const [range, setRange] = useState({ start: iso(new Date(today.getTime() - 60 * 86400000)), end: iso(new Date(today.getTime() - 3 * 86400000)) });
  const [res, setRes] = useState<Record<string, Geo | null>>({});
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState("");
  const qs = `lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lon)}`;
  async function load(kind: string, url: string) {
    setBusy(kind); setErr(null);
    try { setRes((r) => ({ ...r, [kind]: null })); const g = await api<Geo>(url); setRes((r) => ({ ...r, [kind]: g })); } catch (e) { setErr(e); } finally { setBusy(""); }
  }
  return (
    <Page title={t("nav.earth")} subtitle={t("earth.subtitle")}>
      <Card title={t("earth.point")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("geo.lat")}><Input name="lat" value={loc.lat} onChange={(e) => setLoc({ ...loc, lat: e.target.value })} className="!w-32" /></Field>
          <Field label={t("geo.lon")}><Input name="lon" value={loc.lon} onChange={(e) => setLoc({ ...loc, lon: e.target.value })} className="!w-32" /></Field>
          <Btn kind="ghost" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setLoc({ lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4) }), (e) => setErr(new Error(e.message)))}>{t("geo.here")}</Btn>
        </div>
        <ErrorBox error={err} />
      </Card>
      <Card title={t("earth.daily")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("earth.start")}><Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></Field>
          <Field label={t("earth.end")}><Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></Field>
          <Btn disabled={!loc.lat || !loc.lon || !!busy} onClick={() => load("daily", `/api/geo/daily?${qs}&start=${range.start}&end=${range.end}&params=${DAILY.join(",")}`)} data-testid="load-daily">{busy === "daily" ? t("c.loading") : t("earth.load")}</Btn>
        </div>
        <p className="mt-1 text-xs text-[var(--fg-3)]">{t("earth.latency")}</p>
        {res.daily && <div className="mt-3"><GeoView g={res.daily} /></div>}
      </Card>
      <Card title={t("earth.climatology")}>
        <Btn disabled={!loc.lat || !loc.lon || !!busy} onClick={() => load("clim", `/api/geo/climatology?${qs}&params=ALLSKY_SFC_SW_DWN,T2M,PRECTOTCORR,WS2M,RH2M`)}>{busy === "clim" ? t("c.loading") : t("earth.load")}</Btn>
        {res.clim && <div className="mt-3"><GeoView g={res.clim} /></div>}
      </Card>
      <Card title={t("earth.forecast")}>
        <Btn disabled={!loc.lat || !loc.lon || !!busy} onClick={() => load("fc", `/api/geo/forecast?${qs}&days=7`)}>{busy === "fc" ? t("c.loading") : t("earth.load")}</Btn>
        <p className="mt-1 text-xs text-[var(--fg-3)]">{t("earth.forecastNote")}</p>
        {res.fc && <div className="mt-3"><GeoView g={res.fc} /></div>}
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        <Unavailable title="NASA GIBS · MODIS · Landsat (cartographie)" reason={t("earth.gibsReason")} phase={7} />
        <Unavailable title="SMAP · NDVI Sentinel-2" reason={t("earth.smapReason")} phase={7} />
      </div>
    </Page>
  );
}
