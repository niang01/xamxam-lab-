"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { Card, Page } from "@/components/ui";
import { guideBySlug } from "@/lib/guides";

export default function GuidePage() {
  const { t } = useApp();
  const { slug } = useParams<{ slug: string }>();
  const g = guideBySlug(slug);
  if (!g) return <Page title={t("nav.guide")}><p className="text-sm">{t("err.notFound")} <Link className="underline" href="/guide">{t("nav.guide")}</Link></p></Page>;
  return (
    <Page title={g.title} subtitle={g.summary}>
      <ol className="space-y-3" data-testid="guide-steps">{g.steps.map((s, i) => (
        <li key={i}><Card title={`${i + 1}. ${s.title}`}><p className="text-sm leading-relaxed">{s.body}</p>{s.link && <Link href={s.link.href} className="mt-2 inline-block text-sm text-[var(--cyan)] underline">{s.link.label} →</Link>}</Card></li>
      ))}</ol>
      {g.example && <Card title="Exemple"><p className="text-sm">{g.example}</p></Card>}
      {g.limits && <Card title="Limites actuelles"><ul className="list-disc space-y-1 pl-5 text-sm">{g.limits.map((l, i) => <li key={i}>{l}</li>)}</ul></Card>}
      <Link href="/guide" className="text-sm underline">← {t("nav.guide")}</Link>
    </Page>
  );
}
