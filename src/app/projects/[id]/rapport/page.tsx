"use client";
import { use } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, Nature, Page } from "@/components/ui";
import { useData } from "@/lib/client/hooks";

type R = {
  generated_at: string; project: { title: string; description: string | null; problem: string | null; objectives: string | null; specs: string | null; owner_name: string };
  calcs: { calc_kind: string; inputs: Record<string, unknown>; outputs: { outputs?: Record<string, { label: string; value: number; unit: string }>; missing?: string[] } | null; missing: string[]; initiated_by: string; created_at: string }[];
  sims: { engine: string; engine_version: string; analysis: string; status: string; input_hash: string; errors: string[]; initiated_by: string; created_at: string; input: string }[];
  measures: { device: string; environment: string; metric: string; unit: string | null; n: number; min: number; max: number; avg: number; first: string; last: string }[];
  simulatedReadings: number; tasks: { title: string; status: string }[];
};

export default function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data } = useData<R>(`/api/projects/${id}/report`);
  if (!data) return <Page title={t("proj.report")}><p>{t("c.loading")}</p></Page>;
  const p = data.project;
  return (
    <Page title={`${t("proj.report")} — ${p.title}`} subtitle={`${t("c.owner")} : ${p.owner_name} · ${new Date(data.generated_at).toLocaleString()}`} actions={<Btn className="no-print" onClick={() => window.print()}>{t("c.print")}</Btn>}>
      <Card title={t("proj.sheet")}>
        <dl className="space-y-2 text-sm">{(["description", "problem", "objectives", "specs"] as const).map((k) => p[k] ? <div key={k}><dt className="font-semibold">{t(k === "description" ? "c.description" : (`proj.${k}` as "proj.problem"))}</dt><dd className="whitespace-pre-wrap">{p[k]}</dd></div> : null)}</dl>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Nature kind="calculation" />{t("report.calcs")}</span>}>
        {!data.calcs.length ? <p className="text-sm">{t("c.none")}</p> : data.calcs.map((c, i) => (
          <div key={i} className="mb-3 border-b border-[var(--line)] pb-2 text-sm">
            <div className="font-semibold">{c.calc_kind} <span className="text-xs font-normal text-[var(--fg-3)]">{new Date(c.created_at).toLocaleString()} · {c.initiated_by === "ai" ? "IA" : t("report.human")}</span></div>
            <ul className="ml-4 list-disc">{Object.values(c.outputs?.outputs ?? {}).map((o) => <li key={o.label}>{o.label} : <span className="font-mono">{o.value} {o.unit}</span></li>)}</ul>
            {c.missing.length > 0 && <p className="text-[var(--warn)]">{t("c.missing")} : {c.missing.join(" ; ")}</p>}
          </div>
        ))}
      </Card>
      <Card title={<span className="flex items-center gap-2"><Nature kind="simulation" />{t("report.sims")}</span>}>
        {!data.sims.length ? <p className="text-sm">{t("c.none")}</p> : (
          <table className="w-full text-left text-xs"><thead><tr className="text-[var(--fg-3)]"><th>{t("c.date")}</th><th>{t("studio.engine")}</th><th>{t("studio.analysis")}</th><th>{t("c.status")}</th><th>SHA-256</th></tr></thead>
            <tbody>{data.sims.map((s, i) => <tr key={i} className="border-t border-[var(--line)]"><td>{new Date(s.created_at).toLocaleString()}</td><td>{s.engine_version}</td><td>{s.analysis}</td><td>{s.status}{s.errors.length ? ` — ${s.errors[0]}` : ""}</td><td className="font-mono">{s.input_hash.slice(0, 12)}…</td></tr>)}</tbody></table>
        )}
      </Card>
      <Card title={<span className="flex items-center gap-2"><Nature kind="measurement" />{t("report.measures")}</span>}>
        {!data.measures.length ? <p className="text-sm">{t("c.none")}</p> : (
          <table className="w-full text-left text-xs"><thead><tr className="text-[var(--fg-3)]"><th>{t("iot.device")}</th><th>{t("iot.metric")}</th><th>n</th><th>min</th><th>moy.</th><th>max</th><th>{t("report.period")}</th></tr></thead>
            <tbody>{data.measures.map((m, i) => <tr key={i} className="border-t border-[var(--line)]"><td>{m.device} ({t(`env.${m.environment}` as "env.real")})</td><td>{m.metric} {m.unit ? `(${m.unit})` : ""}</td><td>{m.n}</td><td>{Number(m.min).toPrecision(4)}</td><td>{Number(m.avg).toPrecision(4)}</td><td>{Number(m.max).toPrecision(4)}</td><td>{new Date(m.first).toLocaleString()} → {new Date(m.last).toLocaleString()}</td></tr>)}</tbody></table>
        )}
        {data.simulatedReadings > 0 && <p className="mt-2 text-xs text-[var(--warn)]">{t("report.simulatedExcluded", { n: data.simulatedReadings })}</p>}
      </Card>
    </Page>
  );
}
