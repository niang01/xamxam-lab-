"use client";
import Link from "next/link";
import { use } from "react";
import { useT } from "@/components/providers";
import { Card, ErrorBox, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import type { MsgKey } from "@/lib/i18n/messages";

type P = { user: { display_name: string; profile_kind: string; country: string | null; bio: string | null; skills: string[] }; projects: { id: string; title: string; description: string | null; kind: string }[]; certificates: { id: string; title: string; score: number; issued_at: string }[]; startups: { id: string; title: string }[] };

export default function PublicPortfolio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data, error } = useData<P>(`/api/public/portfolio/${id}`);
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8" data-testid="public-portfolio">
      {error && <ErrorBox error={error} />}
      {data && <>
        <h1 className="text-3xl font-semibold">{data.user.display_name}</h1>
        <p className="text-sm text-[var(--fg-2)]">{t(`profile.${data.user.profile_kind}` as MsgKey)}{data.user.country ? ` · ${data.user.country}` : ""}</p>
        {data.user.bio && <p className="whitespace-pre-wrap">{data.user.bio}</p>}
        <div className="flex flex-wrap gap-1">{data.user.skills.map((s) => <Pill key={s}>{s}</Pill>)}</div>
        <Card title={t("port.projects")}>{!data.projects.length ? <p className="text-sm">{t("c.none")}</p> : <ul className="space-y-2 text-sm">{data.projects.map((p) => <li key={p.id}><strong>{p.title}</strong><p className="text-[var(--fg-2)]">{p.description}</p></li>)}</ul>}</Card>
        <Card title={t("port.certificates")}>{!data.certificates.length ? <p className="text-sm">{t("c.none")}</p> : <ul className="space-y-1 text-sm">{data.certificates.map((c) => <li key={c.id}><Link className="text-[var(--cyan)] underline" href={`/p/certificat/${c.id}`}>{c.title}</Link> — {c.score} % · {new Date(c.issued_at).toLocaleDateString()}</li>)}</ul>}</Card>
        {data.startups.length > 0 && <Card title={t("nav.startups")}><ul className="text-sm">{data.startups.map((s) => <li key={s.id}>{s.title}</li>)}</ul></Card>}
      </>}
    </div>
  );
}
