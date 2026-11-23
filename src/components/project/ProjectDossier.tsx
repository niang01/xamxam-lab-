"use client";
/** Dossier du projet : toutes les sections, éditables par les éditeurs ; exports rapport et présentation. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Select, Textarea } from "@/components/ui";
import { patch } from "@/lib/client/api";
import { LEVELS } from "@/lib/project-templates";
import type { MsgKey } from "@/lib/i18n/messages";

export const SECTIONS = ["description", "problem", "objectives", "specs", "methodology", "architecture", "programming", "tests", "results", "conclusion"] as const;
type Sec = (typeof SECTIONS)[number];
export type Dossier = Record<Sec, string | null> & { level: string | null };

export function ProjectDossier({ id, project, canEdit, onSaved }: { id: string; project: Dossier; canEdit: boolean; onSaved: () => void }) {
  const { t } = useApp();
  const [edit, setEdit] = useState<Dossier | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const label = (k: Sec): string => t(k === "description" ? "c.description" : (`proj.${k}` as MsgKey));
  const filled = SECTIONS.filter((k) => (project[k] ?? "").trim()).length;
  return (
    <Card title={t("proj.dossier")} testId="project-dossier" actions={<span className="flex flex-wrap gap-2">
      <a className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm" href={`/api/projects/${id}/export?format=md`} data-testid="export-report">{t("proj.exportReport")}</a>
      <a className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm" href={`/api/projects/${id}/export?format=slides`} data-testid="export-slides">{t("proj.exportSlides")}</a>
      {canEdit && !edit && <Btn kind="ghost" onClick={() => setEdit({ ...project })} data-testid="dossier-edit">{t("c.edit")}</Btn>}
    </span>}>
      <p className="mb-3 text-xs text-[var(--fg-3)]">{t("proj.dossierInfo", { n: filled, total: SECTIONS.length })}</p>
      <ErrorBox error={err} />
      {edit ? (
        <div className="grid gap-3">
          <Field label={t("proj.level")}><Select name="level" value={edit.level ?? ""} onChange={(e) => setEdit({ ...edit, level: e.target.value || null })}><option value="">—</option>{LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</Select></Field>
          {SECTIONS.map((k) => <Field key={k} label={label(k)}><Textarea name={k} rows={k === "description" ? 3 : 5} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>)}
          <div className="flex gap-2">
            <Btn data-testid="dossier-save" onClick={async () => { setErr(null); try { await patch(`/api/projects/${id}`, Object.fromEntries([...SECTIONS.map((k) => [k, (edit[k] ?? "").trim() || null]), ["level", edit.level]])); setEdit(null); onSaved(); } catch (e) { setErr(e); } }}>{t("c.save")}</Btn>
            <Btn kind="ghost" onClick={() => setEdit(null)}>{t("c.cancel")}</Btn>
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          {project.level && <div><dt className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t("proj.level")}</dt><dd>{LEVELS.find((l) => l.key === project.level)?.label}</dd></div>}
          {SECTIONS.map((k) => <div key={k}><dt className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{label(k)}</dt><dd className="whitespace-pre-wrap">{project[k] || <span className="text-[var(--fg-3)]">{t("proj.toComplete")}</span>}</dd></div>)}
        </dl>
      )}
    </Card>
  );
}
