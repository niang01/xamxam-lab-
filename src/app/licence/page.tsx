"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del, post } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type L = {
  state: "admin" | "trial" | "licensed" | "expired" | "tampered"; allowed: boolean; trial_days: number;
  trial: { started_at: string; ends_at: string; days_left: number } | null;
  licence: { plan_name: string; key_hint: string; expires_at: string; organization: string | null; days_left: number; max_devices?: number | null } | null;
  history: { action: string; created_at: string; key_hint: string | null }[];
  devices: { id: string; label: string | null; first_seen: string; last_seen: string }[]; this_device: string | null;
};
const d = (s: string) => new Date(s).toLocaleDateString();

export default function Licence() {
  const { t, refreshMe } = useApp();
  const { data, reload } = useData<L>("/api/licence");
  const [key, setKey] = useState(""); const [err, setErr] = useState<unknown>(null); const [msg, setMsg] = useState("");
  const tone = data?.allowed ? "ok" : "danger";
  return (
    <Page title={t("lic.title")}>
      {data && (
        <Card title={t("lic.status")} testId="licence-status">
          <p className="text-sm"><Pill tone={tone}>{t(`lic.state.${data.state}` as MsgKey)}</Pill></p>
          {data.trial && <p className="mt-2 text-sm">{t("lic.trial", { n: data.trial_days })} : {d(data.trial.started_at)} → {d(data.trial.ends_at)} ({t("lic.daysLeft", { n: data.trial.days_left })})</p>}
          {data.licence && <p className="mt-1 text-sm" data-testid="licence-active">{t("lic.current")} : <strong>{data.licence.plan_name}</strong> · …{data.licence.key_hint} · {t("lic.until")} {d(data.licence.expires_at)} ({t("lic.daysLeft", { n: data.licence.days_left })}){data.licence.organization ? ` · ${data.licence.organization}` : ""}</p>}
          <p className="mt-2 text-xs text-[var(--fg-3)]">{t("lic.serverInfo")}</p>
        </Card>
      )}
      <Card title={t("lic.activate")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("lic.key")}><Input name="licence-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXL-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="!w-80 font-mono" /></Field>
          <Btn data-testid="licence-activate" disabled={key.trim().length < 20} onClick={async () => { setErr(null); setMsg(""); try { await post("/api/licence", { key }); setKey(""); setMsg(t("lic.activated")); reload(); await refreshMe(); } catch (e) { setErr(e); } }}>{t("lic.activateBtn")}</Btn>
        </div>
        {msg && <p className="mt-2"><Pill tone="ok">{msg}</Pill></p>}
        <ErrorBox error={err} />
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("lic.buyInfo")}</p>
      </Card>
      {data && (
        <Card title={t("lic.devices")} testId="my-devices">
          <p className="mb-2 text-xs text-[var(--fg-3)]">{data.licence?.max_devices ? t("lic.devicesMax", { n: data.licence.max_devices }) : t("lic.devicesNoLimit")}</p>
          <ul className="space-y-1 text-sm">{data.devices.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2"><span>{d.label ?? "—"} <span className="text-xs text-[var(--fg-3)]">· {new Date(d.last_seen).toLocaleString()}{d.id === data.this_device ? ` · ${t("lic.thisDevice")}` : ""}</span></span>
            <button className="text-xs underline" onClick={async () => { try { await del(`/api/licence?device=${d.id}`); reload(); } catch (e) { setErr(e); } }}>{t("lic.removeDevice")}</button></li>)}</ul>
        </Card>
      )}
      {!!data?.history.length && (
        <Card title={t("lic.history")}>
          <ul className="text-sm">{data.history.map((h, i) => <li key={i}>{new Date(h.created_at).toLocaleString()} — {h.action}{h.key_hint ? ` (…${h.key_hint})` : ""}</li>)}</ul>
        </Card>
      )}
    </Page>
  );
}
