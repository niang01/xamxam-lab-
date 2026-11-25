"use client";
/** FAD — Mon parcours : cours suivis et progression, devoirs à rendre, notes, certificats, corrections à faire. */
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Card, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import type { MsgKey } from "@/lib/i18n/messages";

type D = {
  courses: { id: string; title: string; domain: string; level: string; lessons: number; done: number; best_score: number | null; pass_mark: number; certificate_id: string | null }[];
  todo: { id: string; title: string; kind: string; due_at: string | null; course_id: string; course: string }[];
  grades: { title: string; kind: string; max_points: number; grade: number | null; feedback: string | null; course: string }[];
  toGrade: { id: string; title: string; course_id: string; course: string; pending: number }[];
  exercises: { tries: number; correct: number };
};

export default function Fad() {
  const { t } = useApp();
  const { data } = useData<D>("/api/fad/me");
  return (
    <Page title={t("nav.fad")} subtitle={t("fad.subtitle")}>
      <div className="flex flex-wrap gap-2 text-sm"><Link className="rounded-lg border border-[var(--line)] px-3 py-1.5" href="/academy">{t("fad.catalog")}</Link><Link className="rounded-lg border border-[var(--line)] px-3 py-1.5" href="/exercices">{t("nav.exercises")}</Link><Link className="rounded-lg border border-[var(--line)] px-3 py-1.5" href="/collab">{t("fad.virtualClass")}</Link></div>
      <Card title={t("fad.myCourses")} testId="fad-courses">
        {!data?.courses.length ? <p className="text-sm text-[var(--fg-3)]">{t("fad.noCourse")} <Link className="underline" href="/academy">{t("fad.catalog")}</Link></p> : (
          <ul className="space-y-2 text-sm">{data.courses.map((c) => { const pct = c.lessons ? Math.round((100 * c.done) / c.lessons) : 0; return (
            <li key={c.id}><Link className="font-medium text-[var(--cyan)] hover:underline" href={`/academy/${c.id}`}>{c.title}</Link> <span className="text-xs text-[var(--fg-3)]">{c.domain}</span>
              <div className="mt-1 h-2 w-full rounded-full bg-[var(--bg-2)]" aria-label={`${pct} %`}><div className="h-2 rounded-full bg-[var(--ok)]" style={{ width: `${pct}%` }} /></div>
              <p className="text-xs">{t("fad.progress", { d: c.done, n: c.lessons })}{c.best_score != null ? ` · ${t("fad.quizBest", { s: c.best_score })}` : ""}{c.certificate_id ? <> · <Link className="underline" href={`/p/certificat/${c.certificate_id}`}>🎓 {t("acad.viewCert")}</Link></> : null}</p></li>); })}</ul>)}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("fad.todo")} testId="fad-todo">{!data?.todo.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <ul className="space-y-1 text-sm">{data.todo.map((a) => <li key={a.id}><Link className="underline" href={`/academy/${a.course_id}`}>{a.title}</Link> <Pill>{t(`fad.kind.${a.kind}` as MsgKey)}</Pill> <span className="text-xs text-[var(--fg-3)]">{a.course}{a.due_at ? ` · ${new Date(a.due_at).toLocaleDateString()}` : ""}</span></li>)}</ul>}</Card>
        <Card title={t("fad.results")} testId="fad-grades">{!data?.grades.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <ul className="space-y-1 text-sm">{data.grades.map((x, i) => <li key={i}>{x.title} <span className="text-xs text-[var(--fg-3)]">({x.course})</span> — {x.grade == null ? t("fad.pending") : `${x.grade} / ${x.max_points}`}</li>)}</ul>}
          {data && <p className="mt-2 text-xs">{t("fad.exStats", { c: data.exercises.correct, n: data.exercises.tries })}</p>}</Card>
      </div>
      {!!data?.toGrade.length && <Card title={t("fad.toGrade")}><ul className="text-sm">{data.toGrade.map((a) => <li key={a.id}><Link className="underline" href={`/academy/${a.course_id}`}>{a.title}</Link> — {a.course} · {a.pending}</li>)}</ul></Card>}
    </Page>
  );
}
