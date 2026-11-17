"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { patch, post } from "@/lib/client/api";

type Comp = { id: string; category: string; name: string; symbol_kind: string | null; description: string; function: string | null; manufacturer: string | null; mpn: string | null; datasheet_url: string | null; specs: Record<string, string>; pins: string[]; precautions: string | null; status: string; source: string | null };

export default function Components() {
  const { t, me } = useApp();
  const [text, setText] = useState(""); const [cat, setCat] = useState("");
  const { data, reload } = useData<{ items: Comp[]; categories: { category: string; n: number }[] }>(`/api/components?q=${encodeURIComponent(text)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`);
  const [open, setOpen] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ category: "", name: "", description: "", function: "", manufacturer: "", mpn: "", datasheet_url: "", specs: "", pins: "", precautions: "" });
  const [err, setErr] = useState<unknown>(null);
  async function create() {
    setErr(null);
    try {
      const specs = Object.fromEntries(f.specs.split("\n").map((l) => l.split("=").map((x) => x.trim())).filter((x) => x.length === 2 && x[0] && x[1]));
      await post("/api/components", { ...f, function: f.function || null, precautions: f.precautions || null, specs, pins: f.pins.split(",").map((x) => x.trim()).filter(Boolean) });
      setAdd(false); reload();
    } catch (x) { setErr(x); }
  }
  return (
    <Page title={t("nav.components")} subtitle={t("comp.subtitle")} actions={<Btn onClick={() => setAdd((a) => !a)}>{t("comp.add")}</Btn>}>
      {add && (
        <Card title={t("comp.add")}>
          <p className="mb-2 text-xs text-[var(--fg-3)]">{t("comp.addInfo")}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {(["category", "name", "manufacturer", "mpn", "datasheet_url"] as const).map((k) => <Field key={k} label={t(`comp.f.${k}`)}><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
            <Field label={t("comp.f.pins")} hint={t("comp.f.pinsHint")}><Input value={f.pins} onChange={(e) => setF({ ...f, pins: e.target.value })} /></Field>
            {(["description", "function", "precautions"] as const).map((k) => <Field key={k} label={t(`comp.f.${k}`)}><Textarea rows={2} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
            <Field label={t("comp.f.specs")} hint={t("comp.f.specsHint")}><Textarea rows={4} value={f.specs} onChange={(e) => setF({ ...f, specs: e.target.value })} /></Field>
          </div>
          <div className="mt-2 flex gap-2"><Btn onClick={create}>{t("c.save")}</Btn></div>
          <ErrorBox error={err} />
        </Card>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input placeholder={t("c.search")} value={text} onChange={(e) => setText(e.target.value)} className="!w-64" aria-label={t("c.search")} />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto" aria-label={t("comp.category")}><option value="">{t("c.all")}</option>{data?.categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.n})</option>)}</Select>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {data?.items.map((c) => (
            <li key={c.id} className="py-2 text-sm" data-component={c.name}>
              <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span><strong>{c.name}</strong>{c.mpn && c.mpn !== "generic" ? <span className="text-[var(--fg-3)]"> · {c.manufacturer} {c.mpn}</span> : null}</span>
                <span className="flex gap-1"><Pill>{c.category}</Pill><Pill tone={c.status === "verified" ? "ok" : c.status === "generic" ? "info" : "warn"}>{t(`comp.status.${c.status}` as "comp.status.generic")}</Pill>{c.symbol_kind && <Pill tone="info">SPICE</Pill>}</span>
              </button>
              {open === c.id && (
                <div className="mt-2 space-y-1 rounded-lg bg-[var(--bg-2)] p-3 text-[var(--fg-2)]">
                  <p>{c.description}</p>
                  {c.function && <p><strong>{t("comp.f.function")} :</strong> {c.function}</p>}
                  {c.pins.length > 0 && <p><strong>{t("comp.f.pins")} :</strong> {c.pins.join(" · ")}</p>}
                  {Object.keys(c.specs).length > 0 && <table className="text-xs"><tbody>{Object.entries(c.specs).map(([k, v]) => <tr key={k}><td className="pr-4">{k}</td><td className="font-mono">{v}</td></tr>)}</tbody></table>}
                  {c.precautions && <p className="text-[var(--warn)]">⚠ {c.precautions}</p>}
                  {c.datasheet_url && <a href={c.datasheet_url} target="_blank" rel="noreferrer noopener" className="text-[var(--cyan)] underline">{t("comp.datasheet")}</a>}
                  <p className="text-xs text-[var(--fg-3)]">{c.source}</p>
                  <div className="flex gap-2">
                    {c.symbol_kind && <a href="/lab/electronics" className="text-xs text-[var(--cyan)] underline">{t("comp.useInEditor")}</a>}
                    <a href={`/ai?q=${encodeURIComponent(`${t("comp.explainPrompt")} ${c.name}`)}`} className="text-xs text-[var(--cyan)] underline">{t("comp.explain")}</a>
                    {me?.is_admin && c.status !== "generic" && <Btn kind="ghost" onClick={async () => { await patch(`/api/components/${c.id}`, { status: c.status === "verified" ? "to_verify" : "verified" }); reload(); }}>{c.status === "verified" ? t("comp.unverify") : t("comp.verify")}</Btn>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
