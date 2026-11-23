"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/providers";
import { Card, Field, Input, LineChart, Nature, Page, Pill, Select, Unavailable } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { compare } from "@/lib/compare";
import { ScenarioPanel } from "@/components/ScenarioPanel";

const AssemblyEditor = dynamic(() => import("@/components/AssemblyEditor").then((m) => m.AssemblyEditor), { ssr: false });
const StlViewer = dynamic(() => import("@/components/StlViewer").then((m) => m.StlViewer), { ssr: false });

type SimRow = { id: string; engine_version: string; analysis: string; status: string; created_at: string; project_title: string | null; kind: string };
type Sim = SimRow & { result: { traces: { name: string; type: string; values: number[]; imag?: number[] }[]; complex: boolean; pv?: { monthly: { month: number; energy_kwh: number }[]; annual_kwh: number } } | null; errors: string[]; input: string; input_hash: string; duration_ms: number };
type Dev = { id: string; name: string; capabilities: { metrics: { metric: string }[] } };
type M = { ts: string; value: number; quality: string };

export default function Studio() {
  const t = useT();
  const { data: list } = useData<{ items: SimRow[] }>("/api/simulations");
  const [simId, setSimId] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec une source externe (URL, session, WebGL)
  useEffect(() => { const s = new URLSearchParams(window.location.search).get("sim"); if (s) setSimId(s); }, []);
  const { data: sim } = useData<Sim>(simId ? `/api/simulations/${simId}` : null);
  const [trace, setTrace] = useState("");
  const { data: devs } = useData<{ items: Dev[] }>("/api/devices");
  const [dev, setDev] = useState(""); const [metric, setMetric] = useState(""); const [scale, setScale] = useState("1");
  const { data: meas } = useData<{ items: M[] }>(dev && metric ? `/api/devices/${dev}/measurements?metric=${encodeURIComponent(metric)}&limit=2000` : null);
  const [stl, setStl] = useState<File | null>(null);

  const x = sim?.result?.traces?.[0];
  const ys = useMemo(() => (sim?.result?.traces ?? []).slice(1), [sim]);
  const sel = ys.find((y) => y.name === trace) ?? ys[0];
  const valid = (meas?.items ?? []).filter((m) => m.quality === "valid");
  const t0 = valid[0] ? Date.parse(valid[0].ts) : 0;
  const k = Number(scale) || 1;
  const mX = valid.map((m) => (Date.parse(m.ts) - t0) / 1000 / k);
  const mY = valid.map((m) => m.value);
  const cmp = x && sel && x.name === "time" && valid.length ? compare(x.values, sel.values, mX, mY) : null;

  return (
    <Page title={t("nav.studio")} subtitle={t("studio.subtitle")}>
      <div className="flex flex-wrap gap-2 text-xs"><Nature kind="animation" /><span>{t("studio.nAnim")}</span><Nature kind="simulation" /><span>{t("studio.nSim")}</span><Nature kind="measurement" /><span>{t("studio.nMeas")}</span></div>
      <Card title={t("studio.sims")}>
        <Select value={simId} onChange={(e) => setSimId(e.target.value)} aria-label={t("studio.sims")}>
          <option value="">—</option>
          {list?.items.map((s) => <option key={s.id} value={s.id}>{new Date(s.created_at).toLocaleString()} · {s.analysis} · {s.status}{s.project_title ? ` · ${s.project_title}` : ""}</option>)}
        </Select>
        {sim && (
          <div className="mt-3 space-y-2 text-sm" data-testid="studio-sim">
            <div className="flex flex-wrap items-center gap-2"><Nature kind="simulation" /><span>{sim.engine_version}</span><Pill tone={sim.status === "done" ? "ok" : "danger"}>{sim.status}</Pill><span className="text-xs text-[var(--fg-3)]">{sim.duration_ms} ms · SHA-256 {sim.input_hash.slice(0, 12)}…</span></div>
            {sim.result?.pv && <LineChart xLabel={t("geo.month")} yLabel="kWh" series={[{ name: `${t("pvh.monthly")} — ${sim.result.pv.annual_kwh} kWh/an`, x: sim.result.pv.monthly.map((m) => m.month), y: sim.result.pv.monthly.map((m) => m.energy_kwh), color: "#8B5CF6" }]} />}
            {sim.status !== "done" && <pre className="text-xs text-[var(--danger)]">{sim.errors.join("\n")}</pre>}
            {x && ys.length > 0 && <>
              <Field label={t("studio.trace")}><Select value={sel?.name} onChange={(e) => setTrace(e.target.value)} className="!w-auto">{ys.map((y) => <option key={y.name}>{y.name}</option>)}</Select></Field>
              <LineChart logX={x.name === "frequency"} xLabel={x.name === "time" ? "t (s)" : x.name} yLabel={sel.type}
                series={[{ name: `${sel.name} (${t("nature.simulation")})`, x: x.values, y: sim.result!.complex ? sel.values.map((v, i) => Math.hypot(v, sel.imag?.[i] ?? 0)) : sel.values, color: "#8B5CF6" },
                  ...(x.name === "time" && valid.length ? [{ name: `${metric} (${t("nature.measurement")})`, x: mX, y: mY, color: "#22C55E", dashed: true }] : [])]} />
            </>}
            {x && x.name === "time" && (
              <div className="rounded-lg border border-[var(--line)] p-3">
                <div className="mb-2 font-semibold">{t("studio.compare")}</div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t("iot.device")}><Select value={dev} onChange={(e) => { setDev(e.target.value); setMetric(""); }} className="!w-auto"><option value="">—</option>{devs?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
                  <Field label={t("iot.metric")}><Select value={metric} onChange={(e) => setMetric(e.target.value)} className="!w-auto"><option value="">—</option>{devs?.items.find((d) => d.id === dev)?.capabilities.metrics.map((m) => <option key={m.metric}>{m.metric}</option>)}</Select></Field>
                  <Field label={t("studio.scale")} hint={t("studio.scaleHint")}><Input value={scale} onChange={(e) => setScale(e.target.value)} className="!w-24" /></Field>
                </div>
                {cmp && (
                  <p className="mt-2 text-xs" data-testid="comparison">{cmp.n ? t("studio.cmpResult", { n: cmp.n, mean: cmp.meanAbs!.toPrecision(4), max: cmp.maxAbs!.toPrecision(4), rmse: cmp.rmse!.toPrecision(4) }) : t("studio.cmpNone")} {cmp.outside ? t("studio.cmpOutside", { n: cmp.outside }) : ""} <span className="text-[var(--fg-3)]">{t("studio.interpNote")}</span></p>
                )}
                {dev && metric && !valid.length && <p className="mt-2 text-xs text-[var(--fg-3)]">{t("studio.noValid")}</p>}
              </div>
            )}
          </div>
        )}
      </Card>
      <ScenarioPanel />
      <AssemblyEditor />
      <Card title={t("studio.viewer3d")}>
        <p className="mb-2 text-xs text-[var(--fg-3)]">{t("studio.viewerInfo")}</p>
        <input type="file" accept=".stl,model/stl" onChange={(e) => setStl(e.target.files?.[0] ?? null)} className="text-sm" aria-label={t("studio.viewer3d")} />
        <div className="mt-3"><StlViewer file={stl} /></div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        <Unavailable title={t("studio.twin")} reason={t("studio.twinReason")} phase={4} />
        <Unavailable title={t("studio.physics")} reason={t("studio.physicsReason")} phase={4} />
      </div>
    </Page>
  );
}
