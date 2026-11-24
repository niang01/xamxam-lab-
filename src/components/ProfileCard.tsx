"use client";
/** Profil professionnel : affichage soigné et modification (nom complet, fonction, spécialité, organisation, pays, présentations). */
import { useState } from "react";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, Pill, Textarea } from "./ui";
import { patch } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

const FIELDS = ["display_name", "full_name", "job_title", "specialty", "organization", "country"] as const;
const TEXTS = ["bio", "professional_summary"] as const;
type Form = Record<(typeof FIELDS)[number] | (typeof TEXTS)[number], string>;
const LABEL: Record<keyof Form, MsgKey> = {
  display_name: "auth.displayName", full_name: "prof.fullName", job_title: "prof.jobTitle", specialty: "prof.specialty", organization: "prof.organization",
  country: "prof.country", bio: "prof.aboutMe", professional_summary: "prof.summary",
};

export function ProfileCard() {
  const { t, me, refreshMe } = useApp();
  const [edit, setEdit] = useState<Form | null>(null);
  const [err, setErr] = useState<unknown>(null); const [saved, setSaved] = useState(false);
  if (!me) return null;
  const initials = (me.full_name || me.display_name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const start = () => { setSaved(false); setEdit(Object.fromEntries([...FIELDS, ...TEXTS].map((k) => [k, (me[k] as string | null) ?? ""])) as Form); };
  async function save() {
    if (!edit) return;
    setErr(null);
    try {
      await patch("/api/me", Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, k === "display_name" ? v.trim() : v.trim() || null])));
      await refreshMe(); setEdit(null); setSaved(true);
    } catch (e) { setErr(e); }
  }
  return (
    <Card title={t("prof.title")} testId="profile-card" actions={!edit ? <Btn kind="ghost" onClick={start} data-testid="profile-edit">{t("c.edit")}</Btn> : null}>
      {saved && <p className="mb-2"><Pill tone="ok">{t("c.saved")}</Pill></p>}
      <ErrorBox error={err} />
      {edit ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((k) => <Field key={k} label={t(LABEL[k])}><Input name={`profile-${k}`} required={k === "display_name"} minLength={k === "display_name" ? 2 : undefined} maxLength={k === "display_name" ? 80 : 120} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>)}
          {TEXTS.map((k) => <div key={k} className="sm:col-span-2"><Field label={t(LABEL[k])} hint={k === "bio" ? t("prof.aboutMeHint") : t("prof.summaryHint")}><Textarea name={`profile-${k}`} rows={4} maxLength={k === "bio" ? 2000 : 3000} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field></div>)}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><Btn onClick={save} data-testid="profile-save">{t("c.save")}</Btn><Btn kind="ghost" onClick={() => setEdit(null)}>{t("c.cancel")}</Btn></div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start" data-testid="profile-view">
          <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--tech)_45%,transparent)] font-mono text-xl font-bold text-white">{initials || "?"}</div>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <div>
              <p className="text-lg font-semibold leading-tight">{me.full_name || me.display_name}</p>
              <p className="text-[var(--fg-2)]">{[me.job_title, me.specialty].filter(Boolean).join(" · ") || <span className="text-[var(--fg-3)]">{t("prof.noJob")}</span>}</p>
              <p className="text-xs text-[var(--fg-3)]">{[me.organization, me.country].filter(Boolean).join(" — ")}{(me.organization || me.country) ? " · " : ""}{me.email} · {t(`profile.${me.profile_kind}` as MsgKey)}</p>
            </div>
            <section><h3 className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t("prof.aboutMe")}</h3><p className="whitespace-pre-wrap break-words">{me.bio || <span className="text-[var(--fg-3)]">{t("proj.toComplete")}</span>}</p></section>
            <section><h3 className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t("prof.summary")}</h3><p className="whitespace-pre-wrap break-words">{me.professional_summary || <span className="text-[var(--fg-3)]">{t("proj.toComplete")}</span>}</p></section>
          </div>
        </div>
      )}
    </Card>
  );
}
