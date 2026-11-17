"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";
import { freshness } from "@/lib/commands";
import type { MsgKey } from "@/lib/i18n/messages";

type Row = Record<string, string | number | boolean | null>;
type CC = {
  switches: Record<"ai_enabled" | "automations_enabled" | "devices_enabled", boolean>;
  agents: { key: string; name: string; enabled: boolean; stats: Record<string, number> }[];
  ops: Row[]; sims: Row[]; devices: Row[]; automations: Row[]; sessions: Row[]; pendingCmds: Row[]; audits: (Row & { details: unknown })[];
  users: { n: number }; usage: Record<string, number>; highAutonomy: Row[]; auditChain: { ok: boolean; checked: number; brokenAt: number | null }; now: string;
};

export default function CommandCenter() {
  const { t, me } = useApp();
  const { data, error, reload } = useData<CC>(me?.is_admin ? "/api/command-center" : null);
  const [err, setErr] = useState<unknown>(null);
  const act = async (b: unknown) => { setErr(null); try { await post("/api/command-center", b); reload(); } catch (e) { setErr(e); } };
  if (!me?.is_admin) return <Page title={t("nav.command")}><p className="text-sm text-[var(--fg-2)]">{t("err.admin")}</p></Page>;
  if (error) return <Page title={t("nav.command")}><ErrorBox error={error} /></Page>;
  if (!data) return <Page title={t("nav.command")}><p className="text-sm">{t("c.loading")}</p></Page>;
  const now = Date.parse(data.now);
  const online = data.devices.filter((d) => d.status === "active" && freshness(d.last_seen as string | null, 900, now) === "live").length;
  return (
    <Page title={t("nav.command")} subtitle={t("cc.subtitle")}>
      <ErrorBox error={err} />
      <div className="grid gap-3 md:grid-cols-3">
        {(["ai_enabled", "automations_enabled", "devices_enabled"] as const).map((k) => (
          <Card key={k} title={t(`cc.sw.${k}` as MsgKey)}>
            <div className="flex items-center justify-between gap-2">
              <Pill tone={data.switches[k] ? "ok" : "danger"}>{data.switches[k] ? t("cc.on") : t("cc.off")}</Pill>
              <Btn kind={data.switches[k] ? "danger" : "ok"} data-switch={k} onClick={() => act({ kind: "switch", key: k, value: !data.switches[k] })}>{data.switches[k] ? t("cc.suspend") : t("cc.resume")}</Btn>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-[var(--fg-3)]">{t("cc.hardwareNote")}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 text-sm">
        {[["cc.users", data.users.n], ["cc.devicesOnline", `${online}/${data.devices.length}`], ["cc.llm24", data.usage.llm_24h], ["cc.answers24", data.usage.answers_24h], ["cc.simMs", `${Math.round(data.usage.sim_ms_24h / 1000)} s`], ["cc.readings24", data.usage.readings_24h]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3"><div className="text-xs text-[var(--fg-3)]">{t(k as MsgKey)}</div><div className="font-mono text-xl">{v as string}</div></div>
        ))}
      </div>
      <Card title={t("cc.agents")}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.agents.map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] p-2 text-xs">
            <div><div className={`font-semibold ${a.enabled ? "" : "line-through opacity-60"}`}>{a.name}</div><div className="text-[var(--fg-3)]">{Object.entries(a.stats).map(([s, n]) => `${s}: ${n}`).join(" · ") || t("cc.noActivity")}</div></div>
            <Btn kind="ghost" onClick={() => act({ kind: "agent", key: a.key, enabled: !a.enabled })}>{a.enabled ? t("cc.disable") : t("cc.enable")}</Btn>
          </div>))}</div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("cc.ops")}>
          <ul className="max-h-72 space-y-1 overflow-auto text-xs">{data.ops.map((o) => <li key={o.id as string} className="flex flex-wrap gap-2"><Pill tone={o.status === "done" || o.status === "approved" ? "ok" : o.status === "awaiting_approval" ? "warn" : "danger"}>{o.status as string}</Pill><span className="font-mono">{o.tool as string}</span><span className="text-[var(--fg-3)]">{o.agent_key as string} · {o.display_name as string} · {new Date(o.created_at as string).toLocaleString()}</span></li>)}</ul>
        </Card>
        <Card title={t("cc.pendingCmds")}>
          {!data.pendingCmds.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <ul className="space-y-1 text-xs">{data.pendingCmds.map((c) => <li key={c.id as string} className="flex items-center justify-between gap-2"><span>{c.device as string} · {c.action as string} · {c.proposed_by as string} · {t(`cmdst.${c.status}` as MsgKey)}</span>{c.status !== "sent" && <Btn kind="ghost" onClick={() => act({ kind: "cancel_command", command_id: c.id })}>{t("c.cancel")}</Btn>}</li>)}</ul>}
        </Card>
        <Card title={t("cc.devices")}>
          <ul className="max-h-72 space-y-1 overflow-auto text-xs">{data.devices.map((d) => <li key={d.id as string} className="flex items-center justify-between gap-2"><span>{d.name as string} · {d.owner as string} · {t(`env.${d.environment}` as MsgKey)} · <Pill tone={d.status !== "active" ? "danger" : freshness(d.last_seen as string | null, 900, now) === "live" ? "ok" : "warn"}>{d.status !== "active" ? t("iot.disabled") : t(`iot.fresh.${freshness(d.last_seen as string | null, 900, now)}` as MsgKey)}</Pill></span>{d.status === "active" && <Btn kind="ghost" onClick={() => act({ kind: "revoke_device", device_id: d.id })}>{t("iot.revoke")}</Btn>}</li>)}</ul>
        </Card>
        <Card title={t("cc.automations")}>
          {!data.automations.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <ul className="space-y-1 text-xs">{data.automations.map((a) => <li key={a.id as string} className="flex items-center justify-between gap-2"><span>{a.name as string} · {a.owner as string} {a.enabled ? <Pill tone="ok">{t("auto.enabled")}</Pill> : <Pill>{t("auto.disabled")}</Pill>}{a.preauthorized ? <Pill tone="warn">{t("auto.level5")}</Pill> : null}</span>{(a.enabled || a.preauthorized) && <Btn kind="ghost" onClick={() => act({ kind: "disable_automation", automation_id: a.id })}>{t("cc.disable")}</Btn>}</li>)}</ul>}
        </Card>
        <Card title={t("cc.sessions")}>
          {!data.sessions.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <ul className="space-y-1 text-xs">{data.sessions.map((s) => <li key={s.id as string} className="flex items-center justify-between gap-2"><span>{s.device as string} · {s.pilot as string} · {t(`env.${s.mode}` as MsgKey)} · {t(`rc.status.${s.status}` as MsgKey)}</span>{s.status === "active" && <Btn kind="ghost" onClick={() => act({ kind: "end_session", session_id: s.id })}>{t("rc.end")}</Btn>}</li>)}</ul>}
        </Card>
        <Card title={t("cc.permissions")}>
          {!data.highAutonomy.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <ul className="space-y-1 text-xs">{data.highAutonomy.map((u) => <li key={u.id as string} className="flex items-center justify-between gap-2"><span>{u.display_name as string} · {t("c.level")} {u.autonomy_level as number}</span><Btn kind="ghost" onClick={() => act({ kind: "reset_autonomy", user_id: u.id })}>{t("cc.revokeAutonomy")}</Btn></li>)}</ul>}
        </Card>
      </div>
      <Card title={t("cc.audit")} actions={<Pill tone={data.auditChain.ok ? "ok" : "danger"}>{data.auditChain.ok ? t("cc.chainOk", { n: data.auditChain.checked }) : t("cc.chainBroken", { id: data.auditChain.brokenAt ?? "?" })}</Pill>}>
        <ul className="max-h-96 space-y-1 overflow-auto font-mono text-xs" data-testid="audit-log">{data.audits.map((a) => <li key={a.id as string}><span className="text-[var(--fg-3)]">{new Date(a.created_at as string).toLocaleString()}</span> [{a.actor_kind as string}] {a.action as string} {a.object_kind ? `${a.object_kind}:${String(a.object_id).slice(0, 8)}` : ""}</li>)}</ul>
      </Card>
    </Page>
  );
}
