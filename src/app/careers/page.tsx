"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { EcoBoard } from "@/components/EcoBoard";
import { Card, Input, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import type { MsgKey } from "@/lib/i18n/messages";

type Talent = { id: string; display_name: string; profile_kind: string; country: string | null; bio: string | null; skills: string[]; certificates: number; public_projects: number };

export default function Careers() {
  const { t, me } = useApp();
  const [q, setQ] = useState("");
  const canSearch = me?.capabilities.includes("search_talents");
  const { data } = useData<{ items: Talent[] }>(canSearch ? `/api/talents?q=${encodeURIComponent(q)}` : null);
  return (
    <Page title={t("nav.careers")} subtitle={t("eco.careers.subtitle")}>
      <h2 className="text-lg font-semibold">{t("eco.jobs")}</h2>
      <EcoBoard kind="job" capability="post_jobs" fields={[{ k: "company", type: "text" }, { k: "contract", type: "select", options: ["job", "internship", "mission", "cofounder"] }, { k: "location", type: "text" }, { k: "remote", type: "bool" }, { k: "description", type: "textarea" }, { k: "skills", type: "list" }]} />
      <h2 className="text-lg font-semibold">{t("eco.talents")}</h2>
      <p className="text-xs text-[var(--fg-3)]">{t("eco.talentsInfo")} <Link href="/portfolio" className="text-[var(--cyan)] underline">{t("nav.portfolio")}</Link></p>
      {canSearch ? (
        <Card>
          <Input placeholder={t("eco.talentSearch")} aria-label={t("eco.talentSearch")} value={q} onChange={(e) => setQ(e.target.value)} className="!w-72" />
          <ul className="mt-3 divide-y divide-[var(--line)]">{data?.items.map((u) => (
            <li key={u.id} className="py-2 text-sm"><Link href={`/p/portfolio/${u.id}`} className="font-semibold text-[var(--cyan)] underline">{u.display_name}</Link> <span className="text-xs text-[var(--fg-3)]">{t(`profile.${u.profile_kind}` as MsgKey)}{u.country ? ` · ${u.country}` : ""}</span>
              <div className="mt-1 flex flex-wrap gap-1">{u.skills.map((s) => <Pill key={s}>{s}</Pill>)}<Pill tone="ok">{u.certificates} {t("eco.certs")}</Pill><Pill tone="info">{u.public_projects} {t("eco.projects")}</Pill></div></li>))}
            {data && !data.items.length && <li className="py-2 text-sm text-[var(--fg-3)]">{t("c.none")}</li>}</ul>
        </Card>
      ) : <p className="text-sm text-[var(--fg-3)]">{t("eco.talentsReserved")}</p>}
    </Page>
  );
}
