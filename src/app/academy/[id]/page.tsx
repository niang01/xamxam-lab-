"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Page, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";
import { CourseResources } from "@/components/fad/CourseResources";
import { CourseAssignments } from "@/components/fad/CourseAssignments";

type Course = {
  id: string; title: string; summary: string | null; lang: string; lessons: { title: string; body: string; module?: string | null }[]; quiz: { q: string; choices: string[]; answer?: number }[]; pass_mark: number; lab_link: string | null;
  is_author: boolean; enrollment: { lessons_done: number[]; best_score: number | null; attempts: number } | null; certificate: { id: string; score: number } | null;
};
type Result = { score: number; pass_mark: number; passed: boolean; correct: boolean[]; certificate: { id: string } | null };

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data: c, reload } = useData<Course>(`/api/courses/${id}`);
  const { data: results } = useData<{ items: { display_name: string; lessons_done: number[]; best_score: number | null; attempts: number }[] }>(c?.is_author ? `/api/courses/${id}/results` : null);
  const [open, setOpen] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<unknown>(null);
  if (!c) return <Page title={t("nav.academy")}><p className="text-sm">{t("c.loading")}</p></Page>;
  const done = new Set(c.enrollment?.lessons_done ?? []);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (e) { setErr(e); } };
  return (
    <Page title={c.title} subtitle={c.summary ?? undefined} actions={<Link href={`/ai?q=${encodeURIComponent(`${t("acad.tutorPrompt")} « ${c.title} »`)}`} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">{t("acad.tutor")}</Link>}>
      {!c.enrollment && !c.is_author && <Btn onClick={() => run(() => post(`/api/courses/${id}/enroll`, {}))} data-testid="enroll">{t("acad.enroll")}</Btn>}
      {c.certificate && <Card><p className="text-sm">🎓 {t("acad.certified", { s: c.certificate.score })} <Link className="text-[var(--cyan)] underline" href={`/p/certificat/${c.certificate.id}`}>{t("acad.viewCert")}</Link></p></Card>}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card title={t("acad.lessons")}>
          <ol className="space-y-1 text-sm">{c.lessons.map((l, i) => <li key={i}>{l.module && l.module !== c.lessons[i - 1]?.module && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]">{l.module}</p>}<button className={`w-full rounded px-2 py-1 text-left ${open === i ? "bg-[var(--panel-2)]" : ""}`} onClick={() => setOpen(i)}>{done.has(i) ? "✓ " : ""}{i + 1}. {l.title}</button></li>)}</ol>
        </Card>
        <Card title={c.lessons[open]?.title}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{c.lessons[open]?.body}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.enrollment && !done.has(open) && <Btn kind="ghost" onClick={() => run(() => post(`/api/courses/${id}/lesson`, { index: open }))}>{t("acad.markDone")}</Btn>}
            {c.lab_link && <Link href={c.lab_link} className="rounded-lg bg-[var(--tech)] px-3 py-1.5 text-sm text-white">{t("acad.openLab")}</Link>}
          </div>
        </Card>
      </div>
      {c.quiz.length > 0 && (c.enrollment || c.is_author) && (
        <Card title={`${t("acad.quiz")} (${t("acad.passMark")} ${c.pass_mark} %)`}>
          <ol className="space-y-3 text-sm">{c.quiz.map((x, i) => (
            <li key={i} data-question={i}>
              <div className="font-medium">{i + 1}. {x.q} {res && (res.correct[i] ? <Pill tone="ok">✓</Pill> : <Pill tone="danger">✕</Pill>)}</div>
              <div className="mt-1 space-y-1">{x.choices.map((ch, j) => <label key={j} className="flex items-center gap-2"><input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => { const a = [...answers]; a[i] = j; setAnswers(a); }} />{ch}{c.is_author && x.answer === j && <Pill tone="ok">{t("acad.goodAnswer")}</Pill>}</label>)}</div>
            </li>))}</ol>
          <div className="mt-3 flex items-center gap-3">
            <Btn data-testid="submit-quiz" onClick={() => run(async () => setRes(await post<Result>(`/api/courses/${id}/submit`, { answers: c.quiz.map((_, i) => answers[i] ?? null) })))}>{t("acad.submit")}</Btn>
            {res && <span data-testid="quiz-score" className="text-sm">{t("acad.score", { s: res.score })} {res.passed ? <Pill tone="ok">{t("acad.passed")}</Pill> : <Pill tone="warn">{t("acad.notPassed")}</Pill>}</span>}
          </div>
        </Card>
      )}
      <CourseResources courseId={id} author={c.is_author} canSee={c.is_author || !!c.enrollment} />
      <CourseAssignments courseId={id} canSee={c.is_author || !!c.enrollment} />
      {c.is_author && (
        <Card title={t("acad.results")}>
          {!results?.items.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : <table className="w-full text-left text-sm"><thead className="text-xs text-[var(--fg-3)]"><tr><th>{t("c.name")}</th><th>{t("acad.lessons")}</th><th>{t("acad.best")}</th><th>{t("acad.attempts")}</th></tr></thead><tbody>{results.items.map((r, i) => <tr key={i} className="border-t border-[var(--line)]"><td>{r.display_name}</td><td>{r.lessons_done.length}/{c.lessons.length}</td><td>{r.best_score ?? "—"}</td><td>{r.attempts}</td></tr>)}</tbody></table>}
        </Card>
      )}
      <ErrorBox error={err} />
    </Page>
  );
}
