"use client";
import { useState } from "react";
import { SymbolIcon } from "@/components/SymbolIcon";
import { ComponentSheet, type Photo } from "@/components/ComponentSheet";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { patch, post } from "@/lib/client/api";
import { DISCIPLINE_LABEL, type Discipline } from "@/lib/library";

type Comp = { id: string; category: string; name: string; symbol_kind: string | null; discipline: string | null; params: { key: string; label: string; unit: string }[]; doc: string | null; symbol2d: string | null; description: string; function: string | null; manufacturer: string | null; mpn: string | null; datasheet_url: string | null; specs: Record<string, string>; pins: string[]; precautions: string | null; status: string; source: string | null; subcategory?: string | null; photos?: Photo[]; catalogue_key?: string | null; footprint?: string | null; model3d?: string | null; has_board?: boolean };

export default function Components() {
  const { t, me } = useApp();
  const [text, setText] = useState(""); const [cat, setCat] = useState(""); const [disc, setDisc] = useState(""); const [fil, setFil] = useState("");
  const [kind, setKind] = useState(""); const [maker, setMaker] = useState(""); const [photo, setPhoto] = useState(false); const [cmp, setCmp] = useState<string[]>([]);
  const { data, reload } = useData<{ items: Comp[]; categories: { category: string; n: number }[]; disciplines: { discipline: string; n: number }[]; manufacturers: { manufacturer: string; n: number }[]; totals: { all: number; catalogue: number; photos: number; generic: number }; filieres: { key: string; label: string }[] }>(`/api/components?q=${encodeURIComponent(text)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}${disc ? `&discipline=${disc}` : ""}${fil ? `&filiere=${fil}` : ""}${kind ? `&kind=${kind}` : ""}${maker ? `&manufacturer=${encodeURIComponent(maker)}` : ""}${photo ? "&photo=1" : ""}`);
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
          <Select value={fil} onChange={(e) => setFil(e.target.value)} className="!w-auto" aria-label={t("comp.filiere")} name="filiere"><option value="">{t("comp.allFilieres")}</option>{data?.filieres.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</Select>
          <Select value={disc} onChange={(e) => setDisc(e.target.value)} className="!w-auto" aria-label={t("comp.discipline")} name="discipline"><option value="">{t("comp.allDisciplines")}</option>{data?.disciplines.map((d) => <option key={d.discipline} value={d.discipline}>{DISCIPLINE_LABEL[d.discipline as Discipline] ?? d.discipline} ({d.n})</option>)}</Select>
          <Input placeholder={t("c.search")} value={text} onChange={(e) => setText(e.target.value)} className="!w-64" aria-label={t("c.search")} />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto" aria-label={t("comp.category")}><option value="">{t("c.all")}</option>{data?.categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.n})</option>)}</Select>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="catalogue-filters">
          <Select aria-label={t("ref.kind")} name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="!w-auto"><option value="">{t("ref.kindAll")}</option><option value="catalogue">{t("ref.kindCatalogue")}</option><option value="generic">{t("ref.kindGeneric")}</option><option value="user">{t("ref.kindUser")}</option></Select>
          <Select aria-label={t("comp.f.manufacturer")} name="manufacturer" value={maker} onChange={(e) => setMaker(e.target.value)} className="!w-auto max-w-full"><option value="">{t("ref.allMakers")}</option>{data?.manufacturers.map((m) => <option key={m.manufacturer} value={m.manufacturer}>{m.manufacturer} ({m.n})</option>)}</Select>
          <label className="inline-flex items-center gap-1 text-sm"><input type="checkbox" name="photo" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />{t("ref.withPhoto")}</label>
          {data?.totals && <span className="text-xs text-[var(--fg-3)]" data-testid="catalogue-totals">{t("ref.totals", { all: data.totals.all, cat: data.totals.catalogue, ph: data.totals.photos, gen: data.totals.generic })}</span>}
        </div>
        {cmp.length > 0 && <CompareBar ids={cmp} items={data?.items ?? []} onClear={() => setCmp([])} />}
        <ul className="divide-y divide-[var(--line)]">
          {data?.items.map((c) => (
            <li key={c.id} className="py-2 text-sm" data-component={c.name}>
              <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="flex items-center gap-2">{c.photos?.length ? /* eslint-disable-next-line @next/next/no-img-element -- photo servie par la plateforme */ <img src={`/catalogue/photos/${c.photos[0].file}`} alt="" className="h-11 w-16 shrink-0 rounded border border-[var(--line)] bg-white object-contain" loading="lazy" data-thumb /> : <SymbolIcon name={c.name} code={c.symbol2d} />}<span><strong>{c.name}</strong>{c.mpn && c.mpn !== "generic" ? <span className="text-[var(--fg-3)]"> · {c.manufacturer} {c.mpn}</span> : null}</span></span>
                <span className="flex gap-1"><Pill>{c.category}</Pill><Pill tone={c.status === "verified" ? "ok" : c.status === "generic" ? "info" : "warn"}>{t(`comp.status.${c.status}` as "comp.status.generic")}</Pill>{c.symbol_kind && <Pill tone="info">SPICE</Pill>}</span>
              </button>
              {c.status === "catalogue" && <label className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--fg-3)]"><input type="checkbox" data-compare={c.name} checked={cmp.includes(c.id)} disabled={!cmp.includes(c.id) && cmp.length >= 3} onChange={(e) => setCmp((x) => e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id))} />{t("ref.compare")}</label>}
              {open === c.id && c.status === "catalogue" && <div className="mt-2"><ComponentSheet id={c.id} /></div>}
              {open === c.id && c.status !== "catalogue" && (
                <div className="mt-2 space-y-1 rounded-lg bg-[var(--bg-2)] p-3 text-[var(--fg-2)]">
                  <p>{c.description}</p>
                  {c.function && <p><strong>{t("comp.f.function")} :</strong> {c.function}</p>}
                  {c.pins.length > 0 && <p><strong>{t("comp.f.pins")} :</strong> {c.pins.join(" · ")}</p>}
                  {Object.keys(c.specs).length > 0 && <table className="text-xs"><tbody>{Object.entries(c.specs).map(([k, v]) => <tr key={k}><td className="pr-4">{k}</td><td className="font-mono">{v}</td></tr>)}</tbody></table>}
                  {c.params?.length > 0 && <div><strong>{t("comp.params")} :</strong><table className="mt-1 text-xs" data-testid="comp-params"><tbody>{c.params.map((p) => <tr key={p.key}><td className="pr-4">{p.label}</td><td className="font-mono text-[var(--fg-3)]">{p.unit || "—"}</td></tr>)}</tbody></table><p className="text-xs text-[var(--fg-3)]">{t("comp.paramsInfo")}</p></div>}
                  {c.precautions && <p className="text-[var(--warn)]">⚠ {c.precautions}</p>}
                  {c.doc && <p className="text-xs">📘 {c.doc}</p>}
                  {c.datasheet_url && <a href={c.datasheet_url} target="_blank" rel="noreferrer noopener" className="text-[var(--cyan)] underline">{t("comp.datasheet")}</a>}
                  <p className="text-xs text-[var(--fg-3)]">{c.source}</p>
                  <div className="flex gap-2">
                    <a href={`/schemas?ajout=${encodeURIComponent(c.id)}`} className="text-xs text-[var(--cyan)] underline">{t("comp.useInDiagram")}</a>
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

/** Comparaison de 2 à 3 références du catalogue (caractéristiques publiées uniquement). */
function CompareBar({ ids, items, onClear }: { ids: string[]; items: Comp[]; onClear: () => void }) {
  const { t } = useApp();
  const sel = ids.map((id) => items.find((x) => x.id === id)).filter((x): x is Comp => !!x);
  const keys = [...new Set(sel.flatMap((c) => Object.keys(c.specs ?? {})))];
  return (
    <Card title={t("ref.comparison")} testId="compare" actions={<Btn kind="ghost" onClick={onClear}>{t("c.close")}</Btn>}>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th />{sel.map((c) => <th key={c.id} className="px-2 text-left">{c.name}</th>)}</tr></thead><tbody>
        <tr><td className="pr-2 text-[var(--fg-3)]">{t("comp.f.manufacturer")}</td>{sel.map((c) => <td key={c.id} className="px-2">{c.manufacturer ?? "—"}</td>)}</tr>
        <tr><td className="pr-2 text-[var(--fg-3)]">{t("ref.subcategory")}</td>{sel.map((c) => <td key={c.id} className="px-2">{c.subcategory ?? c.category}</td>)}</tr>
        <tr><td className="pr-2 text-[var(--fg-3)]">{t("ref.pinCount")}</td>{sel.map((c) => <td key={c.id} className="px-2">{c.pins.length}</td>)}</tr>
        {keys.map((k) => <tr key={k}><td className="pr-2 text-[var(--fg-3)]">{k}</td>{sel.map((c) => <td key={c.id} className="px-2 font-mono">{c.specs?.[k] ?? "—"}</td>)}</tr>)}
        <tr><td className="pr-2 text-[var(--fg-3)]">{t("comp.datasheet")}</td>{sel.map((c) => <td key={c.id} className="px-2">{c.datasheet_url ? <a className="underline" href={c.datasheet_url} target="_blank" rel="noreferrer noopener">PDF</a> : "—"}</td>)}</tr>
      </tbody></table></div>
      <p className="mt-1 text-[11px] text-[var(--fg-3)]">{t("ref.compareNote")}</p>
    </Card>
  );
}
