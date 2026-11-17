"use client";
/** Tableau générique de l'écosystème : liste, recherche, publication, détail, interactions (candidature, dépôt, réservation…). */
import { useState } from "react";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, Pill, Select, Textarea } from "./ui";
import { useData } from "@/lib/client/hooks";
import { patch, post } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

export type EcoField =
  | { k: string; type: "text" | "textarea" | "date" | "url" }
  | { k: string; type: "select"; options: string[] }
  | { k: string; type: "list" }          // une valeur par ligne → tableau
  | { k: string; type: "slots" }         // créneaux (datetime-local, un par ligne)
  | { k: string; type: "bool" }
  | { k: string; type: "langs" };

type Item = { id: string; kind: string; title: string; data: Record<string, unknown>; sponsored: boolean; status: string; owner: string; owner_id: string; interactions: number; mine: { kind: string; status: string }[] | null; created_at: string };
type Detail = { item: Item; links: { id: string; kind: string; data: Record<string, unknown>; status: string; user: string; user_id: string; created_at: string }[]; is_owner: boolean; is_jury: boolean; ranking: { entry_id: string; user: string; scores: number; average: number | null }[] | null };

const NULLABLE = new Set(["funding_need", "website", "sponsor", "source_url", "price"]);

function toData(fields: EcoField[], v: Record<string, string | boolean>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const x = v[f.k];
    if (f.type === "list") out[f.k] = String(x ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    else if (f.type === "slots") out[f.k] = String(x ?? "").split("\n").map((s) => s.trim()).filter(Boolean).map((s) => new Date(s).toISOString());
    else if (f.type === "bool") out[f.k] = !!x;
    else if (f.type === "langs") out[f.k] = String(x ?? "fr").split(/[,\s]+/).filter(Boolean);
    else out[f.k] = NULLABLE.has(f.k) && !x ? null : (x ?? (f.type === "select" ? f.options[0] : ""));
  }
  return out;
}

