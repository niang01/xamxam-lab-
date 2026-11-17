"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Textarea } from "@/components/ui";
import { patch } from "@/lib/client/api";

export default function Portfolio() {
  const { t, me, refreshMe } = useApp();
  const [f, setF] = useState({ bio: me?.bio ?? "", country: me?.country ?? "", skills: (me?.skills ?? []).join(", ") });
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  if (!me) return null;
  const save = async (extra: Record<string, unknown> = {}) => {
    setErr(null); setOk(false);
    try { await patch("/api/me", { bio: f.bio || null, country: f.country || null, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean), ...extra }); await refreshMe(); setOk(true); } catch (e) { setErr(e); }
  };
  return (
    <Page title={t("nav.portfolio")} subtitle={t("port.subtitle")}>
      <Card title={t("port.visibility")}>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={me.public_profile ? "ok" : "neutral"}>{me.public_profile ? t("c.public") : t("c.private")}</Pill>
          <Btn kind="ghost" data-testid="toggle-public" onClick={() => save({ public_profile: !me.public_profile })}>{me.public_profile ? t("port.makePrivate") : t("port.makePublic")}</Btn>
          {me.public_profile && <Link href={`/p/portfolio/${me.id}`} className="text-sm text-[var(--cyan)] underline">{t("port.view")}</Link>}
        </div>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("port.consent")}</p>
      </Card>
      <Card title={t("port.profile")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("c.country")}><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
          <Field label={t("eco.f.skills")} hint={t("port.skillsHint")}><Input value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></Field>
        </div>
        <Field label={t("eco.f.bio")}><Textarea rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <div className="mt-2 flex items-center gap-2"><Btn onClick={() => save()}>{t("c.save")}</Btn>{ok && <Pill tone="ok">{t("c.saved")}</Pill>}</div>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("port.content")}</p>
        <ErrorBox error={err} />
      </Card>
    </Page>
  );
}
