"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input } from "@/components/ui";
import { post } from "@/lib/client/api";
import { PasswordInput } from "@/components/PasswordInput";

export default function Login() {
  const { t, refreshMe, me } = useApp();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState(""); const [useRecovery, setUseRecovery] = useState(false);
  async function done() {
    await refreshMe();
    const next = new URLSearchParams(window.location.search).get("suite");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }
  // Reconnexion automatique : une session encore valable mène directement à la page demandée.
  useEffect(() => {
    if (!me) return;
    const next = new URLSearchParams(window.location.search).get("suite");
    window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }, [me]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await post<{ ok?: boolean; mfa_required?: boolean; challenge?: string }>("/api/auth/login", { email, password });
      if (r.mfa_required && r.challenge) { setChallenge(r.challenge); setPassword(""); return; }
      await done();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  }
  async function submitCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await post("/api/auth/mfa", useRecovery ? { challenge, recovery_code: code } : { challenge, code });
      await done();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-mono text-3xl font-bold tracking-widest text-[var(--cyan)]">XAM-XAM LAB</h1>
      <p className="mt-2 text-sm text-[var(--fg-2)]">{t("app.full")}</p>
      <p className="mt-1 text-xs text-[var(--fg-3)]">{t("app.tagline")}</p>
      {challenge ? (
      <Card className="mt-6" title={t("mfa.title")} testId="mfa-step">
        <form onSubmit={submitCode} className="space-y-3">
          <p className="text-sm text-[var(--fg-2)]">{useRecovery ? t("mfa.enterRecovery") : t("mfa.enterCode")}</p>
          <Field label={useRecovery ? t("mfa.recovery") : t("mfa.code")}>
            <Input name="code" autoFocus autoComplete="one-time-code" inputMode={useRecovery ? "text" : "numeric"} required value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <ErrorBox error={err} />
          <Btn type="submit" disabled={busy || !code.trim()} className="w-full">{t("mfa.verify")}</Btn>
          <button type="button" className="text-xs underline" onClick={() => { setUseRecovery((x) => !x); setCode(""); }}>{useRecovery ? t("mfa.useApp") : t("mfa.useRecovery")}</button>
        </form>
      </Card>
      ) : (
      <Card className="mt-6" title={t("auth.login")}>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("auth.email")}><Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t("auth.password")}><PasswordInput name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <ErrorBox error={err} />
          <Btn type="submit" disabled={busy} className="w-full">{t("auth.login")}</Btn>
        </form>
        <p className="mt-3 text-sm"><Link className="text-[var(--cyan)] underline" href="/mot-de-passe-oublie" data-testid="forgot-link">{t("pw.forgotLink")}</Link></p>
        <p className="mt-2 text-sm text-[var(--fg-2)]">{t("auth.noAccount")} <Link className="text-[var(--cyan)] underline" href="/inscription">{t("auth.register")}</Link></p>
      </Card>
      )}
      <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-[var(--fg-3)]">{t("app.motto")}</p>
    </div>
  );
}
