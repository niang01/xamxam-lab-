"use client";
/** Banque d'exercices corrigés : entraînement par modèle et par variante, épreuves d'entraînement notées. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, post } from "@/lib/client/api";
import { FILIERES } from "@/lib/library";

type Tpl = { key: string; title: string; filiere: string; level: string; method: string };
type Q = { id: string; template: string; title: string; statement: string; question: string; unit: string; label: string; method: string };
type Res = { correct: boolean; deviationPct: number | null; expected: { value: number; unit: string; label: string }; steps: string[] };
const fl = (k: string) => FILIERES.find((f) => f.key === k)?.label ?? k;
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".").replace(/\s/g, "")));

export default function Exercises() {
  const { t } = useApp();
  const { data, reload } = useData<{ templates: Tpl[]; progress: { template: string; tries: number; correct: number }[] }>("/api/exercises");
  const [fil, setFil] = useState("");
  const [cur, setCur] = useState<{ q: Q; variant: number } | null>(null);
  const [ans, setAns] = useState(""); const [res, setRes] = useState<Res | null>(null); const [err, setErr] = useState<unknown>(null);
  const [exam, setExam] = useState<{ seed: number; n: number; filiere: string | null; questions: Q[] } | null>(null);
  const [examAns, setExamAns] = useState<string[]>([]); const [examRes, setExamRes] = useState<{ score: number; results: (Res & { id: string })[] } | null>(null);
  const open = async (key: string, variant = 1 + Math.floor(Math.random() * 1000)) => { setErr(null); setRes(null); setAns(""); try { setCur({ q: await api<Q>(`/api/exercises?template=${key}&variant=${variant}`), variant }); window.scrollTo({ top: 0 }); } catch (e) { setErr(e); } };
  const prog = (k: string) => data?.progress.find((p) => p.template === k);
  const tpls = (data?.templates ?? []).filter((x) => !fil || x.filiere === fil);
  return (
    <Page title={t("nav.exercises")} subtitle={t("ex.subtitle", { n: data?.templates.length ?? 0 })}>
      <ErrorBox error={err} />
      {cur && (
        <Card title={`${cur.q.title} — ${t("ex.variant")} ${cur.variant}`} testId="ex-current">
          <p className="text-sm">{cur.q.statement}</p>
          <p className="mt-2 text-sm font-semibold">{cur.q.question}</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={`${cur.q.label}${cur.q.unit ? ` (${cur.q.unit})` : ""}`}><Input name="ex-answer" inputMode="decimal" value={ans} onChange={(e) => setAns(e.target.value)} className="!w-40" /></Field>
            <Btn disabled={num(ans) == null} data-testid="ex-check" onClick={async () => { try { setRes(await post<Res>("/api/exercises", { template: cur.q.template, variant: cur.variant, answer: num(ans) })); reload(); } catch (e) { setErr(e); } }}>{t("ex.check")}</Btn>
            <Btn kind="ghost" onClick={() => open(cur.q.template)}>{t("ex.another")}</Btn>
          </div>
          {res && (<div className="mt-3 rounded-lg bg-[var(--bg-2)] p-3 text-sm" data-testid="ex-result">
            <Pill tone={res.correct ? "ok" : "danger"}>{res.correct ? t("ex.correct") : t("ex.incorrect")}</Pill>{res.deviationPct != null && <span className="ml-2 text-xs">{t("ex.deviation", { d: res.deviationPct })}</span>}
            <p className="mt-2 font-semibold">{t("ex.solution")} : {res.expected.label} = {res.expected.value} {res.expected.unit}</p>
            <ol className="mt-1 list-decimal pl-5 text-xs">{res.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="mt-1 text-xs text-[var(--fg-3)]">{t("ex.method")} : {cur.q.method}</p>
          </div>)}
        </Card>
      )}
      <Card title={t("ex.exam")} testId="ex-exam">
        {!exam ? (<div className="flex flex-wrap items-end gap-2">
          <Btn data-testid="exam-start" onClick={async () => { setExamRes(null); try { const e = await api<{ seed: number; n: number; filiere: string | null; questions: Q[] }>(`/api/exercises/exam?n=5${fil ? `&filiere=${fil}` : ""}`); setExam(e); setExamAns(e.questions.map(() => "")); } catch (x) { setErr(x); } }}>{t("ex.startExam")}</Btn>
          <span className="text-xs text-[var(--fg-3)]">{t("ex.examInfo")}</span></div>) : (
          <div className="space-y-3">{exam.questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-[var(--line)] p-2 text-sm"><p><strong>{i + 1}.</strong> {q.statement} <strong>{q.question}</strong></p>
              <div className="mt-1 flex items-center gap-2"><Input name={`exam-${i}`} inputMode="decimal" value={examAns[i] ?? ""} onChange={(e) => setExamAns(examAns.map((x, k) => (k === i ? e.target.value : x)))} className="!w-40" /><span className="text-xs">{q.unit}</span>
                {examRes && <Pill tone={examRes.results[i].correct ? "ok" : "danger"}>{examRes.results[i].correct ? "✓" : `✗ ${examRes.results[i].expected.value} ${examRes.results[i].expected.unit}`}</Pill>}</div></div>))}
            {!examRes ? <Btn data-testid="exam-submit" onClick={async () => { try { setExamRes(await post("/api/exercises/exam", { seed: exam.seed, n: exam.n, filiere: exam.filiere, answers: examAns.map(num) })); reload(); } catch (x) { setErr(x); } }}>{t("ex.submitExam")}</Btn>
              : <p className="text-lg font-semibold" data-testid="exam-score">{t("ex.score", { s: examRes.score })}</p>}
            <Btn kind="ghost" onClick={() => setExam(null)}>{t("c.close")}</Btn>
          </div>)}
      </Card>
      <Card title={t("ex.bank")}>
        <Select name="ex-filiere" aria-label={t("comp.filiere")} value={fil} onChange={(e) => setFil(e.target.value)} className="mb-3 !w-auto"><option value="">{t("comp.allFilieres")}</option>{FILIERES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</Select>
        <ul className="divide-y divide-[var(--line)] text-sm">{tpls.map((x) => { const p = prog(x.key); return (
          <li key={x.key} className="flex flex-wrap items-center justify-between gap-2 py-2"><button className="text-left text-[var(--cyan)] hover:underline" onClick={() => open(x.key)} data-template={x.key}>{x.title}</button>
            <span className="flex flex-wrap gap-1 text-xs"><Pill>{fl(x.filiere)}</Pill><Pill tone="info">{t(`ex.level.${x.level}` as "ex.level.debutant")}</Pill>{p && <Pill tone="ok">{p.correct}/{p.tries}</Pill>}</span></li>); })}</ul>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("ex.rights")}</p>
      </Card>
    </Page>
  );
}
