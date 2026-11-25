"use client";
/** Devoirs, TD, TP et examens : création (formateur), remise (apprenant), correction notée. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, post, RequestError } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type A = { id: string; kind: string; title: string; instructions: string; due_at: string | null; max_points: number; submission_id: string | null; submitted_at: string | null; late: boolean | null; grade: number | null; feedback: string | null; file_name: string | null; submissions: number; to_grade: number };
type Sub = { id: string; display_name: string; text: string | null; file_name: string | null; submitted_at: string; late: boolean; grade: number | null; feedback: string | null };

export function CourseAssignments({ courseId, canSee }: { courseId: string; canSee: boolean }) {
  const { t } = useApp();
  const { data, reload } = useData<{ author: boolean; items: A[] }>(canSee ? `/api/courses/${courseId}/assignments` : null);
  const [n, setN] = useState({ kind: "devoir", title: "", instructions: "", due: "", max: "20" });
  const [answer, setAnswer] = useState<Record<string, string>>({}); const [file, setFile] = useState<Record<string, File | null>>({});
  const [subs, setSubs] = useState<Record<string, Sub[]>>({}); const [g, setG] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [err, setErr] = useState<unknown>(null);
  if (!canSee || !data) return null;
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (e) { setErr(e); } };
  return (
    <Card title={t("fad.assignments")} testId="course-assignments">
      <ErrorBox error={err} />
      {!data.items.length && <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p>}
      <ul className="space-y-3">{data.items.map((a) => (
        <li key={a.id} className="rounded-lg border border-[var(--line)] p-3 text-sm" data-assignment={a.title}>
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{a.title}</strong><span className="flex gap-1"><Pill>{t(`fad.kind.${a.kind}` as MsgKey)}</Pill>{a.due_at && <Pill tone="info">{t("fad.due")} {new Date(a.due_at).toLocaleString()}</Pill>}<Pill>/{a.max_points}</Pill></span></div>
          <p className="mt-1 whitespace-pre-wrap text-[var(--fg-2)]">{a.instructions}</p>
          {!data.author && (a.grade != null
            ? <p className="mt-2" data-testid="my-grade"><Pill tone="ok">{t("fad.grade")} : {a.grade} / {a.max_points}</Pill> {a.feedback}</p>
            : <div className="mt-2 space-y-2">
              {a.submitted_at && <p className="text-xs"><Pill tone="info">{t("fad.submitted")} {new Date(a.submitted_at).toLocaleString()}</Pill>{a.late ? <Pill tone="warn">{t("fad.late")}</Pill> : null}</p>}
              <Textarea name={`answer-${a.id}`} rows={3} placeholder={t("fad.answer")} value={answer[a.id] ?? ""} onChange={(e) => setAnswer({ ...answer, [a.id]: e.target.value })} />
              <input type="file" name={`file-${a.id}`} onChange={(e) => setFile({ ...file, [a.id]: e.target.files?.[0] ?? null })} className="text-sm" />
              <Btn data-testid="submit-assignment" onClick={() => run(async () => { const fd = new FormData(); if (answer[a.id]) fd.append("text", answer[a.id]); if (file[a.id]) fd.append("file", file[a.id]!); const r = await fetch(`/api/fad/assignments/${a.id}`, { method: "POST", body: fd }); const j = await r.json(); if (!r.ok) throw new RequestError(r.status, j.error, j.key); })}>{a.submitted_at ? t("fad.resubmit") : t("fad.submit")}</Btn>
            </div>)}
          {data.author && (<div className="mt-2">
            <Btn kind="ghost" onClick={() => run(async () => setSubs({ ...subs, [a.id]: (await api<{ items: Sub[] }>(`/api/fad/assignments/${a.id}`)).items }))} data-testid="view-submissions">{t("fad.viewSubs", { n: a.submissions, p: a.to_grade })}</Btn>
            {subs[a.id]?.map((s) => { const gv = g[s.id] ?? { grade: s.grade == null ? "" : String(s.grade), feedback: s.feedback ?? "" }; return (
              <div key={s.id} className="mt-2 rounded bg-[var(--bg-2)] p-2 text-xs" data-submission={s.display_name}>
                <p><strong>{s.display_name}</strong> · {new Date(s.submitted_at).toLocaleString()}{s.late ? ` · ${t("fad.late")}` : ""}</p>
                {s.text && <p className="mt-1 whitespace-pre-wrap">{s.text}</p>}
                {s.file_name && <a className="underline" href={`/api/fad/submissions/${s.id}`}>📎 {s.file_name}</a>}
                <div className="mt-1 flex flex-wrap items-end gap-2"><Input aria-label={t("fad.grade")} name="grade" value={gv.grade} onChange={(e) => setG({ ...g, [s.id]: { ...gv, grade: e.target.value } })} className="!w-20" /><Input aria-label={t("fad.feedback")} placeholder={t("fad.feedback")} value={gv.feedback} onChange={(e) => setG({ ...g, [s.id]: { ...gv, feedback: e.target.value } })} className="!w-64" />
                  <Btn kind="ok" data-testid="grade-btn" onClick={() => run(async () => { await post(`/api/fad/submissions/${s.id}`, { grade: Number(gv.grade.replace(",", ".")), feedback: gv.feedback || null }); setSubs({ ...subs, [a.id]: (await api<{ items: Sub[] }>(`/api/fad/assignments/${a.id}`)).items }); })}>{t("fad.saveGrade")}</Btn></div>
              </div>); })}
          </div>)}
        </li>))}</ul>
      {data.author && (
        <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="assignment-new">
          <Field label={t("fad.kindLabel")}><Select name="assignment-kind" value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })}>{["devoir", "td", "tp", "examen"].map((k) => <option key={k} value={k}>{t(`fad.kind.${k}` as MsgKey)}</option>)}</Select></Field>
          <Field label={t("c.title")}><Input name="assignment-title" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} /></Field>
          <div className="md:col-span-2"><Field label={t("fad.instructions")}><Textarea name="assignment-instructions" rows={3} value={n.instructions} onChange={(e) => setN({ ...n, instructions: e.target.value })} /></Field></div>
          <Field label={t("fad.due")}><Input type="datetime-local" value={n.due} onChange={(e) => setN({ ...n, due: e.target.value })} /></Field>
          <Field label={t("fad.maxPoints")}><Input value={n.max} onChange={(e) => setN({ ...n, max: e.target.value })} /></Field>
          <Btn data-testid="assignment-create" onClick={() => run(async () => { await post(`/api/courses/${courseId}/assignments`, { kind: n.kind, title: n.title, instructions: n.instructions, due_at: n.due ? new Date(n.due).toISOString() : null, max_points: Number(n.max) || 20 }); setN({ kind: "devoir", title: "", instructions: "", due: "", max: "20" }); })}>{t("fad.create")}</Btn>
        </div>)}
    </Card>
  );
}
