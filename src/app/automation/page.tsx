"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, num } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del, patch, post } from "@/lib/client/api";
import type { AutomationSpec } from "@/lib/automation";
import type { MsgKey } from "@/lib/i18n/messages";

type Dev = { id: string; name: string; environment: string; capabilities: { metrics: { metric: string; unit?: string | null }[]; commands: { action: string; label?: string; max_duration_s: number | null; requires_duration: boolean }[] } };
type Auto = { id: string; name: string; spec: AutomationSpec; enabled: boolean; preauthorized: boolean; dry_run: { at: string; readings: number; fired: number; samples: { ts: string; value: number }[] } | null; runs: { outcome: string; trigger: { value: number; ts: string }; created_at: string }[] | null };

const STEPS: MsgKey[] = ["auto.b.trigger", "auto.b.condition", "auto.b.action", "auto.b.delay", "auto.b.verify", "auto.b.notify", "auto.b.log", "auto.b.stop"];

export default function Automation() {
  const { t, me } = useApp();
  const { data: devs } = useData<{ items: Dev[] }>("/api/devices");
  const { data, reload } = useData<{ items: Auto[] }>("/api/automations");
  const [f, setF] = useState({ name: "", device: "", metric: "", op: "<", threshold: "", maxAge: "900", kind: "notify", target: "", action: "", duration: "", cooldown: "3600", verifyMetric: "", verifyWithin: "", maxRuns: "4" });
  const [err, setErr] = useState<unknown>(null);
  const [dry, setDry] = useState<Record<string, Auto["dry_run"]>>({});
  const dev = devs?.items.find((d) => d.id === f.device);
  const target = devs?.items.find((d) => d.id === f.target);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (x) { setErr(x); } };

  async function create() {
    const spec = {
      trigger: { device_id: f.device, metric: f.metric },
      condition: { op: f.op, threshold: num(f.threshold), max_age_s: Number(f.maxAge) },
      action: f.kind === "notify" ? { kind: "notify" } : { kind: "command", device_id: f.target, action: f.action, duration_s: num(f.duration) },
      cooldown_s: Number(f.cooldown), verify: { metric: f.verifyMetric || null, within_s: num(f.verifyWithin) }, stop: { max_runs_per_day: Number(f.maxRuns) },
    };
    await run(() => post("/api/automations", { name: f.name, spec }));
  }

  return (
    <Page title={t("nav.automation")} subtitle={t("auto.subtitle")} actions={<Link href={`/ai?q=${encodeURIComponent(t("auto.nlPrompt"))}`} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("auto.nl")}</Link>}>
      <Card title={t("auto.new")}>
        <div className="mb-3 flex flex-wrap gap-1 text-xs">{STEPS.map((s, i) => <span key={s} className="rounded bg-[var(--panel-2)] px-2 py-1">{i + 1}. {t(s)}</span>)}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("c.name")}><Input name="auto-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={`1. ${t("auto.b.trigger")} — ${t("iot.device")}`}><Select name="auto-device" value={f.device} onChange={(e) => setF({ ...f, device: e.target.value, metric: "" })}><option value="">—</option>{devs?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label={t("iot.metric")}><Select name="auto-metric" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}><option value="">—</option>{dev?.capabilities.metrics.map((m) => <option key={m.metric}>{m.metric}</option>)}</Select></Field>
          <Field label={`2. ${t("auto.b.condition")}`}><Select value={f.op} onChange={(e) => setF({ ...f, op: e.target.value })}>{["<", "<=", ">", ">="].map((o) => <option key={o}>{o}</option>)}</Select></Field>
          <Field label={t("auto.threshold")} hint={t("auto.thresholdHint")}><Input name="auto-threshold" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value })} /></Field>
          <Field label={t("auto.maxAge")}><Input value={f.maxAge} onChange={(e) => setF({ ...f, maxAge: e.target.value })} /></Field>
          <Field label={`3. ${t("auto.b.action")}`}><Select name="auto-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="notify">{t("auto.notifyOnly")}</option><option value="command">{t("auto.proposeCommand")}</option></Select></Field>
          {f.kind === "command" && <>
            <Field label={t("auto.target")}><Select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value, action: "" })}><option value="">—</option>{devs?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
            <Field label={t("iot.action")}><Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="">—</option>{target?.capabilities.commands.map((c) => <option key={c.action} value={c.action}>{c.label ?? c.action} {c.max_duration_s ? `(≤ ${c.max_duration_s} s)` : ""}</option>)}</Select></Field>
            <Field label={t("auto.duration")}><Input value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
          </>}
          <Field label={`4. ${t("auto.b.delay")} (s)`}><Input value={f.cooldown} onChange={(e) => setF({ ...f, cooldown: e.target.value })} /></Field>
          <Field label={`5. ${t("auto.b.verify")} — ${t("iot.metric")}`}><Input value={f.verifyMetric} onChange={(e) => setF({ ...f, verifyMetric: e.target.value })} /></Field>
          <Field label={t("auto.verifyWithin")}><Input value={f.verifyWithin} onChange={(e) => setF({ ...f, verifyWithin: e.target.value })} /></Field>
          <Field label={`8. ${t("auto.b.stop")} — ${t("auto.maxRuns")}`}><Input value={f.maxRuns} onChange={(e) => setF({ ...f, maxRuns: e.target.value })} /></Field>
        </div>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("auto.notifyLog")}</p>
        <div className="mt-3"><Btn onClick={create} data-testid="create-automation">{t("c.create")}</Btn></div>
        <ErrorBox error={err} />
      </Card>
      <Card title={t("auto.list")}>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)]">
            {data.items.map((a) => {
              const dr = dry[a.id] ?? a.dry_run;
              return (
                <li key={a.id} className="space-y-2 py-3 text-sm" data-automation={a.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{a.name}</strong>
                    <span className="flex gap-1">{a.enabled ? <Pill tone="ok">{t("auto.enabled")}</Pill> : <Pill>{t("auto.disabled")}</Pill>}{a.preauthorized && <Pill tone="warn">{t("auto.level5")}</Pill>}</span>
                  </div>
                  <p className="font-mono text-xs text-[var(--fg-2)]">SI {a.spec.trigger.metric} {a.spec.condition.op} {a.spec.condition.threshold} (≤ {a.spec.condition.max_age_s} s) ALORS {a.spec.action.kind === "notify" ? "notifier" : `proposer ${a.spec.action.action}${a.spec.action.duration_s ? ` ${a.spec.action.duration_s} s` : ""}`} · pause {a.spec.cooldown_s} s · max {a.spec.stop.max_runs_per_day}/j</p>
                  <div className="flex flex-wrap gap-2">
                    <Btn kind="ghost" data-testid="dry-run" onClick={() => run(async () => { const r = await post<Auto["dry_run"]>(`/api/automations/${a.id}/dry-run`, {}); setDry({ ...dry, [a.id]: r }); })}>{t("auto.dryRun")}</Btn>
                    <Btn kind={a.enabled ? "danger" : "ok"} onClick={() => run(() => patch(`/api/automations/${a.id}`, { enabled: !a.enabled }))}>{a.enabled ? t("auto.disable") : t("auto.enable")}</Btn>
                    {a.spec.action.kind === "command" && <Btn kind="ghost" disabled={!a.preauthorized && (me?.autonomy_level ?? 0) < 5} title={t("auto.level5Hint")} onClick={() => run(() => patch(`/api/automations/${a.id}`, { preauthorized: !a.preauthorized }))}>{a.preauthorized ? t("auto.revokePreauth") : t("auto.preauth")}</Btn>}
                    <Btn kind="ghost" onClick={() => run(() => del(`/api/automations/${a.id}`))}>{t("c.delete")}</Btn>
                  </div>
                  {dr && <p className="text-xs text-[var(--fg-2)]" data-testid="dry-run-report">{t("auto.dryReport", { n: dr.readings, f: dr.fired })} {dr.samples.slice(-3).map((s) => `${new Date(s.ts).toLocaleString()} (${s.value})`).join(" · ")}</p>}
                  {!!a.runs?.length && <ul className="text-xs text-[var(--fg-3)]">{a.runs.map((r, i) => <li key={i}>{new Date(r.created_at).toLocaleString()} — {r.trigger.value} → {r.outcome}</li>)}</ul>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Page>
  );
}
