"use client";
/** Administration des comptes : rôles, statut, habilitations, essai et licence, lien de réinitialisation. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Input, Pill, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del, patch, post } from "@/lib/client/api";
import { CLEARANCES, PROFILES } from "@/lib/profiles";
import type { MsgKey } from "@/lib/i18n/messages";

type U = { id: string; email: string; display_name: string; profile_kind: string; is_admin: boolean; status: string; autonomy_level: number; created_at: string; last_login_at: string | null;
  email_verified_at: string | null; organization: string | null; locked_until: string | null;
  clearances: { kind: string; valid_until: string | null; evidence: string }[];
  access: { state: string; trial_ends_at: string | null; licence: { plan_name: string; expires_at: string } | null } };
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

export function UsersAdmin() {
  const { t, me } = useApp();
  const { data: users, reload } = useData<{ items: U[] }>("/api/admin/users");
  const [cl, setCl] = useState<Record<string, { kind: string; evidence: string; until: string }>>({});
  const [q, setQ] = useState("");
  const [link, setLink] = useState<{ email: string; link: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (e) { setErr(e); } };
  const act = (id: string, body: Record<string, unknown>) => post<{ link?: string }>(`/api/admin/users/${id}/actions`, body);
  const items = (users?.items ?? []).filter((u) => !q || `${u.email} ${u.display_name} ${u.organization ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title={t("adm.users")} testId="users-admin">
      <ErrorBox error={err} />
      <div className="mb-2 flex flex-wrap items-center gap-2"><Input aria-label={t("c.search")} placeholder={t("c.search")} value={q} onChange={(e) => setQ(e.target.value)} className="!w-64" /><span className="text-xs text-[var(--fg-3)]">{items.length} / {users?.items.length ?? 0}</span></div>
      {link && <div className="mb-2 rounded-lg border border-[var(--warn)] p-2 text-xs" data-testid="reset-link"><p>{t("adm.resetLinkInfo", { email: link.email })}</p><code className="block break-all">{link.link}</code></div>}
      <ul className="divide-y divide-[var(--line)] text-sm">{items.map((u) => {
        const c = cl[u.id] ?? { kind: CLEARANCES[0], evidence: "", until: "" };
        return (
          <li key={u.id} className="space-y-1 py-2" data-user={u.email}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><strong>{u.display_name}</strong> <span className="text-xs text-[var(--fg-3)]">{u.email}{u.organization ? ` · ${u.organization}` : ""} · {t("adm.created")} {d(u.created_at)} · {t("adm.lastLogin")} {d(u.last_login_at)}</span></span>
              <span className="flex flex-wrap gap-1">{u.is_admin && <Pill tone="info">admin</Pill>}<Pill tone={u.status === "active" ? "ok" : "danger"}>{u.status}</Pill>
                <Pill tone={u.email_verified_at ? "ok" : "warn"}>{u.email_verified_at ? t("adm.verified") : t("adm.notVerified")}</Pill>
                <Pill tone={["admin", "trial", "licensed"].includes(u.access.state) ? "ok" : "danger"}>{t(`lic.state.${u.access.state}` as MsgKey)}{u.access.licence ? ` · ${u.access.licence.plan_name} → ${d(u.access.licence.expires_at)}` : u.access.trial_ends_at ? ` → ${d(u.access.trial_ends_at)}` : ""}</Pill></span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label={t("auth.profile")} value={u.profile_kind} onChange={(e) => run(() => act(u.id, { action: "set_profile", profile_kind: e.target.value }))} className="!w-auto">{PROFILES.map((p) => <option key={p} value={p}>{t(`profile.${p}` as MsgKey)}</option>)}</Select>
              {u.id !== me?.id && <Btn kind="ghost" onClick={() => run(() => patch("/api/admin/users", { id: u.id, status: u.status === "active" ? "disabled" : "active" }))}>{u.status === "active" ? t("adm.disable") : t("adm.enable")}</Btn>}
              {u.id !== me?.id && <Btn kind="ghost" onClick={() => run(() => act(u.id, { action: "set_admin", is_admin: !u.is_admin }))}>{u.is_admin ? t("adm.removeAdmin") : t("adm.makeAdmin")}</Btn>}
              <Btn kind="ghost" data-testid="reset-link-btn" onClick={() => run(async () => { const r = await act(u.id, { action: "reset_link" }); setLink({ email: u.email, link: r.link! }); })}>{t("adm.resetLink")}</Btn>
              {!u.email_verified_at && <Btn kind="ghost" onClick={() => run(() => act(u.id, { action: "verify_email" }))}>{t("adm.markVerified")}</Btn>}
              {u.locked_until && <Btn kind="ghost" onClick={() => run(() => act(u.id, { action: "unlock" }))}>{t("adm.unlock")}</Btn>}
              <Btn kind="ghost" onClick={() => run(() => act(u.id, { action: "extend_trial", days: 30 }))}>{t("adm.extendTrial")}</Btn>
              {u.id !== me?.id && <Btn kind="danger" data-testid="delete-account" onClick={() => { const c = prompt(t("adm.deleteConfirm", { email: u.email })); if (c !== null) void run(() => act(u.id, { action: "delete_account", confirm_email: c })); }}>{t("adm.deleteAccount")}</Btn>}
            </div>
            <div className="flex flex-wrap gap-1">{u.clearances.map((x) => <span key={x.kind} className="inline-flex items-center gap-1 rounded bg-[var(--panel-2)] px-2 py-0.5 text-xs" title={x.evidence}>{t(`clr.${x.kind}` as MsgKey)}{x.valid_until ? ` (≤ ${x.valid_until})` : ""}<button aria-label={t("c.delete")} onClick={() => run(() => del(`/api/admin/users/${u.id}/clearances?kind=${x.kind}`))}>✕</button></span>)}</div>
            <div className="flex flex-wrap items-end gap-2">
              <Select aria-label={t("adm.clearance")} value={c.kind} onChange={(e) => setCl({ ...cl, [u.id]: { ...c, kind: e.target.value } })} className="!w-auto">{CLEARANCES.map((k) => <option key={k} value={k}>{t(`clr.${k}` as MsgKey)}</option>)}</Select>
              <Input aria-label={t("adm.evidence")} placeholder={t("adm.evidence")} value={c.evidence} onChange={(e) => setCl({ ...cl, [u.id]: { ...c, evidence: e.target.value } })} className="!w-64" />
              <Input aria-label={t("adm.until")} type="date" value={c.until} onChange={(e) => setCl({ ...cl, [u.id]: { ...c, until: e.target.value } })} className="!w-40" />
              <Btn kind="ghost" data-testid="grant-clearance" onClick={() => run(() => post(`/api/admin/users/${u.id}/clearances`, { kind: c.kind, evidence: c.evidence, valid_until: c.until || null }))}>{t("adm.grant")}</Btn>
            </div>
          </li>
        );
      })}</ul>
    </Card>
  );
}
