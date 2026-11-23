"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select } from "@/components/ui";
import { del, patch, post } from "@/lib/client/api";
import { LANGS } from "@/lib/i18n/runtime";
import type { MsgKey } from "@/lib/i18n/messages";
import { MfaCard } from "@/components/MfaCard";

export default function Settings() {
  const { t, me, refreshMe, lang, setLang, fallback, setFallback } = useApp();
  const router = useRouter();
  const [name, setName] = useState(me?.display_name ?? "");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>, ok = t("c.saved")) => { setErr(null); setMsg(""); try { await fn(); await refreshMe(); setMsg(ok); } catch (e) { setErr(e); } };
  if (!me) return null;
  return (
    <Page title={t("nav.settings")} actions={me.is_admin ? <Link href="/admin" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("set.admin")}</Link> : null}>
      {msg && <Pill tone="ok">{msg}</Pill>}
      <ErrorBox error={err} />
      <Card title={t("set.profile")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("auth.displayName")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Btn onClick={() => run(() => patch("/api/me", { display_name: name }))}>{t("c.save")}</Btn>
        </div>
        <p className="mt-2 text-sm text-[var(--fg-2)]">{me.email} · {t(`profile.${me.profile_kind}` as MsgKey)}{me.organization ? ` · ${me.organization}` : ""}</p>
        <p className="mt-1 text-xs">{me.email_verified_at ? <Pill tone="ok">{t("adm.verified")}</Pill> : <><Pill tone="warn">{t("adm.notVerified")}</Pill> <button className="underline" onClick={() => run(async () => { const r = await post<{ verification: string }>("/api/me/verify-email", {}); if (r.verification === "not_configured") throw new Error(t("ver.notConfigured")); }, t("ver.sent"))}>{t("ver.resend")}</button></>}</p>
        <div className="mt-2 flex flex-wrap gap-2"><Link href="/bienvenue" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("onb.edit")}</Link><Link href="/licence" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("lic.title")}</Link>{!me.is_admin && <Link href="/installation" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("inst.title")}</Link>}</div>
        <p className="mt-1 text-xs text-[var(--fg-3)]">{t("set.clearances")} : {me.clearances.length ? me.clearances.join(", ") : t("c.none")}</p>
      </Card>
      <Card title={t("c.language")}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("c.language")}><Select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>{LANGS.map((l) => <option key={l} value={l}>{t(`lang.${l}` as MsgKey)}</option>)}</Select></Field>
          <Field label={t("lang.fallback")}><Select value={fallback} onChange={(e) => setFallback(e.target.value as "fr" | "en")}><option value="fr">{t("lang.fr")}</option><option value="en">{t("lang.en")}</option></Select></Field>
        </div>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("set.langInfo")}</p>
      </Card>
      <Card title={t("set.autonomy")}>
        <p className="mb-2 text-sm text-[var(--fg-2)]">{t("set.autonomyInfo")}</p>
        <div className="space-y-1">{[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex items-start gap-2 text-sm"><input type="radio" name="autonomy" checked={me.autonomy_level === n} onChange={() => run(() => patch("/api/me", { autonomy_level: n }))} /><span><strong>{n}.</strong> {t(`set.lvl${n}` as MsgKey)}</span></label>))}</div>
      </Card>
      <Card title={t("set.security")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("set.currentPw")}><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label={t("set.newPw")} hint={t("auth.passwordHint")}><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Btn onClick={() => run(async () => { await patch("/api/me", { password: pw }); router.replace("/connexion"); })}>{t("set.changePw")}</Btn>
        </div>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("set.pwInfo")}</p>
      </Card>
      <MfaCard />
      <Card title={t("set.data")}>
        <div className="flex flex-wrap gap-2">
          <a href="/api/me" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("set.export")}</a>
          <Btn kind="danger" onClick={() => { if (confirm(t("set.deleteConfirm"))) void del("/api/me").then(async () => { await refreshMe(); router.replace("/connexion"); }).catch(setErr); }}>{t("set.delete")}</Btn>
        </div>
      </Card>
    </Page>
  );
}
