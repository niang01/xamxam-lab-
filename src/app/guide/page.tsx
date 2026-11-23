"use client";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Card, Page } from "@/components/ui";
import { GUIDES } from "@/lib/guides";

export default function Guides() {
  const { t } = useApp();
  return (
    <Page title={t("nav.guide")}>
      <div className="grid gap-3 md:grid-cols-2">{GUIDES.map((g) => (
        <Link key={g.slug} href={`/guide/${g.slug}`} data-guide={g.slug}><Card title={g.title} className="h-full hover:border-[var(--cyan)]"><p className="text-sm text-[var(--fg-2)]">{g.summary}</p><p className="mt-1 text-xs text-[var(--fg-3)]">{g.audience} · {g.steps.length} étapes</p></Card></Link>
      ))}</div>
    </Page>
  );
}
