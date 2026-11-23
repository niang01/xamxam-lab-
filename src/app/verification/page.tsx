"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Card, ErrorBox } from "@/components/ui";
import { post } from "@/lib/client/api";

export default function Verify() {
  const { t, refreshMe } = useApp();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("jeton") ?? "";
    post("/api/auth/verify-email", { token }).then(async () => { setState("ok"); await refreshMe(); }).catch((e) => { setErr(e); setState("error"); });
  }, [refreshMe]);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card title={t("ver.title")} testId="verify">
        {state === "pending" && <p className="text-sm">…</p>}
        {state === "ok" && <p className="text-sm">{t("ver.ok")} <Link className="text-[var(--cyan)] underline" href="/">{t("nav.dashboard")}</Link></p>}
        {state === "error" && <ErrorBox error={err} />}
      </Card>
    </div>
  );
}
