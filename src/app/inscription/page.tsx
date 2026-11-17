"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Select } from "@/components/ui";
import { post } from "@/lib/client/api";
import { SELF_SERVICE_PROFILES } from "@/lib/profiles";
import type { MsgKey } from "@/lib/i18n/messages";

export default function Register() {
  const { t, lang, fallback, refreshMe } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", display_name: "", profile_kind: "student" });
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await post("/api/auth/register", { ...f, locale: lang, fallback_locale: fallback }); await refreshMe(); router.replace("/"); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-mono text-3xl font-bold tracking-widest text-[var(--cyan)]">XAM-XAM LAB</h1>
      <Card className="mt-6" title={t("auth.register")}>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("auth.displayName")}><Input name="display_name" required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
          <Field label={t("auth.email")}><Input name="email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label={t("auth.password")} hint={t("auth.passwordHint")}><Input name="password" type="password" minLength={10} required autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label={t("auth.profile")}>
            <Select name="profile_kind" value={f.profile_kind} onChange={(e) => setF({ ...f, profile_kind: e.target.value })}>
              {SELF_SERVICE_PROFILES.map((p) => <option key={p} value={p}>{t(`profile.${p}` as MsgKey)}</option>)}
            </Select>
          </Field>
          <p className="text-xs text-[var(--fg-3)]">{t("auth.privacy")}</p>
          <ErrorBox error={err} />
          <Btn type="submit" disabled={busy} className="w-full">{t("auth.register")}</Btn>
        </form>
        <p className="mt-4 text-sm text-[var(--fg-2)]">{t("auth.haveAccount")} <Link className="text-[var(--cyan)] underline" href="/connexion">{t("auth.login")}</Link></p>
      </Card>
    </div>
  );
}
