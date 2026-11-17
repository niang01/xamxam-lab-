"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Page, Pill, Select, Unavailable, num } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { patch, post } from "@/lib/client/api";
import { freshness } from "@/lib/commands";
import type { MsgKey } from "@/lib/i18n/messages";

type Latest = { metric: string; value: number; unit: string | null; ts: string; quality: string };
type Dev = { id: string; name: string; hardware: string; protocol: string; environment: string; status: string; firmware_version: string | null; last_seen: string | null; project_title: string | null; capabilities: { metrics: { metric: string; unit?: string | null }[]; commands: { action: string; label?: string; max_duration_s: number | null; requires_duration: boolean }[] }; latest: Latest[] | null };
type M = { metric: string; ts: string; value: number; unit: string | null; quality: string; source: string };

const HW = ["esp32", "xiao_esp32s3", "arduino", "raspberry_pi", "plc", "drone", "robot", "weather_station", "inverter", "pump_controller", "other"];

function DeviceDetail({ d, onChange }: { d: Dev; onChange: () => void }) {
  const { t } = useApp();
  const metrics = [...new Set([...(d.capabilities.metrics ?? []).map((m) => m.metric), ...(d.latest ?? []).map((l) => l.metric)])];
  const [metric, setMetric] = useState(metrics[0] ?? "");
  const { data, reload } = useData<{ items: M[] }>(metric ? `/api/devices/${d.id}/measurements?metric=${encodeURIComponent(metric)}&limit=500` : null);
  const [token, setToken] = useState<string | null>(null);
  const [sim, setSim] = useState({ values: "", interval: "60" });
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); onChange(); reload(); } catch (x) { setErr(x); } };
  const valid = (data?.items ?? []).filter((m) => m.quality === "valid");
  const simulated = (data?.items ?? []).filter((m) => m.quality === "simulated");
  const t0 = data?.items[0] ? Date.parse(data.items[0].ts) : 0;
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-[var(--bg-2)] p-3 text-sm" data-testid="device-detail">
      <div className="flex flex-wrap gap-2">
        <Btn kind="ghost" onClick={() => run(async () => setToken((await post<{ token: string }>(`/api/devices/${d.id}/token`, {})).token))}>{t("iot.newToken")}</Btn>
        <Btn kind={d.status === "active" ? "danger" : "ok"} onClick={() => run(() => patch(`/api/devices/${d.id}`, { status: d.status === "active" ? "disabled" : "active" }))}>{d.status === "active" ? t("iot.revoke") : t("iot.reactivate")}</Btn>
      </div>
      {token && <div className="rounded border border-[var(--warn)] p-2 font-mono text-xs break-all" data-testid="device-token">{t("iot.tokenOnce")} {token}</div>}
      <ErrorBox error={err} />
      {metrics.length > 0 && (
        <>
          <Field label={t("iot.metric")}><Select value={metric} onChange={(e) => setMetric(e.target.value)} className="!w-auto">{metrics.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          {data && data.items.length > 0 ? (
            <>
              <div className="flex gap-2">{valid.length > 0 && <Nature kind="measurement" />}{simulated.length > 0 && <Nature kind="simulated" />}</div>
              <LineChart xLabel={t("iot.minutes")} yLabel={data.items[0].unit ?? metric} series={[
                ...(valid.length ? [{ name: `${metric} (${t("nature.measurement")})`, x: valid.map((m) => (Date.parse(m.ts) - t0) / 60000), y: valid.map((m) => m.value), color: "#22C55E" }] : []),
                ...(simulated.length ? [{ name: `${metric} (${t("nature.simulated")})`, x: simulated.map((m) => (Date.parse(m.ts) - t0) / 60000), y: simulated.map((m) => m.value), color: "#F59E0B", dashed: true }] : []),
              ]} height={200} />
              <p className="text-xs text-[var(--fg-3)]">{t("iot.from")} {new Date(data.items[0].ts).toLocaleString()} · {data.items.length} {t("iot.points")}</p>
            </>
          ) : <p className="text-[var(--fg-3)]">{t("iot.noData")}</p>}
        </>
      )}
      <details><summary className="cursor-pointer text-[var(--warn)]">{t("iot.simTitle")}</summary>
        <p className="my-1 text-xs text-[var(--fg-3)]">{t("iot.simInfo")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("iot.metric")}><Input value={metric} onChange={(e) => setMetric(e.target.value)} className="!w-40" /></Field>
          <Field label={t("iot.simValues")}><Input value={sim.values} onChange={(e) => setSim({ ...sim, values: e.target.value })} placeholder="21 22.5 23" /></Field>
          <Field label={t("iot.simInterval")}><Input value={sim.interval} onChange={(e) => setSim({ ...sim, interval: e.target.value })} className="!w-24" /></Field>
          <Btn kind="ghost" onClick={() => run(() => post(`/api/devices/${d.id}/simulate`, { metric, values: sim.values.split(/[\s;]+/).map(num).filter((x): x is number => x != null), interval_s: Number(sim.interval) || 60 }))}>{t("iot.simSend")}</Btn>
        </div>
      </details>
      <div className="text-xs text-[var(--fg-3)]">
        <div className="font-semibold">{t("iot.endpoints")}</div>
        <code className="block">POST /api/device/ingest · Authorization: Bearer &lt;jeton&gt; · {`{"readings":[{"metric":"soil_moisture","value":21.5,"unit":"%"}]}`}</code>
        <code className="block">GET /api/device/commands · POST /api/device/ack {`{"id":"…","ok":true,"state":{…}}`}</code>
      </div>
    </div>
  );
}

