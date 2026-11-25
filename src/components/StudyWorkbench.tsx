"use client";
/**
 * Poste de travail d'un logiciel de dimensionnement : formulaire décrit par le moteur, choix de références réelles
 * de la bibliothèque (leurs caractéristiques remplissent les champs), calcul serveur, résultats détaillés,
 * nomenclature, schéma, enregistrement, exports, envoi vers un projet et vers la boutique.
 * Un champ vide reste vide : le moteur le signale comme donnée manquante (jamais de valeur supposée).
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "./providers";
import { ProjectPicker } from "./ProjectPicker";
import { Btn, Card, ErrorBox, Field, Input, Pill, Select } from "./ui";
import { api, patch, post } from "@/lib/client/api";
import type { EquipmentPick, Input as StudyInput, StudyField, StudyResult, StudySection } from "@/lib/studies/types";

export interface SoftwareDef { key: string; title: string; discipline: string; lab: string; summary: string; sections: StudySection[]; example: StudyInput; needs: string[] }
type Table = { id: string; standard: string; table_ref: string; description: string };
type Comp = { id: string; name: string; manufacturer: string | null; mpn: string | null; status: string; specs: Record<string, string>; datasheet_url: string | null };

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function toInput(sections: StudySection[], v: StudyInput): StudyInput {
  const conv = (f: StudyField, x: unknown): unknown => {
    if (f.type === "number" || f.type === "int") { const s = str(x).trim().replace(",", "."); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? (f.type === "int" ? Math.round(n) : n) : null; }
    if (f.type === "bool") return x === true || x === "true";
    if (f.type === "months") return Array.from({ length: 12 }, (_, i) => { const s = str(Array.isArray(x) ? x[i] : "").trim().replace(",", "."); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; });
    if (f.type === "rows") return (Array.isArray(x) ? x : []).map((r) => Object.fromEntries((f.cols ?? []).map((c) => [c.key, conv(c, (r as Record<string, unknown>)[c.key])])));
    return str(x);
  };
  const out: StudyInput = {};
  for (const s of sections) for (const f of s.fields) out[f.key] = conv(f, v[f.key]);
  return out;
}

export function StudyWorkbench({ sw, tables, studyId: initialId, initial, initialTable }: { sw: SoftwareDef; tables: Table[]; studyId?: string | null; initial?: StudyInput; initialTable?: string | null }) {
  const { t } = useApp();
  const [v, setV] = useState<StudyInput>(initial ?? {});
  const [tableId, setTableId] = useState(initialTable ?? "");
  const [r, setR] = useState<StudyResult | null>(null);
  const [studyId, setStudyId] = useState<string | null>(initialId ?? null);
  const [title, setTitle] = useState("");
  const [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState<unknown>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- étude rechargée : données reçues du parent
  useEffect(() => { if (initial) setV(initial); }, [initial]);

  const input = useMemo(() => toInput(sw.sections, v), [sw, v]);
  async function calc(save = false) {
    setBusy(true); setErr(null); setMsg("");
    try {
      if (studyId && save) { const x = await patch<{ result: StudyResult }>(`/api/studies/${studyId}`, { input, table_id: tableId || null, ...(title ? { title } : {}) }); setR(x.result); setMsg(t("study.saved")); }
      else {
        const x = await post<{ result: StudyResult; id?: string }>("/api/studies", { software: sw.key, input, table_id: tableId || null, save, ...(save ? { title: title || sw.title } : {}) });
        setR(x.result); if (x.id) { setStudyId(x.id); setMsg(t("study.saved")); window.history.replaceState(null, "", `?etude=${x.id}`); }
      }
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  const setRow = (key: string, i: number, col: string, val: string) => { const list = [...((v[key] as Record<string, unknown>[]) ?? [])]; list[i] = { ...list[i], [col]: val }; setV({ ...v, [key]: list }); };
  const field = (f: StudyField) => {
    const lbl = `${f.label}${f.unit ? ` (${f.unit})` : ""}${f.optional ? ` — ${t("study.optional")}` : ""}`;
    if (f.type === "rows") {
      const list = (v[f.key] as Record<string, unknown>[]) ?? [];
      return (
        <div key={f.key} className="min-w-0 md:col-span-2 lg:col-span-3" data-rows={f.key}>
          <p className="mb-1 text-sm font-medium">{f.label}</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><thead><tr>{(f.cols ?? []).map((c) => <th key={c.key} className="px-1 text-left font-normal text-[var(--fg-3)]">{c.label}{c.unit ? ` (${c.unit})` : ""}</th>)}<th /></tr></thead>
            <tbody>{list.map((row, i) => <tr key={i}>{(f.cols ?? []).map((c) => <td key={c.key} className="p-0.5">{c.type === "select"
              ? <Select aria-label={c.label} value={str(row[c.key]) || c.options?.[0]?.v} onChange={(e) => setRow(f.key, i, c.key, e.target.value)}>{c.options?.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
              : <Input aria-label={c.label} name={`${f.key}.${i}.${c.key}`} inputMode={c.type === "text" ? "text" : "decimal"} value={str(row[c.key])} onChange={(e) => setRow(f.key, i, c.key, e.target.value)} />}</td>)}
              <td><button className="px-1 text-xs underline" onClick={() => setV({ ...v, [f.key]: list.filter((_, k) => k !== i) })}>{t("c.delete")}</button></td></tr>)}</tbody></table></div>
          <Btn kind="ghost" className="mt-1" onClick={() => setV({ ...v, [f.key]: [...list, Object.fromEntries((f.cols ?? []).map((c) => [c.key, c.type === "select" ? c.options?.[0]?.v ?? "" : ""]))] })} data-testid={`add-row-${f.key}`}>+ {t("study.addRow")}</Btn>
        </div>
      );
    }
    if (f.type === "months") {
      const list = Array.isArray(v[f.key]) ? v[f.key] as unknown[] : [];
      return (
        <div key={f.key} className="min-w-0 md:col-span-2 lg:col-span-3" data-months={f.key}>
          <p className="mb-1 text-sm">{lbl}</p>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-12">{Array.from({ length: 12 }, (_, i) => <label key={i} className="text-xs"><span className="text-[var(--fg-3)]">{MONTHS[i]}</span><Input name={`${f.key}.${i}`} inputMode="decimal" value={str(list[i])} onChange={(e) => { const nl = Array.from({ length: 12 }, (_, k) => list[k] ?? ""); nl[i] = e.target.value; setV({ ...v, [f.key]: nl }); }} /></label>)}</div>
          {f.hint && <p className="mt-0.5 text-xs text-[var(--fg-3)]">{f.hint}</p>}
        </div>
      );
    }
    if (f.type === "select") return <Field key={f.key} label={lbl}><Select name={f.key} value={str(v[f.key]) || f.options?.[0]?.v} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>{f.options?.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select></Field>;
    return <Field key={f.key} label={lbl} hint={f.hint}><Input name={f.key} inputMode={f.type === "text" ? "text" : "decimal"} value={str(v[f.key])} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} /></Field>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-[var(--fg-2)]">{sw.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn kind="ghost" onClick={() => setV(JSON.parse(JSON.stringify(sw.example)))} data-testid="study-example">{t("study.example")}</Btn>
          <Btn kind="ghost" onClick={() => { setV({}); setR(null); }}>{t("study.clear")}</Btn>
        </div>
        <p className="mt-1 text-xs text-[var(--fg-3)]">{t("study.exampleInfo")}</p>
      </Card>
      {sw.needs.includes("ampacity_table") && (
        <Card title={t("elec.tables")}>
          <Field label={t("elec.table")}><Select name="table" value={tableId} onChange={(e) => setTableId(e.target.value)}><option value="">—</option>{tables.map((x) => <option key={x.id} value={x.id}>{x.standard} · {x.table_ref} — {x.description}</option>)}</Select></Field>
          {!tables.length && <p className="mt-1 text-xs text-[var(--warn)]">{t("study.noTable")}</p>}
        </Card>
      )}
      {sw.sections.map((s) => (
        <Card key={s.title} title={s.title}>
          {s.geo && <LocationSearch lat={str(v.lat)} lon={str(v.lon)} onPick={(vals) => setV((cur) => ({ ...cur, ...vals }))} />}
          {s.equipment?.map((e) => <EquipmentChooser key={e.label} pick={e} onPick={(vals) => setV((cur) => ({ ...cur, ...vals }))} />)}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{s.fields.map(field)}</div>
        </Card>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={() => calc(false)} disabled={busy} data-testid="study-run">{t("study.run")}</Btn>
        <Input aria-label={t("c.title")} placeholder={t("study.title")} value={title} onChange={(e) => setTitle(e.target.value)} className="!w-64" name="study-title" />
        <Btn kind="ghost" onClick={() => calc(true)} disabled={busy} data-testid="study-save">{t("study.save")}</Btn>
        {msg && <Pill tone="ok">{msg}</Pill>}
      </div>
      <ErrorBox error={err} />
      {r && <StudyResultView r={r} studyId={studyId} pid={pid} setPid={setPid} onMsg={setMsg} onErr={setErr} />}
    </div>
  );
}

type Place = { name: string; admin1: string | null; country: string | null; lat: number; lon: number };
type Clim = { source: string; nature: string; resolution: string; parameters: Record<string, { values: { value: number | null }[] }> };

/** Recherche du lieu (autocomplétion dès 2 lettres) puis données mensuelles NASA POWER (modélisées). */
function LocationSearch({ lat, lon, onPick }: { lat: string; lon: string; onPick: (v: StudyInput) => void }) {
  const { t, lang } = useApp();
  const [q, setQ] = useState(""); const [list, setList] = useState<Place[]>([]); const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(""); const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const h = setTimeout(() => { api<{ items: Place[] }>(`/api/geo/search?q=${encodeURIComponent(q.trim())}&lang=${lang === "en" ? "en" : "fr"}`).then((r) => setList(r.items)).catch(setErr); }, 300);
    return () => clearTimeout(h);
  }, [q, lang]);
  async function power() {
    setBusy(true); setErr(null);
    try {
      const r = await api<Clim>(`/api/geo/climatology?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&params=ALLSKY_SFC_SW_DWN,T2M,T2M_MIN,T2M_MAX`);
      const m = (k: string) => (r.parameters[k]?.values ?? []).slice(0, 12).map((x) => x.value);
      const tmin = m("T2M_MIN").filter((x): x is number => x != null), tmax = m("T2M_MAX").filter((x): x is number => x != null);
      onPick({ ghi: m("ALLSKY_SFC_SW_DWN").map((x) => x ?? ""), tmean: m("T2M").map((x) => x ?? ""), ...(tmin.length ? { t_min: Math.min(...tmin) } : {}), ...(tmax.length ? { t_max: Math.max(...tmax) } : {}) });
      setInfo(`${r.source} — ${t("study.modelled")} (${r.resolution})`);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }
  return (
    <div className="mb-3 rounded-lg border border-dashed border-[var(--line)] p-2 text-sm" data-testid="location-search">
      <Field label={t("study.searchPlace")}><Input name="place-search" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setList([]); }} placeholder={t("study.searchPlaceHint")} autoComplete="off" /></Field>
      {!!list.length && <ul className="mt-1 max-h-48 overflow-y-auto rounded border border-[var(--line)]" role="listbox">{list.map((p, i) => <li key={i}><button className="w-full px-2 py-1 text-left hover:bg-[var(--panel-2)]" data-place={p.name} onClick={() => { onPick({ place: [p.name, p.admin1, p.country].filter(Boolean).join(", "), lat: Number(p.lat.toFixed(4)), lon: Number(p.lon.toFixed(4)) }); setList([]); setQ(""); }}>{p.name}{p.admin1 ? `, ${p.admin1}` : ""}{p.country ? ` — ${p.country}` : ""} <span className="text-xs text-[var(--fg-3)]">({p.lat.toFixed(2)}, {p.lon.toFixed(2)})</span></button></li>)}</ul>}
      <div className="mt-2 flex flex-wrap items-center gap-2"><Btn kind="ghost" disabled={!lat || !lon || busy} onClick={power} data-testid="nasa-power">{busy ? t("c.loading") : t("study.nasaPower")}</Btn>{info && <span className="text-xs text-[var(--fg-3)]">{info}</span>}</div>
      <ErrorBox error={err} />
    </div>
  );
}

