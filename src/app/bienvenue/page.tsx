"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Select, Textarea } from "@/components/ui";
import { patch } from "@/lib/client/api";
import { SELF_SERVICE_PROFILES } from "@/lib/profiles";
import type { MsgKey } from "@/lib/i18n/messages";

/** Configuration du profil après l'inscription (modifiable ensuite dans Paramètres). */
export default function Welcome() {
  const { t, me, refreshMe } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ display_name: "", full_name: "", profile_kind: "student", organization: "", job_title: "", specialty: "", country: "", skills: "", bio: "", professional_summary: "", public_profile: false });
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- préremplissage avec le compte chargé
    setF((x) => ({ ...x, display_name: me.display_name, full_name: me.full_name ?? "", specialty: me.specialty ?? "", professional_summary: me.professional_summary ?? "", profile_kind: me.profile_kind, organization: me.organization ?? "", job_title: me.job_title ?? "", country: me.country ?? "", bio: me.bio ?? "", skills: me.skills.join(", "), public_profile: me.public_profile }));
  }, [me]);
  if (!me) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await patch("/api/me", {
        display_name: f.display_name, full_name: f.full_name.trim() || null, specialty: f.specialty.trim() || null, professional_summary: f.professional_summary.trim() || null, organization: f.organization || null, job_title: f.job_title || null, country: f.country || null, bio: f.bio || null,
        skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50), public_profile: f.public_profile,
        ...(me!.is_admin ? {} : { profile_kind: f.profile_kind }), onboarded: true,
      });
      await refreshMe(); router.replace("/guide/premiers-pas");
    } catch (x) { setErr(x); } finally { setBusy(false); }
  }
  return (
    <Page title={t("onb.title")} subtitle={t("onb.subtitle")}>
      <Card testId="onboarding">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <Field label={t("auth.displayName")}><Input name="display_name" required minLength={2} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
          <Field label={t("auth.profile")}>
            {me.is_admin ? <Input value={t("profile.administrator")} disabled /> : (
              <Select name="profile_kind" value={f.profile_kind} onChange={(e) => setF({ ...f, profile_kind: e.target.value })}>
                {SELF_SERVICE_PROFILES.map((p) => <option key={p} value={p}>{t(`profile.${p}` as MsgKey)}</option>)}
              </Select>)}
          </Field>
          <Field label={t("prof.fullName")}><Input name="full_name" autoComplete="name" maxLength={120} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label={t("prof.specialty")}><Input name="specialty" maxLength={120} value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></Field>
          <Field label={t("onb.organization")}><Input name="organization" value={f.organization} onChange={(e) => setF({ ...f, organization: e.target.value })} /></Field>
          <Field label={t("onb.jobTitle")}><Input name="job_title" value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} /></Field>
          <Field label={t("onb.country")}><Input name="country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
          <Field label={t("onb.skills")} hint={t("onb.skillsHint")}><Input name="skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></Field>
          <div className="md:col-span-2"><Field label={t("prof.aboutMe")} hint={t("prof.aboutMeHint")}><Textarea name="bio" rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field></div>
          <div className="md:col-span-2"><Field label={t("prof.summary")} hint={t("prof.summaryHint")}><Textarea name="professional_summary" rows={3} maxLength={3000} value={f.professional_summary} onChange={(e) => setF({ ...f, professional_summary: e.target.value })} /></Field></div>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={f.public_profile} onChange={(e) => setF({ ...f, public_profile: e.target.checked })} />{t("onb.public")}</label>
          <div className="md:col-span-2"><ErrorBox error={err} /></div>
          <Btn type="submit" disabled={busy} className="md:col-span-2" data-testid="onboarding-save">{t("onb.save")}</Btn>
        </form>
      </Card>
    </Page>
  );
}