export default function Gateway() {
  const { t } = useApp();
  const { data, reload } = useData<{ items: Dev[]; now: string }>("/api/devices");
  const [open, setOpen] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: "", hardware: "xiao_esp32s3", protocol: "https", environment: "bench", project_id: "" });
  const [metrics, setMetrics] = useState<{ metric: string; unit: string }[]>([{ metric: "", unit: "" }]);
  const [cmds, setCmds] = useState<{ action: string; label: string; max: string; dur: boolean }[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  async function create() {
    setErr(null);
    try {
      const r = await post<{ id: string; token: string }>("/api/devices", { ...f, project_id: f.project_id || null, capabilities: { metrics: metrics.filter((m) => m.metric).map((m) => ({ metric: m.metric, unit: m.unit || null })), commands: cmds.filter((c) => c.action).map((c) => ({ action: c.action, label: c.label || undefined, max_duration_s: num(c.max), requires_duration: c.dur })) } });
      setToken(r.token); setAdd(false); reload();
    } catch (x) { setErr(x); }
  }
  return (
    <Page title={t("nav.gateway")} subtitle={t("iot.subtitle")} actions={<Btn onClick={() => setAdd((a) => !a)} data-testid="add-device">{t("iot.add")}</Btn>}>
      {token && <Card title={t("iot.registered")}><p className="text-sm">{t("iot.tokenOnce")}</p><code className="mt-2 block break-all rounded bg-[var(--bg-2)] p-2 font-mono text-xs" data-testid="device-token">{token}</code><Btn kind="ghost" className="mt-2" onClick={() => setToken(null)}>{t("c.close")}</Btn></Card>}
      {add && (
        <Card title={t("iot.add")}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t("c.name")}><Input name="device-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t("iot.hardware")}><Select value={f.hardware} onChange={(e) => setF({ ...f, hardware: e.target.value })}>{HW.map((h) => <option key={h} value={h}>{t(`hw.${h}` as MsgKey)}</option>)}</Select></Field>
            <Field label={t("iot.protocol")}><Select value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })}><option value="https">HTTPS (Wi-Fi, Ethernet, 4G)</option><option value="mqtt">MQTT (passerelle XAM-XAM)</option><option value="web_serial">USB / série (Web Serial ou agent local)</option></Select></Field>
            <Field label={t("iot.environment")}><Select name="environment" value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })}>{["virtual", "bench", "real"].map((x) => <option key={x} value={x}>{t(`env.${x}` as MsgKey)}</option>)}</Select></Field>
            <Field label={t("c.project")}><ProjectPicker value={f.project_id} onChange={(v) => setF({ ...f, project_id: v })} /></Field>
          </div>
          <div className="mt-3 text-sm text-[var(--fg-2)]">{t("iot.metrics")}</div>
          {metrics.map((m, i) => <div key={i} className="mt-1 flex gap-2"><Input placeholder={t("iot.metric")} aria-label={t("iot.metric")} value={m.metric} onChange={(e) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))} className="!w-48" /><Input placeholder={t("c.unit")} aria-label={t("c.unit")} value={m.unit} onChange={(e) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className="!w-24" /></div>)}
          <Btn kind="ghost" className="mt-1" onClick={() => setMetrics([...metrics, { metric: "", unit: "" }])}>+ {t("iot.metric")}</Btn>
          <div className="mt-3 text-sm text-[var(--fg-2)]">{t("iot.commands")}</div>
          <p className="text-xs text-[var(--fg-3)]">{t("iot.commandsInfo")}</p>
          {cmds.map((c, i) => (
            <div key={i} className="mt-1 flex flex-wrap items-center gap-2">
              <Input placeholder="pump_on" aria-label={t("iot.action")} value={c.action} onChange={(e) => setCmds(cmds.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))} className="!w-36" />
              <Input placeholder={t("iot.label")} aria-label={t("iot.label")} value={c.label} onChange={(e) => setCmds(cmds.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="!w-40" />
              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={c.dur} onChange={(e) => setCmds(cmds.map((x, j) => (j === i ? { ...x, dur: e.target.checked } : x)))} />{t("iot.requiresDuration")}</label>
              <Input placeholder={t("iot.maxDuration")} aria-label={t("iot.maxDuration")} value={c.max} onChange={(e) => setCmds(cmds.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)))} className="!w-36" />
            </div>
          ))}
          <Btn kind="ghost" className="mt-1" onClick={() => setCmds([...cmds, { action: "", label: "", max: "", dur: true }])}>+ {t("iot.action")}</Btn>
          <div className="mt-3 flex gap-2"><Btn onClick={create} data-testid="create-device">{t("c.create")}</Btn></div>
          <ErrorBox error={err} />
        </Card>
      )}
      <Card title={t("iot.devices")}>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)]">
            {data.items.map((d) => {
              const fr = freshness(d.last_seen, 900, Date.parse(data.now));
              return (
                <li key={d.id} className="py-2" data-device={d.name}>
                  <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm" onClick={() => setOpen(open === d.id ? null : d.id)}>
                    <span><strong>{d.name}</strong> <span className="text-xs text-[var(--fg-3)]">{t(`hw.${d.hardware}` as MsgKey)} · {d.protocol}{d.firmware_version ? ` · fw ${d.firmware_version}` : ""}{d.project_title ? ` · ${d.project_title}` : ""}</span></span>
                    <span className="flex flex-wrap gap-1">
                      <Pill tone={d.environment === "real" ? "danger" : d.environment === "bench" ? "warn" : "info"}>{t(`env.${d.environment}` as MsgKey)}</Pill>
                      {d.status !== "active" ? <Pill tone="danger">{t("iot.disabled")}</Pill> : <Pill tone={fr === "live" ? "ok" : fr === "stale" ? "warn" : "neutral"}>{t(`iot.fresh.${fr}` as MsgKey)}</Pill>}
                    </span>
                  </button>
                  {(d.latest ?? []).length > 0 && <div className="mt-1 flex flex-wrap gap-2 text-xs">{d.latest!.map((l) => <span key={l.metric} className="rounded bg-[var(--panel-2)] px-2 py-0.5 font-mono">{l.metric} = {l.value} {l.unit ?? ""} <span className="text-[var(--fg-3)]">({new Date(l.ts).toLocaleString()}{l.quality === "simulated" ? `, ${t("nature.simulated")}` : ""})</span></span>)}</div>}
                  {open === d.id && <DeviceDetail d={d} onChange={reload} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title={t("iot.protocols")}>
        <p className="mb-2 text-sm text-[var(--fg-2)]">{t("iot.protocolsInfo")}</p>
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div className="rounded-lg border border-[var(--line)] p-3" data-testid="mqtt-info"><strong>MQTT</strong><p className="mt-1 text-xs text-[var(--fg-2)]">{t("iot.mqttInfo")}</p>
            <code className="mt-2 block text-xs">mqtt(s)://&lt;serveur&gt;:1883|8883 · client = utilisateur = &lt;id&gt; · mot de passe = &lt;jeton&gt;</code>
            <code className="block text-xs">xx/&lt;id&gt;/telemetry · xx/&lt;id&gt;/ack · xx/&lt;id&gt;/cmd</code></div>
          <div className="rounded-lg border border-[var(--line)] p-3"><strong>{t("iot.agent")}</strong><p className="mt-1 text-xs text-[var(--fg-2)]">{t("iot.agentInfo")}</p>
            <code className="mt-2 block text-xs">npm run agent -- --port /dev/ttyUSB0 --baud 115200 --platform https://&lt;serveur&gt; --token &lt;jeton&gt;</code></div>
          <Unavailable title="Bluetooth LE / LoRa / RS485-Modbus" reason={t("iot.localAgentReason")} phase={5} />
        </div>
      </Card>
    </Page>
  );
}
