"use client";
/** Paramètres → double authentification (TOTP) : activation par QR code, codes de secours, désactivation. */
import { useState } from "react";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, Pill } from "./ui";
import { PasswordInput } from "./PasswordInput";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";

type State = { enabled: boolean; enabled_at: string | null; recovery_remaining: number };
type Setup = { secret: string; uri: string; qr: string };

export function MfaCard() {
  const { t } = useApp();
  const { data, reload } = useData<State>("/api/me/mfa");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<void>) => { setErr(null); try { await fn(); reload(); } catch (e) { setErr(e); } };
  if (!data) return null;

  return (
    <Card title={t("mfa.title")} testId="mfa">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {data.enabled ? <Pill tone="ok">{t("mfa.on")}</Pill> : <Pill tone="warn">{t("mfa.off")}</Pill>}
        {data.enabled && <span className="text-xs text-[var(--fg-3)]">{t("mfa.remaining", { n: data.recovery_remaining })}</span>}
      </div>
      <p className="mb-3 text-xs text-[var(--fg-3)]">{t("mfa.explain")}</p>

      {codes && (
        <div data-testid="recovery-codes" className="mb-4 rounded-lg border border-[var(--warn)] p-3">
          <p className="mb-2 text-sm font-semibold">{t("mfa.codesTitle")}</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="mt-2 text-xs text-[var(--warn)]">{t("mfa.codesOnce")}</p>
          <Btn kind="ghost" className="mt-2" onClick={() => setCodes(null)}>{t("mfa.codesSaved")}</Btn>
        </div>
      )}

      {!data.enabled && !setup && <Btn data-testid="mfa-setup" onClick={() => run(async () => { setSetup(await post<Setup>("/api/me/mfa", { action: "setup" })); })}>{t("mfa.start")}</Btn>}

      {!data.enabled && setup && (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          {/* QR code SVG produit par le serveur à partir de l'URI otpauth (aucun service tiers). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={t("mfa.qr")} className="w-[200px] rounded-lg bg-white p-2" src={`data:image/svg+xml;base64,${btoa(setup.qr)}`} />
          <div className="space-y-3 text-sm">
            <p>{t("mfa.scan")}</p>
            <p className="text-xs text-[var(--fg-3)]">{t("mfa.manual")} <code data-testid="mfa-secret" className="select-all">{setup.secret}</code></p>
            <Field label={t("mfa.code")}><Input name="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
            <Btn data-testid="mfa-enable" disabled={code.length !== 6} onClick={() => run(async () => { const r = await post<{ recovery_codes: string[] }>("/api/me/mfa", { action: "enable", code }); setCodes(r.recovery_codes); setSetup(null); setCode(""); })}>{t("mfa.enable")}</Btn>
          </div>
        </div>
      )}

      {data.enabled && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("set.currentPw")}><PasswordInput name="mfa-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label={t("mfa.codeOrRecovery")}><Input name="mfa-confirm" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Btn kind="ghost" onClick={() => run(async () => { const r = await post<{ recovery_codes: string[] }>("/api/me/mfa", { action: "recovery", password, code }); setCodes(r.recovery_codes); setCode(""); setPassword(""); })}>{t("mfa.regenerate")}</Btn>
          <Btn kind="danger" data-testid="mfa-disable" onClick={() => run(async () => { await post("/api/me/mfa", { action: "disable", password, code }); setCode(""); setPassword(""); })}>{t("mfa.disable")}</Btn>
        </div>
      )}
      <ErrorBox error={err} />
    </Card>
  );
}
