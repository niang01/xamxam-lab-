"use client";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Card, ErrorBox, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del } from "@/lib/client/api";
import { useState } from "react";
import type { SoftwareDef } from "@/components/StudyWorkbench";

type L = { software: SoftwareDef[]; items: { id: string; software: string; title: string; updated_at: string; ok: boolean }[] };

export default function Sizing() {
  const { t } = useApp();
  const { data, reload } = useData<L>("/api/studies");
  const [err, setErr] = useState<unknown>(null);
  return (
    <Page title={t("nav.sizing")} subtitle={t("study.subtitle")}>
      <ErrorBox error={err} />
      <Card title={t("study.software")} testId="software-list">
        {!data ? <p className="text-sm">{t("c.loading")}</p> : (
          <ul className="grid gap-3 md:grid-cols-2">{data.software.map((s) => (
            <li key={s.key} className="rounded-xl border border-[var(--line)] p-3">
              <Link href={`/dimensionnement/${s.key}`} className="font-medium text-[var(--cyan)] hover:underline" data-software={s.key}>{s.title}</Link>
              <p className="mt-1 text-xs text-[var(--fg-3)]">{s.summary}</p>
            </li>))}</ul>
        )}
      </Card>
      <Card title={t("study.mine")}>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)] text-sm">{data.items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link className="underline" href={`/dimensionnement/${s.software}?etude=${s.id}`}>{s.title}</Link>
              <span className="flex items-center gap-2 text-xs text-[var(--fg-3)]">{data.software.find((x) => x.key === s.software)?.title.split(":")[0]} · {new Date(s.updated_at).toLocaleString()} {s.ok ? <Pill tone="ok">{t("study.complete")}</Pill> : <Pill tone="warn">{t("study.incomplete")}</Pill>}
                <button className="underline" onClick={async () => { if (!confirm(t("study.deleteConfirm"))) return; try { await del(`/api/studies/${s.id}`); reload(); } catch (e) { setErr(e); } }}>{t("c.delete")}</button></span>
            </li>))}</ul>
        )}
      </Card>
    </Page>
  );
}
