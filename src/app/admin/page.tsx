"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, patch, post } from "@/lib/client/api";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { LicencesAdmin } from "@/components/admin/LicencesAdmin";
import { ShopAdmin } from "@/components/admin/ShopAdmin";

type Draft = { key: string; text: string; status: string };

export default function Admin() {
  const { t, me } = useApp();
  const isAdmin = !!me?.is_admin;
  const canValidate = isAdmin || !!me?.clearances.includes("validateur_traduction_wo");
  const { data: drafts, reload: reloadDrafts } = useData<{ items: Draft[] }>(canValidate ? "/api/i18n/entries" : null);
  const [tab, setTab] = useState<"users" | "licences" | "shop" | "other">("users");
  const [imp, setImp] = useState({ format: "csv", mode: "validated", content: "" });
  const [res, setRes] = useState<{ imported: number; rejected: string[] } | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reloadDrafts(); } catch (e) { setErr(e); } };
  if (!canValidate) return <Page title={t("set.admin")}><p className="text-sm">{t("err.admin")}</p></Page>;
  return (
    <Page title={t("set.admin")}>
      <ErrorBox error={err} />
      {isAdmin && tab === "other" && (
        <Card title={t("adm.backup")}>
          <p className="mb-2 text-sm text-[var(--fg-2)]">{t("adm.backupInfo")}</p>
          <a className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm" href="/api/admin/backup" data-testid="backup-download">{t("adm.backupDownload")}</a>
        </Card>
      )}
      {isAdmin && (
        <div role="tablist" className="flex flex-wrap gap-2">
          {(["users", "licences", "shop", "other"] as const).map((k) => <Btn key={k} kind={tab === k ? "primary" : "ghost"} role="tab" aria-selected={tab === k} data-testid={`admin-tab-${k}`} onClick={() => setTab(k)}>{t(`adm.tab.${k}`)}</Btn>)}
        </div>
      )}
      {isAdmin && tab === "users" && <UsersAdmin />}
      {isAdmin && tab === "licences" && <LicencesAdmin />}
      {isAdmin && tab === "shop" && <ShopAdmin />}
      {isAdmin && tab === "other" && (
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
