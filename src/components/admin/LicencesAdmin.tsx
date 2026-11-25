"use client";
/** Administration des licences : catégories, émission de clés (affichées une seule fois), attribution, révocation, renouvellement, historique. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Pill, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";

type Plan = { id: string; code: string; name: string; description: string | null; duration_days: number; seats: number; price_xof: number | null; active: boolean };
type Lic = { id: string; max_devices: number | null; key_hint: string; organization: string | null; seats: number; duration_days: number; status: string; activated_at: string | null; expires_at: string | null; note: string | null; plan_name: string; holders: { user_id: string; email: string }[] };
type Ev = { id: number; action: string; created_at: string; key_hint: string | null; user_email: string | null; actor_email: string | null };
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

export function LicencesAdmin() {
  const { t } = useApp();
  const { data, reload } = useData<{ plans: Plan[]; licences: Lic[]; events: Ev[] }>("/api/admin/licences");
  const [plan, setPlan] = useState({ code: "", name: "", duration_days: "365", seats: "1", price_xof: "", description: "", max_devices: "" });
  const [iss, setIss] = useState({ plan_id: "", count: "1", organization: "", seats: "", note: "", assign_email: "" });
  const [keys, setKeys] = useState<string[]>([]);
  const [row, setRow] = useState<Record<string, { email: string; days: string }>>({});
  const [err, setErr] = useState<unknown>(null);
  const run = async (body: unknown) => { setErr(null); try { const r = await post<{ keys?: { key: string }[] }>("/api/admin/licences", body); if (r.keys) setKeys(r.keys.map((k) => k.key)); reload(); } catch (e) { setErr(e); } };
  const n = (s: string) => (s.trim() ? Number(s) : null);
  return (
    <div className="space-y-4" data-testid="licences-admin">
      <ErrorBox error={err} />
      <Card title={t("lic.plans")}>
        <ul className="mb-3 space-y-1 text-sm">{data?.plans.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2"><span><strong>{p.name}</strong> <span className="text-xs text-[var(--fg-3)]">{p.code} · {p.duration_days} j · {t("lic.seats")} {p.seats}{p.price_xof != null ? ` · ${p.price_xof} FCFA` : ""}</span></span>
            <Btn kind="ghost" onClick={() => run({ action: "toggle_plan", plan_id: p.id, active: !p.active })}>{p.active ? t("adm.disable") : t("adm.enable")}</Btn></li>))}
          {!data?.plans.length && <li className="text-[var(--fg-3)]">{t("lic.noPlan")}</li>}</ul>
        <div className="grid gap-2 md:grid-cols-3">
          <Field label={t("lic.code")}><Input name="plan-code" value={plan.code} onChange={(e) => setPlan({ ...plan, code: e.target.value })} placeholder="etudiant-annuel" /></Field>
          <Field label={t("lic.name")}><Input name="plan-name" value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></Field>
          <Field label={t("lic.duration")}><Input name="plan-days" type="number" value={plan.duration_days} onChange={(e) => setPlan({ ...plan, duration_days: e.target.value })} /></Field>
          <Field label={t("lic.seats")}><Input name="plan-seats" type="number" value={plan.seats} onChange={(e) => setPlan({ ...plan, seats: e.target.value })} /></Field>
          <Field label={t("lic.price")}><Input name="plan-price" type="number" value={plan.price_xof} onChange={(e) => setPlan({ ...plan, price_xof: e.target.value })} /></Field>
          <Field label={t("lic.description")}><Input value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} /></Field>
          <Field label={t("lic.maxDevices")}><Input name="plan-devices" type="number" value={plan.max_devices} onChange={(e) => setPlan({ ...plan, max_devices: e.target.value })} /></Field>
        </div>
        <Btn className="mt-2" data-testid="plan-create" onClick={() => run({ action: "create_plan", code: plan.code, name: plan.name, duration_days: Number(plan.duration_days), seats: Number(plan.seats), price_xof: n(plan.price_xof), description: plan.description || null, max_devices: n(plan.max_devices) })}>{t("lic.createPlan")}</Btn>
      </Card>
      <Card title={t("lic.issue")}>
        <div className="grid gap-2 md:grid-cols-3">
          <Field label={t("lic.plan")}><Select name="issue-plan" value={iss.plan_id} onChange={(e) => setIss({ ...iss, plan_id: e.target.value })}><option value="">—</option>{data?.plans.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label={t("lic.count")}><Input type="number" value={iss.count} onChange={(e) => setIss({ ...iss, count: e.target.value })} /></Field>
          <Field label={t("lic.assignEmail")}><Input name="issue-email" type="email" value={iss.assign_email} onChange={(e) => setIss({ ...iss, assign_email: e.target.value })} /></Field>
          <Field label={t("lic.organization")}><Input value={iss.organization} onChange={(e) => setIss({ ...iss, organization: e.target.value })} /></Field>
          <Field label={t("lic.seatsOverride")}><Input type="number" value={iss.seats} onChange={(e) => setIss({ ...iss, seats: e.target.value })} /></Field>
          <Field label={t("lic.note")}><Input value={iss.note} onChange={(e) => setIss({ ...iss, note: e.target.value })} /></Field>
        </div>
        <Btn className="mt-2" data-testid="licence-issue" disabled={!iss.plan_id} onClick={() => run({ action: "issue", plan_id: iss.plan_id, count: Number(iss.count) || 1, organization: iss.organization || null, seats: n(iss.seats), note: iss.note || null, assign_email: iss.assign_email || null })}>{t("lic.issueBtn")}</Btn>
        {keys.length > 0 && <div className="mt-3 rounded-lg border border-[var(--warn)] p-2" data-testid="issued-keys"><p className="text-xs text-[var(--warn)]">{t("lic.onceWarning")}</p>{keys.map((k) => <code key={k} className="block font-mono text-sm">{k}</code>)}</div>}
      </Card>
      <Card title={t("lic.list")}>
        <ul className="divide-y divide-[var(--line)] text-sm">{data?.licences.map((l) => {
          const r = row[l.id] ?? { email: "", days: "365" };
          return (
            <li key={l.id} className="space-y-1 py-2" data-licence={l.key_hint}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{l.plan_name}</strong> <span className="font-mono text-xs">…{l.key_hint}</span> <span className="text-xs text-[var(--fg-3)]">{l.organization ?? ""} · {t("lic.seats")} {l.holders.length}/{l.seats} · {t("lic.until")} {d(l.expires_at)}</span></span>
                <Pill tone={l.status === "active" ? "ok" : l.status === "revoked" ? "danger" : l.status === "suspended" ? "warn" : "info"}>{t(`lic.status.${l.status}` as "lic.status.active")}</Pill></div>
              {l.holders.map((h) => <div key={h.user_id} className="flex items-center gap-2 text-xs">{h.email}<button className="underline" onClick={() => run({ action: "deactivate", licence_id: l.id, user_id: h.user_id })}>{t("lic.deactivate")}</button></div>)}
              {l.status !== "revoked" && <div className="flex flex-wrap items-end gap-2">
                <Input aria-label={t("auth.email")} placeholder={t("auth.email")} value={r.email} onChange={(e) => setRow({ ...row, [l.id]: { ...r, email: e.target.value } })} className="!w-56" />
                <Btn kind="ghost" onClick={() => run({ action: "assign", licence_id: l.id, email: r.email })}>{t("lic.assign")}</Btn>
                <Input aria-label={t("lic.days")} type="number" value={r.days} onChange={(e) => setRow({ ...row, [l.id]: { ...r, days: e.target.value } })} className="!w-24" />
                <Btn kind="ghost" onClick={() => run({ action: "renew", licence_id: l.id, days: Number(r.days) })}>{t("lic.renew")}</Btn>
                {l.status === "active" && <Btn kind="ghost" data-testid="licence-suspend" onClick={() => run({ action: "suspend", licence_id: l.id, reason: prompt(t("shop.reason")) })}>{t("lic.suspend")}</Btn>}
                {l.status === "suspended" && <Btn kind="ok" onClick={() => run({ action: "resume", licence_id: l.id })}>{t("lic.resume")}</Btn>}
                <Input aria-label={t("lic.maxDevices")} type="number" placeholder={t("lic.maxDevices")} defaultValue={l.max_devices ?? ""} className="!w-28" onBlur={(e) => { const v = n(e.target.value); if (v !== l.max_devices) void run({ action: "set_devices", licence_id: l.id, max_devices: v }); }} />
                <Btn kind="danger" onClick={() => { if (confirm(t("lic.revokeConfirm"))) void run({ action: "revoke", licence_id: l.id, reason: null }); }}>{t("lic.revoke")}</Btn>
              </div>}
            </li>);
        })}{!data?.licences.length && <li className="py-2 text-[var(--fg-3)]">{t("c.none")}</li>}</ul>
      </Card>
      <Card title={t("lic.history")}>
        <ul className="max-h-72 overflow-auto text-xs">{data?.events.map((e) => <li key={e.id}>{new Date(e.created_at).toLocaleString()} — {e.action}{e.key_hint ? ` …${e.key_hint}` : ""}{e.user_email ? ` · ${e.user_email}` : ""}{e.actor_email ? ` (${e.actor_email})` : ""}</li>)}</ul>
      </Card>
    </div>
  );
}
