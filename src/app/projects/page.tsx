"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type P = { id: string; title: string; kind: string; visibility: string; role: string; owner_name: string; updated_at: string };
const KINDS = ["engineering", "thesis", "research", "startup", "course"];

export default function Projects() {
  const t = useT();
  const { data } = useData<{ items: P[] }>("/api/projects");
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", description: "", objectives: "", problem: "", kind: "engineering" });
  const [err, setErr] = useState<unknown>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (new URLSearchParams(window.location.search).get("nouveau")) setShow(true); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try { const r = await post<{ id: string }>("/api/projects", { ...f, description: f.description || null, objectives: f.objectives || null, problem: f.problem || null }); router.push(`/projects/${r.id}`); }
    catch (x) { setErr(x); }
  }
  return (
    <Page title={t("nav.projects")} subtitle={t("proj.subtitle")} actions={<Btn onClick={() => setShow((s) => !s)} data-testid="new-project">{t("dash.newProject")}</Btn>}>
      {show && (
        <Card title={t("dash.newProject")}>
          <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
            <Field label={t("c.title")}><Input name="title" required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label={t("proj.kind")}><Select name="kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{t(`proj.kind.${k}` as MsgKey)}</option>)}</Select></Field>
            <Field label={t("c.description")}><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label={t("proj.problem")}><Textarea rows={3} value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} /></Field>
            <Field label={t("proj.objectives")}><Textarea rows={3} value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} /></Field>
            <div className="flex items-end gap-2"><p className="text-xs text-[var(--fg-3)]">{t("auth.privacy")}</p><Btn type="submit">{t("c.create")}</Btn></div>
            <div className="md:col-span-2"><ErrorBox error={err} /></div>
          </form>
        </Card>
      )}
      <Card>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)]">
            {data.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/projects/${p.id}`} className="font-medium text-[var(--cyan)] hover:underline">{p.title}</Link>
                <span className="flex gap-2 text-xs"><Pill>{t(`proj.kind.${p.kind}` as MsgKey)}</Pill><Pill tone={p.visibility === "private" ? "neutral" : "info"}>{t(p.visibility === "private" ? "c.private" : "c.public")}</Pill><Pill>{t(`proj.role.${p.role}` as MsgKey)}</Pill></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
