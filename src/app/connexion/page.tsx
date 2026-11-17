"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input } from "@/components/ui";
import { post } from "@/lib/client/api";

export default function Login() {
  const { t, refreshMe } = useApp();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await post("/api/auth/login", { email, password });
      await refreshMe();
      const next = new URLSearchParams(window.location.search).get("suite");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (x) { setErr(x); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-mono text-3xl font-bold tracking-widest text-[var(--cyan)]">XAM-XAM LAB</h1>
      <p className="mt-2 text-sm text-[var(--fg-2)]">{t("app.full")}</p>
      <p className="mt-1 text-xs text-[var(--fg-3)]">{t("app.tagline")}</p>
      <Card className="mt-6" title={t("auth.login")}>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("auth.email")}><Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t("auth.password")}><Input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <ErrorBox error={err} />
          <Btn type="submit" disabled={busy} className="w-full">{t("auth.login")}</Btn>
        </form>
        <p className="mt-4 text-sm text-[var(--fg-2)]">{t("auth.noAccount")} <Link className="text-[var(--cyan)] underline" href="/inscription">{t("auth.register")}</Link></p>
      </Card>
      <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-[var(--fg-3)]">{t("app.motto")}</p>
    </div>
  );
}