function EquipmentChooser({ pick, onPick }: { pick: EquipmentPick; onPick: (v: StudyInput) => void }) {
  const { t } = useApp();
  const [items, setItems] = useState<Comp[] | null>(null);
  const [chosen, setChosen] = useState("");
  useEffect(() => {
    Promise.all(pick.names.map((n) => api<{ items: Comp[] }>(`/api/components?q=${encodeURIComponent(n)}`).then((r) => r.items.filter((c) => c.name === n && c.mpn && c.mpn !== "generic")))).then((l) => setItems(l.flat())).catch(() => setItems([]));
  }, [pick]);
  const c = items?.find((x) => x.id === chosen);
  return (
    <div className="mb-3 rounded-lg border border-dashed border-[var(--line)] p-2 text-sm" data-equipment={pick.label}>
      <Field label={`${pick.label} — ${t("study.reference")}`}>
        <Select value={chosen} onChange={(e) => {
          setChosen(e.target.value);
          const x = items?.find((i) => i.id === e.target.value);
          if (x) onPick(Object.fromEntries(Object.entries(pick.map).filter(([spec]) => x.specs?.[spec] != null && x.specs[spec] !== "").map(([spec, field]) => [field, x.specs[spec]])));
        }}><option value="">{items === null ? t("c.loading") : items.length ? "—" : t("study.noReference")}</option>{items?.map((i) => <option key={i.id} value={i.id}>{i.manufacturer} {i.mpn}{i.status !== "verified" ? ` (${t("study.toVerify")})` : ""}</option>)}</Select>
      </Field>
      {c && <p className="text-xs text-[var(--fg-3)]">{c.datasheet_url && <a className="underline" href={c.datasheet_url} target="_blank" rel="noreferrer">{t("comp.datasheet")}</a>} · {t("study.filled")}</p>}
      {items && !items.length && <p className="text-xs text-[var(--fg-3)]">{t("study.addReference")} <Link className="underline" href="/components">{t("nav.components")}</Link></p>}
    </div>
  );
}

