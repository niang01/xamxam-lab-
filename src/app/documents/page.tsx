"use client";
/** Dépôt et traitement de documents par Aláji IA : extraction, exercices, calculs vérifiés, corrections, exports. */
import Link from "next/link";
import { useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Page, Pill, Textarea } from "@/components/ui";
import { ProjectPicker } from "@/components/ProjectPicker";
import { useData } from "@/lib/client/hooks";
import { api, del, patch, RequestError } from "@/lib/client/api";
import type { DocReport } from "@/server/docs/process";

type Item = { id: string; filename: string; kind: string; size_bytes: number; pages: number | null; ocr: boolean; exercises: number; created_at: string };
type Detail = Item & { extracted_text: string; tables: string[][][]; report: DocReport; markdown: string };

function Md({ text }: { text: string }) {
  return <div className="space-y-1 text-sm leading-relaxed" data-testid="doc-report">{text.split("\n").map((l, i) => {
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) return h[1].length === 1 ? <h2 key={i} className="pt-2 text-lg font-semibold">{h[2]}</h2> : h[1].length === 2 ? <h3 key={i} className="pt-3 font-semibold text-[var(--cyan)]">{h[2]}</h3> : <h4 key={i} className="pt-1 text-xs uppercase tracking-wide text-[var(--fg-3)]">{h[2]}</h4>;
    return <p key={i} className={`${/^\s*-/.test(l) ? "pl-3" : ""} ${/⚠|incorrect|manquant/i.test(l) ? "text-[var(--warn)]" : /✓| correct/.test(l) ? "text-[var(--ok)]" : ""} whitespace-pre-wrap break-words`}>{l.replace(/^\s*-\s+/, "• ")}</p>;
  })}</div>;
}

export default function Documents() {
  const { t } = useApp();
  const { data, reload } = useData<{ items: Item[]; formats: string[]; max_mb: number }>("/api/documents");
  const [file, setFile] = useState<File | null>(null);
  const [instr, setInstr] = useState(""); const [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = async (id: string) => { setErr(null); try { setOpen(await api<Detail>(`/api/documents/${id}`)); setEdit(null); } catch (e) { setErr(e); } };
  async function upload() {
    if (!file) return;
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.append("file", file); if (instr) fd.append("instructions", instr); if (pid) fd.append("project_id", pid);
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new RequestError(r.status, j.error, j.key);
      setFile(null); if (input.current) input.current.value = ""; reload(); await load(j.id);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }
  const sumUp = open ? { ex: open.report.exercises.length, calc: open.report.exercises.filter((e) => e.result).length, answers: open.report.exercises.flatMap((e) => e.answers) } : null;
  return (
    <Page title={t("nav.documents")} subtitle={t("doc.subtitle")}>
      <Card title={t("doc.upload")} testId="doc-upload">
        <p className="mb-2 text-xs text-[var(--fg-3)]">{t("doc.formats", { list: (data?.formats ?? []).join(", "), mb: data?.max_mb ?? 15 })}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("doc.file")}><input ref={input} type="file" name="document" accept={(data?.formats ?? []).map((f) => `.${f}`).join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" /></Field>
          <ProjectPicker value={pid} onChange={setPid} />
          <div className="md:col-span-2"><Field label={t("doc.instructions")} hint={t("doc.instructionsHint")}><Textarea rows={2} value={instr} onChange={(e) => setInstr(e.target.value)} /></Field></div>
        </div>
        <Btn className="mt-2" disabled={!file || busy} onClick={upload} data-testid="doc-send">{busy ? t("doc.processing") : t("doc.analyse")}</Btn>
        <ErrorBox error={err} />
      </Card>
      {open && sumUp && (
        <Card title={open.filename} testId="doc-detail" actions={<span className="flex flex-wrap gap-2">{(["pdf", "docx", "xlsx", "md"] as const).map((f) => <a key={f} href={`/api/documents/${open.id}/export?format=${f}`} data-testid={`doc-export-${f}`} className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs uppercase">{f}</a>)}</span>}>
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <Pill>{open.kind.toUpperCase()}</Pill>{open.pages ? <Pill>{t("doc.pages", { n: open.pages })}</Pill> : null}{open.ocr && <Pill tone="warn">OCR</Pill>}
            <Pill tone="info">{t("doc.summary", { ex: sumUp.ex, calc: sumUp.calc })}</Pill>
            {sumUp.answers.length > 0 && <Pill tone={sumUp.answers.every((a) => a.verdict === "correct") ? "ok" : "warn"}>{t("doc.answers", { ok: sumUp.answers.filter((a) => a.verdict === "correct").length, n: sumUp.answers.length })}</Pill>}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link className="rounded-lg bg-[var(--tech)] px-3 py-1.5 text-sm text-white" href={`/ai?q=${encodeURIComponent(`${open.report.exercises[0]?.questions[0]?.text ?? ""}\n${open.extracted_text.slice(0, 1200)}`)}`}>{t("doc.askAi")}</Link>
            <Link className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm" href="/schemas?generer=1">{t("doc.schema")}</Link>
            <Btn kind="ghost" onClick={() => setEdit(edit === null ? open.extracted_text : null)} data-testid="doc-edit-text">{t("doc.correctText")}</Btn>
            <Btn kind="danger" onClick={async () => { if (!confirm(t("doc.deleteConfirm"))) return; await del(`/api/documents/${open.id}`); setOpen(null); reload(); }}>{t("c.delete")}</Btn>
          </div>
          {edit !== null && <div className="mb-3"><Textarea name="doc-text" rows={10} value={edit} onChange={(e) => setEdit(e.target.value)} className="font-mono text-xs" /><Btn className="mt-2" data-testid="doc-reanalyse" onClick={async () => { try { await patch(`/api/documents/${open.id}`, { text: edit }); await load(open.id); } catch (e) { setErr(e); } }}>{t("doc.reanalyse")}</Btn></div>}
          <Md text={open.markdown} />
          {open.tables.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer">{t("doc.tables", { n: open.tables.length })}</summary>{open.tables.slice(0, 5).map((tb, i) => <div key={i} className="mt-2 overflow-x-auto"><table className="text-xs">{tb.slice(0, 30).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="border border-[var(--line)] px-1">{c}</td>)}</tr>)}</table></div>)}</details>}
          <details className="mt-3 text-xs"><summary className="cursor-pointer">{t("doc.rawText")}</summary><pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap">{open.extracted_text.slice(0, 20000)}</pre></details>
        </Card>
      )}
      <Card title={t("doc.mine")}>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)] text-sm">{data.items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><button className="text-left text-[var(--cyan)] hover:underline" onClick={() => load(d.id)}>{d.filename}</button>
              <span className="text-xs text-[var(--fg-3)]">{d.kind} · {(d.size_bytes / 1024).toFixed(0)} Ko · {d.exercises} {t("doc.blocks")} · {new Date(d.created_at).toLocaleString()}</span></li>))}</ul>
        )}
      </Card>
      <Card title={t("doc.limitsTitle")}><ul className="list-disc space-y-1 pl-5 text-xs text-[var(--fg-2)]"><li>{t("doc.limit1")}</li><li>{t("doc.limit2")}</li><li>{t("doc.limit3")}</li></ul></Card>
    </Page>
  );
}
