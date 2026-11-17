"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Unavailable, num } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, post } from "@/lib/client/api";
import { ageS } from "@/lib/commands";
import type { MsgKey } from "@/lib/i18n/messages";

type Dev = { id: string; name: string; hardware: string; environment: string; status: string };
type Sess = { id: string; device_id: string; device_name: string; mode: string; status: string; pilot_name: string; started_at: string };
type Detail = {
  session: { id: string; mode: string; status: string; pilot_id: string; pilot_name: string; authorization_ref: string | null };
  device: { id: string; name: string; hardware: string; capabilities: { commands: { action: string; label?: string; max_duration_s: number | null; requires_duration: boolean }[] } };
  events: { kind: string; payload: Record<string, unknown>; ts: string; actor: string | null }[];
  commands: { id: string; action: string; duration_s: number | null; status: string; proposed_by: string; created_at: string; ack_payload: Record<string, unknown> | null }[];
  telemetry: { metric: string; value: number; unit: string | null; ts: string; quality: string }[]; now: string;
};
const CHECKLIST: MsgKey[] = ["rc.ck1", "rc.ck2", "rc.ck3", "rc.ck4", "rc.ck5"];
const MODE_STYLE: Record<string, string> = { virtual: "bg-[var(--tech)]", bench: "bg-[var(--warn)] text-black", real: "bg-[var(--danger)]" };

