"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Nature, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del, patch, post } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type Proj = { id: string; title: string; description: string | null; objectives: string | null; problem: string | null; specs: string | null; kind: string; visibility: string; owner_name: string };
type D = {
  project: Proj; role: string;
  members: { user_id: string; role: string; display_name: string; email: string }[];
  tasks: { id: string; title: string; status: string; assignee_name: string | null; due_date: string | null }[];
  schematics: { id: string; lab: string; title: string; version: number }[];
  calcs: { id: string; calc_kind: string; initiated_by: string; missing: string[]; created_at: string }[];
  sims: { id: string; engine: string; engine_version: string; analysis: string; status: string; initiated_by: string; created_at: string }[];
  devices: { id: string; name: string; environment: string; last_seen: string | null }[];
};

const THESIS_STEPS: MsgKey[] = ["thesis.s1", "thesis.s2", "thesis.s3", "thesis.s4", "thesis.s5", "thesis.s6", "thesis.s7", "thesis.s8", "thesis.s9", "thesis.s10"];

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useApp();
  const router = useRouter();
  const { data, error, reload } = useData<D>(`/api/projects/${id}`);
  const [tab, setTab] = useState<"sheet" | "members" | "tasks" | "objects">("sheet");
  const [err, setErr] = useState<unknown>(null);
  const [edit, setEdit] = useState<Partial<Proj> | null>(null);
  const [inv, setInv] = useState({ email: "", role: "editor" });
  const [task, setTask] = useState("");
  if (error) return <Page title={t("nav.projects")}><ErrorBox error={error} /></Page>;
  if (!data) return <Page title={t("nav.projects")}><p className="text-sm">{t("c.loading")}</p></Page>;
  const p = data.project;
  const canEdit = data.role === "owner" || data.role === "editor";
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (x) { setErr(x); } };
  const tabs: [typeof tab, MsgKey][] = [["sheet", "proj.sheet"], ["members", "c.members"], ["tasks", "proj.tasks"], ["objects", "proj.objects"]];
  return (
    <Page title={p.title} subtitle={`${t(`proj.kind.${p.kind}` as MsgKey)} · ${t("c.owner")} : ${p.owner_name}`}
      actions={<>
        <Link href={`/projects/${id}/rapport`} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("proj.report")}</Link>
        <Link href={`/collab?projet=${id}`} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("nav.collab")}</Link>
        <Link href={`/ai?projet=${id}`} className="rounded-lg bg-[var(--tech)] px-3 py-1.5 text-sm text-white">{t("c.askAi")}</Link>
      </>}>
      <div className="flex flex-wrap gap-1" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-[var(--tech)] text-white" : "border border-[var(--line)] text-[var(--fg-2)]"}`}>{t(l)}</button>)}
      </div>
      <ErrorBox error={err} />
      {tab === "sheet" && (
        <Card title={t("proj.sheet")} actions={canEdit && !edit ? <Btn kind="ghost" onClick={() => setEdit({ ...p })}>{t("c.edit")}</Btn> : null}>
          {edit ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("c.title")}><Input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label={t("proj.visibility")}><Select value={edit.visibility} onChange={(e) => setEdit({ ...edit, visibility: e.target.value })}><option value="private">{t("c.private")}</option><option value="members">{t("c.members")}</option><option value="public">{t("c.public")}</option></Select></Field>
              {(["description", "problem", "objectives", "specs"] as const).map((k) => (
                <Field key={k} label={t(k === "description" ? "c.description" : (`proj.${k}` as MsgKey))}><Textarea rows={4} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>
              ))}
              <div className="flex gap-2"><Btn onClick={() => run(async () => { await patch(`/api/projects/${id}`, { title: edit.title, visibility: edit.visibility, description: edit.description || null, problem: edit.problem || null, objectives: edit.objectives || null, specs: edit.specs || null }); setEdit(null); })}>{t("c.save")}</Btn><Btn kind="ghost" onClick={() => setEdit(null)}>{t("c.cancel")}</Btn></div>
            </div>
          ) : (
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              {(["description", "problem", "objectives", "specs"] as const).map((k) => (
                <div key={k}><dt className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t(k === "description" ? "c.description" : (`proj.${k}` as MsgKey))}</dt><dd className="whitespace-pre-wrap text-[var(--fg)]">{p[k] || "—"}</dd></div>
              ))}
              <div><dt className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t("proj.visibility")}</dt><dd>{t(p.visibility === "private" ? "c.private" : p.visibility === "public" ? "c.public" : "c.members")}</dd></div>
            </dl>
          )}
          {data.role === "owner" && !edit && <div className="mt-4"><Btn kind="danger" onClick={() => { if (confirm(t("proj.confirmDelete"))) void del(`/api/projects/${id}`).then(() => router.push("/projects")).catch(setErr); }}>{t("c.delete")}</Btn></div>}
        </Card>
      )}
      {tab === "members" && (
        <Card title={t("c.members")}>
          <ul className="mb-4 divide-y divide-[var(--line)] text-sm">
            {data.members.map((m) => <li key={m.user_id} className="flex items-center justify-between py-1.5"><span>{m.display_name} <span className="text-xs text-[var(--fg-3)]">{m.email}</span></span><span className="flex items-center gap-2"><Pill>{t(`proj.role.${m.role}` as MsgKey)}</Pill>{data.role === "owner" && m.role !== "owner" && <Btn kind="ghost" onClick={() => run(() => del(`/api/projects/${id}/members?user=${m.user_id}`))}>{t("c.delete")}</Btn>}</span></li>)}
          </ul>
          {data.role === "owner" && (
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await post(`/api/projects/${id}/members`, inv); setInv({ ...inv, email: "" }); }); }}>
              <Field label={t("auth.email")}><Input type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></Field>
              <Field label={t("proj.roleLabel")}><Select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>{["editor", "commenter", "viewer"].map((r) => <option key={r} value={r}>{t(`proj.role.${r}` as MsgKey)}</option>)}</Select></Field>
              <Btn type="submit">{t("proj.invite")}</Btn>
            </form>
          )}
        </Card>
      )}
      {tab === "tasks" && (
        <Card title={t("proj.tasks")} actions={canEdit && p.kind === "thesis" && !data.tasks.length ? <Btn kind="ghost" onClick={() => run(async () => { for (const s of THESIS_STEPS) await post(`/api/projects/${id}/tasks`, { title: t(s) }); })}>{t("thesis.create")}</Btn> : null}>
          {canEdit && <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (task.trim()) void run(async () => { await post(`/api/projects/${id}/tasks`, { title: task }); setTask(""); }); }}><Input placeholder={t("proj.newTask")} value={task} onChange={(e) => setTask(e.target.value)} /><Btn type="submit">{t("c.add")}</Btn></form>}
          <div className="grid gap-3 md:grid-cols-3">
            {(["todo", "doing", "done"] as const).map((s) => (
              <div key={s} className="rounded-lg border border-[var(--line)] p-2" data-column={s}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]">{t(`task.${s}` as MsgKey)}</div>
                <ul className="space-y-2">
                  {data.tasks.filter((x) => x.status === s).map((x) => (
                    <li key={x.id} className="rounded-md bg-[var(--panel-2)] p-2 text-sm">
                      <div>{x.title}</div>
                      {canEdit && <div className="mt-1 flex gap-1">{(["todo", "doing", "done"] as const).filter((o) => o !== s).map((o) => <button key={o} className="rounded border border-[var(--line)] px-1.5 text-xs" onClick={() => run(() => patch(`/api/tasks/${x.id}`, { status: o }))}>→ {t(`task.${o}` as MsgKey)}</button>)}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "objects" && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card title={t("proj.schematics")}>{!data.schematics.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : <ul className="text-sm">{data.schematics.map((s) => <li key={s.id}><Link className="text-[var(--cyan)] underline" href={`/lab/electronics?schema=${s.id}`}>{s.title}</Link> · v{s.version}</li>)}</ul>}</Card>
          <Card title={t("proj.calcs")}>{!data.calcs.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : <ul className="space-y-1 text-sm">{data.calcs.map((c) => <li key={c.id} className="flex items-center gap-2"><Nature kind="calculation" />{c.calc_kind}{c.initiated_by === "ai" && <Pill tone="info">IA</Pill>}{c.missing.length > 0 && <Pill tone="warn">{t("c.missing")}</Pill>}</li>)}</ul>}</Card>
          <Card title={t("dash.sims")}>{!data.sims.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : <ul className="space-y-1 text-sm">{data.sims.map((s) => <li key={s.id} className="flex items-center gap-2"><Nature kind="simulation" /><Link className="text-[var(--cyan)] underline" href={`/studio?sim=${s.id}`}>{s.analysis}</Link><span className="text-xs text-[var(--fg-3)]">{s.engine_version}</span><Pill tone={s.status === "done" ? "ok" : "danger"}>{s.status}</Pill></li>)}</ul>}</Card>
          <Card title={t("nav.gateway")}>{!data.devices.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : <ul className="text-sm">{data.devices.map((d) => <li key={d.id}>{d.name} <Pill>{t(`env.${d.environment}` as MsgKey)}</Pill></li>)}</ul>}</Card>
        </div>
      )}
    </Page>
  );
}
