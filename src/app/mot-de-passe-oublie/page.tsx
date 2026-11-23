"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input } from "@/components/ui";
import { post } from "@/lib/client/api";

export default function Forgot() {
  const { t } = useApp();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"configured" | "not_configured" | null>(null);
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await post<{ mail: "configured" | "not_configured" }>("/api/auth/password/forgot", { email }); setState(r.mail); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-mono text-3xl font-bold tracking-widest text-[var(--cyan)]">XAM-XAM LAB</h1>
      <Card className="mt-6" title={t("pw.forgotTitle")} testId="forgot">
        {state === "configured" ? <p className="text-sm" data-testid="forgot-sent">{t("pw.sent")}</p>
          : state === "not_configured" ? <p className="text-sm" data-testid="forgot-nomail">{t("pw.noMail")}</p>
          : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-[var(--fg-2)]">{t("pw.forgotInfo")}</p>
            <Field label={t("auth.email")}><Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <ErrorBox error={err} />
            <Btn type="submit" disabled={busy} className="w-full">{t("pw.send")}</Btn>
          </form>
        )}
        <p className="mt-4 text-sm"><Link className="text-[var(--cyan)] underline" href="/connexion">{t("auth.login")}</Link></p>
      </Card>
    </div>
  );
}