function StudyResultView({ r, studyId, pid, setPid, onMsg, onErr }: { r: StudyResult; studyId: string | null; pid: string; setPid: (s: string) => void; onMsg: (s: string) => void; onErr: (e: unknown) => void }) {
  const { t } = useApp();
  return (
    <div className="space-y-4" data-testid="study-result">
      {!!r.missing.length && <Card title={t("study.missing")}><ul className="list-disc pl-5 text-sm text-[var(--warn)]" data-testid="study-missing">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul></Card>}
      {!!r.summary.length && <Card title={t("study.summary")}><ul className="grid gap-2 sm:grid-cols-3">{r.summary.map((s) => <li key={s.label} className="rounded-lg border border-[var(--line)] p-2"><div className="text-xs text-[var(--fg-3)]">{s.label}</div><div className="text-lg font-semibold" data-summary={s.label}>{typeof s.value === "number" ? s.value.toLocaleString() : s.value} {s.unit}</div></li>)}</ul></Card>}
      {r.steps.map((s) => (
        <Card key={s.title} title={<span>{s.title} {s.ok === false && <Pill tone="danger">{t("study.notOk")}</Pill>}</span>}>
          <div className="overflow-x-auto"><table className="w-full text-sm" data-step={s.title}><tbody>{s.lines.map((l) => <tr key={l.label} className="border-b border-[var(--line)]"><td className="py-1 pr-2">{l.label}</td><td className="py-1 pr-2 font-mono" data-line={l.label}>{typeof l.value === "number" ? l.value.toLocaleString() : l.value} {l.unit}</td><td className="py-1 text-xs text-[var(--fg-3)]">{l.formula}</td></tr>)}</tbody></table></div>
          {s.note && <p className="mt-1 text-sm">{s.note}</p>}
        </Card>
      ))}
      {!!r.warnings.length && <Card title={t("study.warnings")}><ul className="list-disc pl-5 text-sm">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Card>}
      {!!r.bom.length && (
        <Card title={t("study.bom")} testId="study-bom">
          <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{r.bom.map((b, i) => <tr key={i} className="border-b border-[var(--line)]"><td className="py-1 pr-2">{b.name}</td><td className="py-1 pr-2 font-mono">{b.qty.toLocaleString()} {b.unit}</td><td className="py-1 text-xs text-[var(--fg-3)]">{b.spec}</td></tr>)}</tbody></table></div>
          <p className="mt-1 text-xs text-[var(--fg-3)]">{t("bank.cost")}</p>
        </Card>
      )}
      <Card title={t("study.next")}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {r.diagram && <Link className="rounded-lg border border-[var(--line)] px-3 py-1.5" data-testid="study-diagram" href={`/schemas?generer=${r.diagram.kind}&p=${encodeURIComponent(JSON.stringify(r.diagram.params))}`}>{t("study.openDiagram")}</Link>}
          {studyId ? <>
            {(["pdf", "docx", "xlsx", "md"] as const).map((f) => <a key={f} className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs uppercase" href={`/api/studies/${studyId}/export?format=${f}`} data-testid={`study-export-${f}`}>{f}</a>)}
            <Link className="rounded-lg border border-[var(--line)] px-3 py-1.5" href={`/boutique?etude=${studyId}`} data-testid="study-shop">{t("study.toShop")}</Link>
            <ProjectPicker value={pid} onChange={setPid} />
            <Btn kind="ghost" disabled={!pid} onClick={async () => { try { await post(`/api/studies/${studyId}`, { project_id: pid }); onMsg(t("study.sentToProject")); } catch (e) { onErr(e); } }} data-testid="study-to-project">{t("study.toProject")}</Btn>
            <Link className="rounded-lg border border-[var(--line)] px-3 py-1.5" href={`/ai?q=${encodeURIComponent(t("study.askAi"))}&etude=${studyId}`}>{t("study.askAiBtn")}</Link>
          </> : <span className="text-xs text-[var(--fg-3)]">{t("study.saveFirst")}</span>}
        </div>
      </Card>
    </div>
  );
}
