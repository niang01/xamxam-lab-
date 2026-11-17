"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, del, patch, post } from "@/lib/client/api";
import { CLEARANCES } from "@/lib/profiles";
import type { MsgKey } from "@/lib/i18n/messages";

type U = { id: string; email: string; display_name: string; profile_kind: string; is_admin: boolean; status: string; autonomy_level: number; clearances: { kind: string; valid_until: string | null; evidence: string }[] };
type Draft = { key: string; text: string; status: string };

export default function Admin() {
  const { t, me } = useApp();
  const isAdmin = !!me?.is_admin;
  const canValidate = isAdmin || !!me?.clearances.includes("validateur_traduction_wo");
  const { data: users, reload } = useData<{ items: U[] }>(isAdmin ? "/api/admin/users" : null);
  const { data: drafts, reload: reloadDrafts } = useData<{ items: Draft[] }>(canValidate ? "/api/i18n/entries" : null);
  const [cl, setCl] = useState<Record<string, { kind: string; evidence: string; until: string }>>({});
  const [imp, setImp] = useState({ format: "csv", mode: "validated", content: "" });
  const [res, setRes] = useState<{ imported: number; rejected: string[] } | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); reloadDrafts(); } catch (e) { setErr(e); } };
  if (!canValidate) return <Page title={t("set.admin")}><p className="text-sm">{t("err.admin")}</p></Page>;
  return (
    <Page title={t("set.admin")}>
      <ErrorBox error={err} />
      {isAdmin && (
        <Card title={t("adm.backup")}>
          <p className="mb-2 text-sm text-[var(--fg-2)]">{t("adm.backupInfo")}</p>
          <a className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm" href="/api/admin/backup" data-testid="backup-download">{t("adm.backupDownload")}</a>
        </Card>
      )}
      {isAdmin && (
        <Card title={t("adm.users")}>
          <ul className="divide-y divide-[var(--line)] text-sm">{users?.items.map((u) => {
            const c = cl[u.id] ?? { kind: CLEARANCES[0], evidence: "", until: "" };
            return (
              <li key={u.id} className="space-y-1 py-2" data-user={u.email}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{u.display_name}</strong> <span className="text-xs text-[var(--fg-3)]">{u.email} · {t(`profile.${u.profile_kind}` as MsgKey)} · N{u.autonomy_level}</span></span>
                  <span className="flex gap-1">{u.is_admin && <Pill tone="info">admin</Pill>}<Pill tone={u.status === "active" ? "ok" : "danger"}>{u.status}</Pill>{u.id !== me?.id && <Btn kind="ghost" onClick={() => run(() => patch("/api/admin/users", { id: u.id, status: u.status === "active" ? "disabled" : "active" }))}>{u.status === "active" ? t("adm.disable") : t("adm.enable")}</Btn>}</span></div>
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
      )}
      {isAdmin && (
        <Card title={t("adm.i18n")}>
          <p className="mb-2 text-sm text-[var(--fg-2)]">{t("adm.i18nInfo")}</p>
          <div className="flex flex-wrap gap-2">
            <a className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm" href="/api/i18n/export?lang=wo&format=csv">{t("adm.exportCsv")}</a>
            <Btn kind="ghost" onClick={async () => { const d = await api("/api/i18n/export?lang=wo"); const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "xamxam-wo.json"; a.click(); }}>{t("adm.exportJson")}</Btn>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Field label={t("adm.format")}><Select value={imp.format} onChange={(e) => setImp({ ...imp, format: e.target.value })}><option value="csv">CSV</option><option value="json">JSON</option></Select></Field>
            <Field label={t("adm.mode")}><Select value={imp.mode} onChange={(e) => setImp({ ...imp, mode: e.target.value })}><option value="validated">{t("adm.modeValidated")}</option><option value="draft">{t("adm.modeDraft")}</option></Select></Field>
            <Field label={t("adm.file")}><input type="file" accept=".csv,.json" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImp({ ...imp, content: await f.text(), format: f.name.endsWith(".json") ? "json" : "csv" }); }} /></Field>
          </div>
          <Textarea rows={3} aria-label={t("adm.file")} value={imp.content} onChange={(e) => setImp({ ...imp, content: e.target.value })} className="mt-2 font-mono text-xs" />
          <Btn className="mt-2" disabled={!imp.content} data-testid="import-translations" onClick={() => run(async () => setRes(await post("/api/i18n/import", { lang: "wo", ...imp })))}>{t("adm.import")}</Btn>
          {res && <p className="mt-2 text-sm" data-testid="import-result">{t("adm.imported", { n: res.imported })} {res.rejected.length > 0 && <span className="text-[var(--warn)]">{res.rejected.length} {t("adm.rejected")} : {res.rejected.slice(0, 5).join(" ; ")}</span>}</p>}
        </Card>
      )}
      <Card title={t("adm.drafts")}>
        {!drafts?.items.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : (
          <ul className="space-y-2 text-sm">{drafts.items.map((d) => (
            <li key={d.key} className="rounded-lg bg-[var(--bg-2)] p-2"><div className="font-mono text-xs text-[var(--fg-3)]">{d.key} · {d.status}</div>
              <div className="mt-1 flex gap-2"><Input value={edit[d.key] ?? d.text} onChange={(e) => setEdit({ ...edit, [d.key]: e.target.value })} /><Btn kind="ok" onClick={() => run(() => patch("/api/i18n/entries", { key: d.key, text: edit[d.key] ?? d.text, validate: true }))}>{t("adm.validate")}</Btn></div></li>))}</ul>
        )}
      </Card>
    </Page>
  );
}
