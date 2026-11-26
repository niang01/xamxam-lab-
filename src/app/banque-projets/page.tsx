"use client";
/** Banque de projets pratiques et IoT : recherche, filtres, fiche complète (17 rubriques), code, favoris, réalisation. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Input, Page, Pill, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, post } from "@/lib/client/api";
import type { BankProject } from "@/lib/bank/types";

type Item = { id: string; title: string; filiere: string; domain: string; level: string; iot: boolean; components: number; code: boolean; favorite: boolean };
type List = { items: Item[]; inventory: { total: number; iot: number }; sectors: { key: string; label: string; critical: boolean }[]; filieres: { key: string; label: string }[]; levels: { key: string; label: string }[] };
type Detail = BankProject & { favorite: boolean; component_ids: Record<string, string>; code_source: { title: string; network: boolean; source: string } | null };

function Sec({ n, title, children }: { n: number; title: string; children: React.ReactNode }) { return <section className="space-y-1"><h3 className="font-semibold text-[var(--cyan)]">{n}. {title}</h3><div className="text-sm">{children}</div></section>; }
function L({ xs }: { xs: string[] }) { return <ul className="list-disc space-y-0.5 pl-5">{xs.map((x) => <li key={x}>{x}</li>)}</ul>; }

export default function Bank() {
  const { t } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ q: "", filiere: "", secteur: "", level: "", iot: "", favoris: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, reload } = useData<List>(`/api/bank?${qs}`);
  const [open, setOpen] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const lv = (k: string) => data?.levels.find((l) => l.key === k)?.label ?? k;
  const fl = (k: string) => data?.filieres.find((x) => x.key === k)?.label ?? k;
  const load = async (id: string) => { setErr(null); try { setOpen(await api<Detail>(`/api/bank/${encodeURIComponent(id)}`)); window.scrollTo({ top: 0 }); } catch (e) { setErr(e); } };
  const act = async (action: string) => { if (!open) return; try { const r = await post<{ id?: string }>(`/api/bank/${encodeURIComponent(open.id)}`, { action }); if (r.id) router.push(`/projects/${r.id}`); else { await load(open.id); reload(); } } catch (e) { setErr(e); } };
  return (
    <Page title={t("nav.bank")} subtitle={data ? t("bank.subtitle", { n: data.inventory.total, iot: data.inventory.iot }) : ""}>
      <ErrorBox error={err} />
      {open && (
        <Card title={open.title} testId="bank-detail" actions={<span className="flex flex-wrap gap-2">
          <Btn onClick={() => act("realise")} data-testid="bank-realise">{t("bank.realise")}</Btn>
          <Btn kind="ghost" onClick={() => act(open.favorite ? "unfavorite" : "favorite")} data-testid="bank-fav">{open.favorite ? `★ ${t("bank.saved")}` : `☆ ${t("bank.save")}`}</Btn>
          <Btn kind="ghost" onClick={() => setOpen(null)}>{t("c.close")}</Btn></span>}>
          <div className="space-y-4">
            <Sec n={1} title={t("bank.s1")}><p>{open.title} — {fl(open.filiere)} · {open.domain}{open.iot ? " · IoT" : ""}</p></Sec>
            <Sec n={2} title={t("bank.s2")}><Pill tone="info">{lv(open.level)}</Pill></Sec>
            <Sec n={3} title={t("bank.s3")}><L xs={open.objectives} /></Sec>
            <Sec n={4} title={t("bank.s4")}><p>{open.problem}</p></Sec>
            <Sec n={5} title={t("bank.s5")}><L xs={open.specs} /></Sec>
            <Sec n={6} title={t("bank.s6")}><ul className="list-disc pl-5">{open.components.map(([n, q]) => <li key={n}>{q} × {open.component_ids[n] ? <Link className="underline" href={`/components?q=${encodeURIComponent(n)}`}>{n}</Link> : n}</li>)}</ul></Sec>
            <Sec n={7} title={t("bank.s7")}><p>{t("bank.cost")} <Link className="underline" href={`/boutique?projet_banque=${encodeURIComponent(open.id)}`}>{t("bank.toShop")}</Link></p></Sec>
            <Sec n={8} title={t("bank.s8")}><p>{open.principle}</p></Sec>
            <Sec n={9} title={t("bank.s9")}>{open.schematic ? <Link className="underline" href={`/schemas?generer=${open.schematic}`} data-testid="bank-schema">{t("bank.openSchema")}</Link> : <p>{t("bank.noSchema")} <Link className="underline" href="/schemas">{t("nav.schemas")}</Link></p>}</Sec>
            <Sec n={10} title={t("bank.s10")}><ol className="list-decimal space-y-0.5 pl-5">{open.steps.map((s) => <li key={s}>{s}</li>)}</ol></Sec>
            <Sec n={11} title={t("bank.s11")}>{open.code_source ? <div><p className="mb-1 text-xs text-[var(--fg-3)]">{open.code_source.title} — {t("bank.codeInfo")}</p><pre className="max-h-80 overflow-auto rounded-lg bg-[var(--bg-2)] p-2 text-xs" data-testid="bank-code">{open.code_source.source}</pre>
              <Btn kind="ghost" className="mt-1" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([open.code_source!.source], { type: "text/x-c++src" })); a.download = `${open.code}.ino`; a.click(); }}>{t("bank.downloadCode")}</Btn></div> : <p>{t("bank.noCode")}</p>}</Sec>
            <Sec n={12} title={t("bank.s12")}>{open.simulation ? <Link className="underline" href={open.simulation.href}>{open.simulation.label}</Link> : <p>{t("bank.noSim")}</p>}</Sec>
            <Sec n={13} title={t("bank.s13")}><L xs={open.expected} /></Sec>
            <Sec n={14} title={t("bank.s14")}><L xs={open.tests} /></Sec>
            <Sec n={15} title={t("bank.s15")}>{open.faults.length ? <div className="overflow-x-auto"><table className="text-xs"><thead><tr className="text-left text-[var(--fg-3)]"><th className="pr-3">{t("bank.symptom")}</th><th className="pr-3">{t("bank.cause")}</th><th>{t("bank.remedy")}</th></tr></thead><tbody>{open.faults.map(([s, c, r]) => <tr key={s} className="border-t border-[var(--line)]"><td className="pr-3">{s}</td><td className="pr-3">{c}</td><td>{r}</td></tr>)}</tbody></table></div> : <p>—</p>}</Sec>
            <Sec n={16} title={t("bank.s16")}><L xs={open.applications} /></Sec>
            <Sec n={17} title={t("bank.s17")}><L xs={open.improvements} /></Sec>
          </div>
        </Card>
      )}
      <Card testId="bank-list">
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input aria-label={t("c.search")} placeholder={t("c.search")} name="bank-q" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <Select aria-label={t("comp.filiere")} name="bank-filiere" value={f.filiere} onChange={(e) => setF({ ...f, filiere: e.target.value })}><option value="">{t("comp.allFilieres")}</option>{data?.filieres.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
          <Select aria-label={t("bank.level")} name="bank-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">{t("bank.allLevels")}</option>{data?.levels.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
          <Select aria-label={t("bank.sector")} name="bank-sector" value={f.secteur} onChange={(e) => setF({ ...f, secteur: e.target.value })}><option value="">{t("bank.allSectors", { n: data?.sectors.length ?? 0 })}</option>{data?.sectors.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
          <Select aria-label="IoT" name="bank-iot" value={f.iot} onChange={(e) => setF({ ...f, iot: e.target.value })}><option value="">{t("bank.allTypes")}</option><option value="1">IoT</option><option value="0">{t("bank.nonIot")}</option></Select>
          <Select aria-label={t("bank.saved")} name="bank-fav" value={f.favoris} onChange={(e) => setF({ ...f, favoris: e.target.value })}><option value="">{t("bank.all")}</option><option value="1">★ {t("bank.myFavorites")}</option></Select>
        </div>
        <p className="mb-2 text-xs text-[var(--fg-3)]" data-testid="bank-count">{data ? t("bank.count", { n: data.items.length }) : t("c.loading")}</p>
        <ul className="divide-y divide-[var(--line)] text-sm">{data?.items.slice(0, 300).map((p) => (
          <li key={p.id} className="py-2"><button className="w-full text-left" onClick={() => load(p.id)} data-bank={p.id}>
            <span className="font-medium text-[var(--cyan)]">{p.favorite ? "★ " : ""}{p.title}</span>
            <span className="mt-0.5 flex flex-wrap gap-1 text-xs"><Pill>{fl(p.filiere)}</Pill><Pill tone="info">{lv(p.level)}</Pill>{p.iot && <Pill tone="ok">IoT</Pill>}{p.code && <Pill>{t("bank.withCode")}</Pill>}</span>
          </button></li>))}</ul>
      </Card>
    </Page>
  );
}