function DetailView({ id, kind, onChange }: { id: string; kind: string; onChange: () => void }) {
  const { t, me } = useApp();
  const { data, reload } = useData<Detail>(`/api/eco/${id}`);
  const { data: projects } = useData<{ items: { id: string; title: string; role: string }[] }>(kind === "challenge" ? "/api/projects" : null);
  const [txt, setTxt] = useState(""); const [sel, setSel] = useState(""); const [score, setScore] = useState(""); const [jury, setJury] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [contact, setContact] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); onChange(); setTxt(""); } catch (e) { setErr(e); } };
  if (!data) return <p className="text-xs">{t("c.loading")}</p>;
  const it = data.item;
  const mine = data.links.filter((l) => l.user_id === me?.id);
  return (
    <div className="mt-2 space-y-3 rounded-lg bg-[var(--bg-2)] p-3 text-sm" data-testid="eco-detail">
      <dl className="grid gap-2 md:grid-cols-2">{Object.entries(it.data).filter(([k]) => k !== "slots" && k !== "contact_via_platform").map(([k, v]) => v == null || v === "" ? null : (
        <div key={k}><dt className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t(`eco.f.${k}` as MsgKey)}</dt><dd className="whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? t("c.yes") : t("c.no")) : String(v)}</dd></div>))}</dl>
      {it.status === "published" && !data.is_owner && (
        <div className="space-y-2">
          {(kind === "job") && <div className="flex gap-2"><Textarea rows={2} placeholder={t("eco.message")} value={txt} onChange={(e) => setTxt(e.target.value)} /><Btn onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "application", data: { message: txt } }))}>{t("c.apply")}</Btn></div>}
          {(kind === "startup" || kind === "listing") && <div className="flex gap-2"><Textarea rows={2} placeholder={t("eco.message")} value={txt} onChange={(e) => setTxt(e.target.value)} /><Btn onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "connection", data: { message: txt } }))}>{t("eco.connect")}</Btn></div>}
          {kind === "mentor" && <div className="flex flex-wrap gap-2"><Select value={sel} onChange={(e) => setSel(e.target.value)} className="!w-auto"><option value="">{t("eco.slot")}</option>{((it.data.slots as string[]) ?? []).filter((s) => new Date(s) > new Date()).map((s) => <option key={s} value={s}>{new Date(s).toLocaleString()}</option>)}</Select><Input placeholder={t("eco.topic")} value={txt} onChange={(e) => setTxt(e.target.value)} className="!w-64" /><Btn disabled={!sel} onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "booking", data: { slot: sel, topic: txt } }))}>{t("eco.book")}</Btn></div>}
          {kind === "challenge" && <div className="flex flex-wrap gap-2"><Select value={sel} onChange={(e) => setSel(e.target.value)} className="!w-auto"><option value="">{t("eco.chooseProject")}</option>{projects?.items.filter((p) => p.role === "owner").map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select><Btn disabled={!sel} onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "entry", data: { project_id: sel, note: txt } }))}>{t("eco.submitEntry")}</Btn></div>}
          {mine.length > 0 && <p className="text-xs text-[var(--fg-2)]">{t("eco.yourActions")} : {mine.map((l) => `${t(`eco.link.${l.kind}` as MsgKey)} (${l.status})`).join(", ")}</p>}
          <details className="text-xs"><summary className="cursor-pointer text-[var(--fg-3)]">{t("c.report")}</summary><div className="mt-1 flex gap-2"><Input placeholder={t("eco.reason")} value={txt} onChange={(e) => setTxt(e.target.value)} /><Btn kind="ghost" onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "report", data: { reason: txt } }))}>{t("c.send")}</Btn></div></details>
        </div>
      )}
      {kind === "challenge" && data.ranking && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]">{t("eco.ranking")}</div>
          {!data.ranking.length ? <p className="text-xs">{t("c.none")}</p> : <ol className="space-y-1">{data.ranking.map((r, i) => (
            <li key={r.entry_id} className="flex flex-wrap items-center gap-2">{i + 1}. {r.user} — {r.average == null ? t("eco.notScored") : `${r.average.toFixed(2)}/20 (${r.scores} ${t("eco.juryNotes")})`}
              {data.is_jury && <><Input placeholder="/20" value={score} onChange={(e) => setScore(e.target.value)} className="!w-20" /><Btn kind="ghost" onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "score", data: { entry_id: r.entry_id, score: Number(score), comment: txt } }))}>{t("eco.score")}</Btn></>}
            </li>))}</ol>}
          <p className="mt-1 text-xs text-[var(--fg-3)]">{t("eco.humanDecision")}</p>
        </div>
      )}
      {data.is_owner && (
        <div className="space-y-2 border-t border-[var(--line)] pt-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]">{t("eco.received")}</div>
          {!data.links.filter((l) => l.kind !== "jury" && l.kind !== "score").length ? <p className="text-xs">{t("c.none")}</p> : (
            <ul className="space-y-1 text-xs">{data.links.filter((l) => l.kind !== "jury" && l.kind !== "score").map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2"><Pill>{t(`eco.link.${l.kind}` as MsgKey)}</Pill><strong>{l.user}</strong><span className="text-[var(--fg-2)]">{String(l.data.message ?? l.data.topic ?? l.data.reason ?? l.data.note ?? "")}{l.data.slot ? ` · ${new Date(String(l.data.slot)).toLocaleString()}` : ""}</span><Pill tone={l.status === "accepted" ? "ok" : l.status === "declined" ? "danger" : "neutral"}>{l.status}</Pill>
                {l.status === "pending" && ["application", "booking", "connection"].includes(l.kind) && <><Btn kind="ok" onClick={() => act(async () => { const r = await patch<{ contact: string | null }>(`/api/eco-links/${l.id}`, { status: "accepted" }); setContact(r.contact); })}>{t("c.confirm")}</Btn><Btn kind="ghost" onClick={() => act(() => patch(`/api/eco-links/${l.id}`, { status: "declined" }))}>{t("c.refuse")}</Btn></>}
              </li>))}</ul>
          )}
          {contact && <p className="text-xs text-[var(--ok)]">{t("eco.contact")} : {contact}</p>}
          {kind === "challenge" && <div className="flex gap-2"><Input placeholder={t("eco.juryEmail")} value={jury} onChange={(e) => setJury(e.target.value)} className="!w-64" /><Btn kind="ghost" onClick={() => act(() => post(`/api/eco/${id}/links`, { kind: "jury", data: { email: jury, conflict_declared: false } }))}>{t("eco.addJury")}</Btn></div>}
          <div className="flex gap-2">{it.status !== "closed" && <Btn kind="ghost" onClick={() => act(() => patch(`/api/eco/${id}`, { status: "closed" }))}>{t("eco.close")}</Btn>}{it.status !== "published" && <Btn kind="ghost" onClick={() => act(() => patch(`/api/eco/${id}`, { status: "published" }))}>{t("eco.publish")}</Btn>}{me?.is_admin && it.status !== "hidden" && <Btn kind="danger" onClick={() => act(() => patch(`/api/eco/${id}`, { status: "hidden" }))}>{t("eco.hide")}</Btn>}</div>
        </div>
      )}
      <ErrorBox error={err} />
    </div>
  );
}

