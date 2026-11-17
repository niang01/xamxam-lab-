"use client";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Card, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import type { MsgKey } from "@/lib/i18n/messages";

type D = { counts: Record<string, number>; recentProjects: { id: string; title: string; kind: string }[]; recentSims: { id: string; engine: string; analysis: string; status: string; created_at: string }[] };

const QUICK: [string, MsgKey][] = [["/projects?nouveau=1", "dash.newProject"], ["/lab/electronics", "dash.newSchematic"], ["/iot", "dash.connectDevice"], ["/ai", "dash.askAi"]];

export default function Dashboard() {
  const { t, me } = useApp();
  const { data } = useData<D>("/api/dashboard");
  const c = data?.counts;
  const tiles: [MsgKey, number | undefined, string, "ok" | "warn" | "info" | "neutral"][] = [
    ["dash.projects", c?.projects, "/projects", "info"],
    ["dash.sims", c?.sims, "/studio", "info"],
    ["dash.devicesLive", c?.devicesLive, "/iot", "ok"],
    ["dash.devicesOffline", c?.devicesOffline, "/iot", c?.devicesOffline ? "warn" : "neutral"],
    ["dash.pendingCmd", c?.pendingCmd, "/remote", c?.pendingCmd ? "warn" : "neutral"],
    ["dash.approvals", c?.approvals, "/ai", c?.approvals ? "warn" : "neutral"],
    ["dash.tasks", c?.tasks, "/projects", "neutral"],
    ["dash.courses", c?.courses, "/academy", "neutral"],
  ];
  return (
    <Page title={`${t("dash.hello")}, ${me?.display_name ?? ""}`} subtitle={t("app.tagline")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([k, v, href, tone]) => (
          <Link key={k} href={href} data-tile={k} className="holo rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--cyan)]">
            <div className="text-xs text-[var(--fg-3)]">{t(k)}</div>
            <div className="mt-1 flex items-baseline gap-2"><span className="font-mono text-3xl text-[var(--fg)]">{v ?? "—"}</span>{tone !== "neutral" && v ? <Pill tone={tone}>●</Pill> : null}</div>
          </Link>
        ))}
      </div>
      <Card title={t("dash.quick")}>
        <div className="flex flex-wrap gap-2">
          {QUICK.map(([href, k]) => <Link key={k} href={href} className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:border-[var(--cyan)]">{t(k)}</Link>)}
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card title={t("dash.recentProjects")}>
          {!data?.recentProjects.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> :
            <ul className="space-y-1 text-sm">{data.recentProjects.map((p) => <li key={p.id}><Link className="text-[var(--cyan)] hover:underline" href={`/projects/${p.id}`}>{p.title}</Link></li>)}</ul>}
        </Card>
        <Card title={t("dash.recentSims")}>
          {!data?.recentSims.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> :
            <ul className="space-y-1 text-sm">{data.recentSims.map((s) => <li key={s.id} className="flex justify-between gap-2"><span>{s.engine} · {s.analysis}</span><Pill tone={s.status === "done" ? "ok" : s.status === "failed" ? "danger" : "info"}>{s.status}</Pill></li>)}</ul>}
        </Card>
      </div>
      <p className="text-center font-mono text-[10px] tracking-widest text-[var(--fg-3)]">{t("app.motto")}</p>
    </Page>
  );
}
