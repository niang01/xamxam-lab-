"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input } from "@/components/ui";
import { post } from "@/lib/client/api";

export default function Reset() {
  const { t } = useApp();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du jeton dans l'URL après le montage
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("jeton") ?? ""); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (pw.a !== pw.b) { setErr(new Error(t("pw.mismatch"))); return; }
    setBusy(true);
    try { await post("/api/auth/password/reset", { token, password: pw.a }); setDone(true); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-mono text-3xl font-bold tracking-widest text-[var(--cyan)]">XAM-XAM LAB</h1>
      <Card className="mt-6" title={t("pw.resetTitle")} testId="reset">
        {done ? <p className="text-sm" data-testid="reset-done">{t("pw.resetDone")} <Link className="text-[var(--cyan)] underline" href="/connexion">{t("auth.login")}</Link></p>
          : !token ? <p className="text-sm">{t("err.tokenInvalid")}</p> : (
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("set.newPw")} hint={t("auth.passwordHint")}><Input name="password" type="password" minLength={10} required autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
            <Field label={t("pw.confirm")}><Input name="password2" type="password" minLength={10} required autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
            <ErrorBox error={err} />
            <Btn type="submit" disabled={busy} className="w-full">{t("pw.resetBtn")}</Btn>
          </form>
        )}
      </Card>
    </div>
  );
}
