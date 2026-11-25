"use client";
/** Ressources d'un cours : documents téléchargeables et liens vidéo ; ajout par le formateur. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del, RequestError } from "@/lib/client/api";

type R = { id: string; kind: "video_link" | "file"; title: string; url: string | null; file_name: string | null; size_bytes: number | null; lesson_index: number | null };

export function CourseResources({ courseId, author, canSee }: { courseId: string; author: boolean; canSee: boolean }) {
  const { t } = useApp();
  const { data, reload } = useData<{ items: R[] }>(canSee ? `/api/courses/${courseId}/resources` : null);
  const [f, setF] = useState({ title: "", url: "" }); const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState<unknown>(null);
  if (!canSee) return null;
  async function add() {
    setErr(null);
    const fd = new FormData(); fd.append("title", f.title); if (f.url) fd.append("url", f.url); if (file) fd.append("file", file);
    const r = await fetch(`/api/courses/${courseId}/resources`, { method: "POST", body: fd }); const j = await r.json();
    if (!r.ok) { setErr(new RequestError(r.status, j.error, j.key)); return; }
    setF({ title: "", url: "" }); setFile(null); reload();
  }
  return (
    <Card title={t("fad.resources")} testId="course-resources">
      {!data?.items.length ? <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p> : (
        <ul className="space-y-1 text-sm">{data.items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">{r.kind === "file"
            ? <a className="text-[var(--cyan)] underline" href={`/api/fad/resources/${r.id}`} data-resource={r.title}>📄 {r.title} <span className="text-xs text-[var(--fg-3)]">({r.file_name}, {Math.round((r.size_bytes ?? 0) / 1024)} Ko)</span></a>
            : <a className="text-[var(--cyan)] underline" href={r.url!} target="_blank" rel="noreferrer noopener">▶ {r.title} <span className="text-xs text-[var(--fg-3)]">({t("fad.externalVideo")})</span></a>}
            {author && <button aria-label={t("c.delete")} onClick={async () => { await del(`/api/fad/resources/${r.id}`); reload(); }}>✕</button>}</li>))}</ul>)}
      {author && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Field label={t("c.title")}><Input name="resource-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label={t("fad.file")}><input type="file" name="resource-file" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.txt,.zip,.ino,.py" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" /></Field>
          <Field label={t("fad.videoLink")}><Input name="resource-url" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
          <Btn onClick={add} disabled={f.title.trim().length < 2 || (!file && !f.url)} data-testid="resource-add">{t("c.add")}</Btn>
        </div>)}
      <ErrorBox error={err} />
    </Card>
  );
}
