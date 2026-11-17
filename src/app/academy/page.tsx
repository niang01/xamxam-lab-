"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type C = { id: string; title: string; domain: string; level: string; lang: string; summary: string | null; published: boolean; author: string; author_id: string; lessons_n: number; quiz_n: number; best_score: number | null; learners: number };
type Q = { q: string; choices: string; answer: string };

export default function Academy() {
  const { t, me } = useApp();
  const { data } = useData<{ items: C[] }>("/api/courses");
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", domain: "", level: "student", lang: "fr", summary: "", pass_mark: "70", lab_link: "", published: true });
  const [lessons, setLessons] = useState<{ title: string; body: string }[]>([{ title: "", body: "" }]);
  const [quiz, setQuiz] = useState<Q[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const canCreate = me?.capabilities.includes("create_courses");
  async function create() {
    setErr(null);
    try {
      const r = await post<{ id: string }>("/api/courses", { ...f, summary: f.summary || null, lab_link: f.lab_link || null, pass_mark: Number(f.pass_mark), lessons: lessons.filter((l) => l.title), quiz: quiz.filter((x) => x.q).map((x) => ({ q: x.q, choices: x.choices.split("\n").map((c) => c.trim()).filter(Boolean), answer: Number(x.answer) - 1 })) });
      router.push(`/academy/${r.id}`);
    } catch (e) { setErr(e); }
  }
  return (
    <Page title={t("nav.academy")} subtitle={t("acad.subtitle")} actions={canCreate ? <Btn onClick={() => setShow((s) => !s)} data-testid="new-course">{t("acad.new")}</Btn> : null}>
      {show && (
        <Card title={t("acad.new")}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t("c.title")}><Input name="course-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label={t("acad.domain")}><Input name="course-domain" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} /></Field>
            <Field label={t("c.level")}><Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{["pupil", "student", "professional"].map((l) => <option key={l} value={l}>{t(`acad.lvl.${l}` as MsgKey)}</option>)}</Select></Field>
            <Field label={t("c.language")}><Select value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })}>{["wo", "fr", "en"].map((l) => <option key={l} value={l}>{t(`lang.${l}` as MsgKey)}</option>)}</Select></Field>
            <Field label={t("acad.lab")}><Select value={f.lab_link} onChange={(e) => setF({ ...f, lab_link: e.target.value })}><option value="">—</option>{["/lab/electrical", "/lab/electronics", "/lab/solar", "/lab/iot", "/lab/mechanical", "/lab/refrigeration", "/lab/network", "/components", "/studio"].map((l) => <option key={l}>{l}</option>)}</Select></Field>
            <Field label={t("acad.passMark")}><Input value={f.pass_mark} onChange={(e) => setF({ ...f, pass_mark: e.target.value })} /></Field>
          </div>
          <Field label={t("c.description")}><Textarea rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
          <p className="mt-2 text-xs text-[var(--fg-3)]">{t("acad.langNote")}</p>
          <h3 className="mt-3 text-sm font-semibold">{t("acad.lessons")}</h3>
          {lessons.map((l, i) => <div key={i} className="mt-2 space-y-1 rounded-lg border border-[var(--line)] p-2"><Input aria-label={t("c.title")} placeholder={`${t("acad.lesson")} ${i + 1}`} value={l.title} onChange={(e) => setLessons(lessons.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /><Textarea aria-label={t("acad.lessonBody")} rows={4} value={l.body} onChange={(e) => setLessons(lessons.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} /></div>)}
          <Btn kind="ghost" className="mt-1" onClick={() => setLessons([...lessons, { title: "", body: "" }])}>+ {t("acad.lesson")}</Btn>
          <h3 className="mt-3 text-sm font-semibold">{t("acad.quiz")}</h3>
          {quiz.map((x, i) => <div key={i} className="mt-2 grid gap-2 rounded-lg border border-[var(--line)] p-2 md:grid-cols-3"><Input aria-label={t("acad.question")} placeholder={t("acad.question")} value={x.q} onChange={(e) => setQuiz(quiz.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} /><Textarea aria-label={t("acad.choices")} rows={3} placeholder={t("acad.choicesHint")} value={x.choices} onChange={(e) => setQuiz(quiz.map((y, j) => (j === i ? { ...y, choices: e.target.value } : y)))} /><Input aria-label={t("acad.answerN")} placeholder={t("acad.answerN")} value={x.answer} onChange={(e) => setQuiz(quiz.map((y, j) => (j === i ? { ...y, answer: e.target.value } : y)))} /></div>)}
          <Btn kind="ghost" className="mt-1" onClick={() => setQuiz([...quiz, { q: "", choices: "", answer: "1" }])}>+ {t("acad.question")}</Btn>
          <div className="mt-3 flex items-center gap-3"><label className="inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} />{t("acad.publish")}</label><Btn onClick={create} data-testid="create-course">{t("c.create")}</Btn></div>
          <ErrorBox error={err} />
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {!data?.items.length && <p className="text-sm text-[var(--fg-2)]">{t("acad.empty")}</p>}
        {data?.items.map((c) => (
          <Link key={c.id} href={`/academy/${c.id}`}><Card className="h-full hover:border-[var(--cyan)]" title={c.title}>
            <p className="text-sm text-[var(--fg-2)]">{c.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1 text-xs"><Pill>{c.domain}</Pill><Pill>{t(`acad.lvl.${c.level}` as MsgKey)}</Pill><Pill>{c.lang.toUpperCase()}</Pill><Pill>{c.lessons_n} {t("acad.lessonsN")}</Pill>{c.quiz_n > 0 && <Pill>{c.quiz_n} {t("acad.questionsN")}</Pill>}{!c.published && <Pill tone="warn">{t("acad.draft")}</Pill>}{c.best_score != null && <Pill tone="ok">{c.best_score} %</Pill>}</div>
            <p className="mt-2 text-xs text-[var(--fg-3)]">{c.author} · {c.learners} {t("acad.learners")}</p>
          </Card></Link>
        ))}
      </div>
    </Page>
  );
}
