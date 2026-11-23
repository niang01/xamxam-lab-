"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";

type S = { admin_exists: boolean; you_are_admin: boolean; admin_emails_configured: boolean; keys: { session: string; encryption: string }; mail_configured: boolean };

/** Installation : état de la configuration et initialisation sécurisée du premier administrateur. */
export default function Installation() {
  const { t, refreshMe } = useApp();
  const { data, reload } = useData<S>("/api/installation");
  const [code, setCode] = useState(""); const [err, setErr] = useState<unknown>(null); const [done, setDone] = useState(false);
  const yes = (b: boolean) => <Pill tone={b ? "ok" : "warn"}>{b ? t("c.yes") : t("c.no")}</Pill>;
  return (
    <Page title={t("inst.title")}>
      <Card title={t("inst.state")} testId="install-state">
        {data && <ul className="space-y-1 text-sm">
          <li>{t("inst.adminExists")} : {yes(data.admin_exists)}</li>
          <li>{t("inst.youAdmin")} : {yes(data.you_are_admin)}</li>
          <li>{t("inst.adminEmails")} : {yes(data.admin_emails_configured)}</li>
          <li>{t("inst.sessionKey")} : <Pill tone={data.keys.session === "environment" ? "ok" : "info"}>{t(data.keys.session === "environment" ? "inst.keyEnv" : "inst.keyDb")}</Pill></li>
          <li>{t("inst.encKey")} : <Pill tone={data.keys.encryption === "environment" ? "ok" : "info"}>{t(data.keys.encryption === "environment" ? "inst.keyEnv" : "inst.keyDb")}</Pill></li>
          <li>{t("inst.mail")} : {yes(data.mail_configured)}</li>
        </ul>}
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("inst.keyInfo")}</p>
      </Card>
      {data && !data.admin_exists && !done && (
        <Card title={t("inst.claim")} testId="install-claim">
          <p className="mb-2 text-sm text-[var(--fg-2)]">{t("inst.claimInfo")}</p>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
            <li>{t("inst.step1")}</li><li>{t("inst.step2")}</li><li>{t("inst.step3")}</li>
          </ol>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("inst.code")}><Input name="setup-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" /></Field>
            <Btn data-testid="install-claim-btn" disabled={code.trim().length < 10} onClick={async () => { setErr(null); try { await post("/api/installation", { code }); setDone(true); await refreshMe(); reload(); } catch (e) { setErr(e); } }}>{t("inst.claimBtn")}</Btn>
          </div>
          <ErrorBox error={err} />
        </Card>
      )}
      {done && <Pill tone="ok">{t("inst.done")}</Pill>}
    </Page>
  );
}