function Session({ id, onEnd }: { id: string; onEnd: () => void }) {
  const { t, me } = useApp();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [dur, setDur] = useState<Record<string, string>>({});
  const [to, setTo] = useState("");
  const load = async () => { try { setD(await api<Detail>(`/api/rc/sessions/${id}`)); } catch (e) { setErr(e); } };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec une source externe (URL, session, WebGL)
  useEffect(() => { void load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); await load(); } catch (x) { setErr(x); } };
  if (!d) return <p className="text-sm">{t("c.loading")}</p>;
  const active = d.session.status === "active";
  const isPilot = d.session.pilot_id === me?.id;
  return (
    <div className="space-y-4" data-testid="rc-session">
      <div className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${MODE_STYLE[d.session.mode]}`} data-testid="rc-mode">{t(`env.${d.session.mode}` as MsgKey)} — {d.device.name} · {t("rc.pilot")} : {d.session.pilot_name} · {t(`rc.status.${d.session.status}` as MsgKey)}</div>
      <button disabled={!active} data-testid="estop" onClick={() => run(() => post(`/api/devices/${d.device.id}/estop`, { rc_session_id: id }))}
        className="w-full rounded-xl bg-[var(--danger)] py-4 text-lg font-bold tracking-wide text-white disabled:opacity-40">■ {t("rc.estop")}</button>
      <p className="text-xs text-[var(--fg-3)]">{t("rc.estopInfo")}</p>
      <ErrorBox error={err} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("rc.telemetry")}>
          {!d.telemetry.length ? <p className="text-sm text-[var(--fg-3)]">{t("iot.noData")}</p> : (
            <ul className="space-y-1 text-sm">{d.telemetry.map((m) => { const a = ageS(m.ts, Date.parse(d.now)) ?? 0; return <li key={m.metric} className="flex justify-between gap-2"><span className="font-mono">{m.metric}</span><span className="font-mono">{m.value} {m.unit ?? ""} <span className={a > 300 ? "text-[var(--warn)]" : "text-[var(--fg-3)]"}>({t("rc.age", { s: a })}{m.quality === "simulated" ? `, ${t("nature.simulated")}` : ""})</span></span></li>; })}</ul>
          )}
        </Card>
        <Card title={t("rc.commands")}>
          {!active || !isPilot ? <p className="text-sm text-[var(--fg-3)]">{t("rc.notPilot")}</p> : (
            <div className="space-y-2">
              {d.device.capabilities.commands.map((c) => (
                <div key={c.action} className="flex flex-wrap items-end gap-2">
                  {c.requires_duration && <Field label={`${t("auto.duration")} ≤ ${c.max_duration_s ?? "?"} s`}><Input value={dur[c.action] ?? ""} onChange={(e) => setDur({ ...dur, [c.action]: e.target.value })} className="!w-24" /></Field>}
                  <Btn data-command={c.action} onClick={() => run(() => post(`/api/devices/${d.device.id}/commands`, { action: c.action, duration_s: c.requires_duration ? num(dur[c.action] ?? "") : null, confirm: true, rc_session_id: id }))}>{c.label ?? c.action}</Btn>
                </div>
              ))}
              <Btn kind="ghost" onClick={() => run(() => post(`/api/devices/${d.device.id}/commands`, { action: "stop", confirm: true, rc_session_id: id }))}>{t("rc.stop")}</Btn>
            </div>
          )}
          <ul className="mt-3 space-y-1 text-xs">{d.commands.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{new Date(c.created_at).toLocaleTimeString()} · {c.action}{c.duration_s ? ` ${c.duration_s} s` : ""} · {c.proposed_by}</span>
              <span className="flex gap-1"><Pill tone={c.status === "acknowledged" ? "ok" : c.status === "failed" || c.status === "expired" ? "danger" : "info"}>{t(`cmdst.${c.status}` as MsgKey)}</Pill>
                {c.status === "proposed" && <><Btn kind="ok" onClick={() => run(() => post(`/api/commands/${c.id}/confirm`, {}))}>{t("c.confirm")}</Btn><Btn kind="ghost" onClick={() => run(() => post(`/api/commands/${c.id}/cancel`, {}))}>{t("c.refuse")}</Btn></>}
              </span>
            </li>))}</ul>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Unavailable title={t("rc.video")} reason={t("rc.videoReason")} phase={6} />
        <Unavailable title="MAVLink · PX4 · ArduPilot" reason={t("rc.mavlinkReason")} phase={6} />
      </div>
      {active && isPilot && (
        <Card title={t("rc.handover")}>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("auth.email")}><Input value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Btn kind="ghost" onClick={() => run(() => post(`/api/rc/sessions/${id}/handover`, { email: to }))}>{t("rc.transfer")}</Btn>
            <Btn kind="danger" onClick={() => run(async () => { await post(`/api/rc/sessions/${id}/end`, {}); onEnd(); })}>{t("rc.end")}</Btn>
          </div>
        </Card>
      )}
      <Card title={t("rc.log")}>
        <ul className="max-h-64 space-y-1 overflow-auto text-xs">{d.events.map((e, i) => <li key={i}>{new Date(e.ts).toLocaleString()} · <strong>{e.kind}</strong> · {e.actor ?? ""} {Object.keys(e.payload ?? {}).length ? JSON.stringify(e.payload) : ""}</li>)}</ul>
      </Card>
    </div>
  );
}

export default function Remote() {
  const { t } = useApp();
  const { data: devs } = useData<{ items: Dev[] }>("/api/devices");
  const { data: sess, reload } = useData<{ items: Sess[] }>("/api/rc/sessions");
  const [dev, setDev] = useState("");
  const [auth, setAuth] = useState("");
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [cur, setCur] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const device = devs?.items.find((d) => d.id === dev);
  async function start() {
    setErr(null);
    try { const r = await post<{ id: string }>("/api/rc/sessions", { device_id: dev, authorization_ref: auth || null, checklist: CHECKLIST.map((k, i) => ({ item: t(k), checked: checks[i] })) }); setCur(r.id); reload(); }
    catch (x) { setErr(x); }
  }
  return (
    <Page title={t("nav.remote")} subtitle={t("rc.subtitle")}>
      <div className="grid gap-2 md:grid-cols-3 text-xs">{["virtual", "bench", "real"].map((m) => <div key={m} className={`rounded-lg px-3 py-2 text-white ${MODE_STYLE[m]}`}><strong>{t(`env.${m}` as MsgKey)}</strong> — {t(`rc.mode.${m}` as MsgKey)}</div>)}</div>
      {cur ? <><Btn kind="ghost" onClick={() => { setCur(null); reload(); }}>← {t("c.back")}</Btn><Session id={cur} onEnd={() => { setCur(null); reload(); }} /></> : (
        <>
          <Card title={t("rc.open")}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("iot.device")}><Select name="rc-device" value={dev} onChange={(e) => setDev(e.target.value)}><option value="">—</option>{devs?.items.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.name} ({t(`env.${d.environment}` as MsgKey)})</option>)}</Select></Field>
              {device?.environment === "real" && <Field label={t("rc.authRef")} hint={device.hardware === "drone" ? t("rc.anacim") : undefined}><Input value={auth} onChange={(e) => setAuth(e.target.value)} /></Field>}
            </div>
            {device && device.environment !== "virtual" && (
              <fieldset className="mt-3 space-y-1 text-sm"><legend className="mb-1 text-[var(--fg-2)]">{t("rc.checklist")}</legend>
                {CHECKLIST.map((k, i) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={checks[i]} onChange={(e) => setChecks(checks.map((c, j) => (j === i ? e.target.checked : c)))} />{t(k)}</label>)}
              </fieldset>
            )}
            <div className="mt-3"><Btn onClick={start} disabled={!dev} data-testid="rc-start">{t("rc.start")}</Btn></div>
            <ErrorBox error={err} />
          </Card>
          <Card title={t("rc.sessions")}>
            {!sess?.items.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : (
              <ul className="divide-y divide-[var(--line)] text-sm">{sess.items.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{s.device_name} · {s.pilot_name} · {new Date(s.started_at).toLocaleString()}</span><span className="flex gap-2"><Pill tone={s.mode === "real" ? "danger" : s.mode === "bench" ? "warn" : "info"}>{t(`env.${s.mode}` as MsgKey)}</Pill><Pill>{t(`rc.status.${s.status}` as MsgKey)}</Pill><Btn kind="ghost" onClick={() => setCur(s.id)}>{t("c.open")}</Btn></span></li>)}</ul>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