export function EcoBoard({ kind, fields, capability, extra }: { kind: string; fields: EcoField[]; capability: string; extra?: React.ReactNode }) {
  const { t, me } = useApp();
  const [text, setText] = useState("");
  const { data, reload } = useData<{ items: Item[] }>(`/api/eco?kind=${kind}&q=${encodeURIComponent(text)}`);
  const [open, setOpen] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState(""); const [sponsored, setSponsored] = useState(false);
  const [v, setV] = useState<Record<string, string | boolean>>({});
  const [err, setErr] = useState<unknown>(null);
  const can = me?.capabilities.includes(capability);
  async function create() {
    setErr(null);
    try { await post("/api/eco", { kind, title, data: { ...toData(fields, v), ...(kind === "listing" ? { contact_via_platform: true } : {}) }, sponsored }); setShow(false); setTitle(""); setV({}); reload(); } catch (e) { setErr(e); }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder={t("c.search")} aria-label={t("c.search")} value={text} onChange={(e) => setText(e.target.value)} className="!w-72" />
        {can ? <Btn onClick={() => setShow((s) => !s)} data-testid={`new-${kind}`}>{t(`eco.new.${kind}` as MsgKey)}</Btn> : <span className="text-xs text-[var(--fg-3)]">{t("eco.cannotPublish")}</span>}
        {extra}
      </div>
      {show && (
        <Card title={t(`eco.new.${kind}` as MsgKey)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("c.title")}><Input name="eco-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            {fields.map((f) => {
              const label = t(`eco.f.${f.k}` as MsgKey);
              const val = v[f.k];
              if (f.type === "select") return <Field key={f.k} label={label}><Select name={f.k} value={String(val ?? f.options[0])} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}>{f.options.map((o) => <option key={o} value={o}>{t(`eco.o.${o}` as MsgKey)}</option>)}</Select></Field>;
              if (f.type === "bool") return <label key={f.k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!val} onChange={(e) => setV({ ...v, [f.k]: e.target.checked })} />{label}</label>;
              if (f.type === "textarea" || f.type === "list" || f.type === "slots") return <Field key={f.k} label={label} hint={f.type === "list" ? t("eco.oneLine") : f.type === "slots" ? t("eco.slotsHint") : undefined}><Textarea name={f.k} rows={3} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} /></Field>;
              return <Field key={f.k} label={label} hint={f.type === "langs" ? "wo, fr, en" : undefined}><Input name={f.k} type={f.type === "date" ? "date" : "text"} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} /></Field>;
            })}
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} />{t("eco.sponsoredFlag")}</label>
          <div className="mt-3"><Btn onClick={create} data-testid={`create-${kind}`}>{t("c.create")}</Btn></div>
          <ErrorBox error={err} />
        </Card>
      )}
      <Card>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)]">{data.items.map((i) => (
            <li key={i.id} className="py-2" data-eco={i.title}>
              <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm" onClick={() => setOpen(open === i.id ? null : i.id)}>
                <span><strong>{i.title}</strong> <span className="text-xs text-[var(--fg-3)]">{i.owner} · {new Date(i.created_at).toLocaleDateString()}</span></span>
                <span className="flex flex-wrap gap-1">{i.sponsored && <Pill tone="warn">{t("c.sponsored")}</Pill>}{i.status !== "published" && <Pill tone="danger">{t(`eco.st.${i.status}` as MsgKey)}</Pill>}{["sector", "category", "contract", "stage", "deadline"].map((k) => i.data[k] ? <Pill key={k}>{k === "deadline" ? `≤ ${i.data[k]}` : k === "sector" ? String(i.data[k]) : t(`eco.o.${i.data[k]}` as MsgKey)}</Pill> : null)}{i.interactions > 0 && <Pill tone="info">{i.interactions}</Pill>}</span>
              </button>
              {open === i.id && <DetailView id={i.id} kind={kind} onChange={reload} />}
            </li>))}</ul>
        )}
      </Card>
    </div>
  );
}
