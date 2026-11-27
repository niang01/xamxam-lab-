"use client";
/** Banque de travaux pratiques, de schémas types et de simulations prêtes à lancer (laboratoires réels de la plateforme). */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/components/providers";
import { Card, Field, Input, Page, Pill, Select } from "@/components/ui";
import { TPS, TP_DISCIPLINES, type Tp } from "@/lib/tp";
import { GENERATORS, resolveParams } from "@/lib/schematics-gen";
import { diagramSvg } from "@/lib/diagram";
import { LADDER_EXAMPLES, GRAFCET_EXAMPLES } from "@/lib/plc/examples";
import { SKETCHES } from "@/lib/iot/sketches";
import { BUILTIN_COURSES } from "@/lib/courses-builtin";

type Tab = "tp" | "schemas" | "simulations";

const SIMULATIONS: { group: string; items: { title: string; href: string; engine: string }[] }[] = [
  { group: "Automates (Ladder, CEI 61131-3)", items: LADDER_EXAMPLES.map((p) => ({ title: p.title, href: `/lab/automatisme?ladder=${p.key}`, engine: "Moteur Ladder" })) },
  { group: "Grafcet (CEI 60848)", items: GRAFCET_EXAMPLES.map((p) => ({ title: p.title, href: `/lab/automatisme?grafcet=${p.key}`, engine: "Moteur Grafcet" })) },
  { group: "Microcontrôleur Arduino Uno", items: SKETCHES.map((s) => ({ title: s.title, href: `/lab/iot?croquis=${s.key}`, engine: "avr-gcc + émulateur avr8js" })) },
  { group: "Circuits électroniques", items: [{ title: "Diviseur de tension", href: "/lab/electronics?exemple=divider", engine: "ngspice" }, { title: "Charge d'un circuit RC", href: "/lab/electronics?exemple=rc", engine: "ngspice" }] },
  { group: "Scénarios dans le temps (4D)", items: [{ title: "Énergie solaire et batterie", href: "/studio", engine: "Studio 4D" }, { title: "Réservoir et pompe", href: "/studio", engine: "Studio 4D" }, { title: "Chambre froide (coupure de courant)", href: "/studio", engine: "Studio 4D" }] },
  { group: "Thermodynamique", items: [{ title: "Cycle frigorifique à compression de vapeur", href: "/lab/refrigeration", engine: "CoolProp" }, { title: "Production photovoltaïque horaire", href: "/lab/solar", engine: "pvlib" }] },
];

export default function TravauxPratiques() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("tp");
  const [disc, setDisc] = useState(""); const [q, setQ] = useState(""); const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => TPS.filter((x) => (!disc || x.discipline === disc) && (!q || `${x.title} ${x.goals.join(" ")}`.toLowerCase().includes(q.toLowerCase()))), [disc, q]);
  const previews = useMemo(() => tab !== "schemas" ? [] : GENERATORS.map((g) => ({ g, svg: diagramSvg(g.build(resolveParams(g, {}).values).diagram) })), [tab]);
  const tp = open ? TPS.find((x) => x.key === open) : null;
  const nSim = SIMULATIONS.reduce((a, s) => a + s.items.length, 0);

  return (
    <Page title={t("nav.tp")} subtitle={t("tp.subtitle", { tp: TPS.length, sch: GENERATORS.length, sim: nSim, c: BUILTIN_COURSES.length })} onBack={tp ? () => setOpen(null) : undefined}>
      <div className="flex flex-wrap gap-2" role="tablist">
        {(["tp", "schemas", "simulations"] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} data-tab={k} onClick={() => { setTab(k); setOpen(null); }}
            className={`rounded-lg border px-3 py-1.5 text-sm ${tab === k ? "border-[var(--cyan)] text-[var(--fg)]" : "border-[var(--line)] text-[var(--fg-2)]"}`}>{t(`tp.tab.${k}` as "tp.tab.tp")}</button>
        ))}
        <Link href="/academy" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--fg-2)]">{t("tp.courses", { n: BUILTIN_COURSES.length })}</Link>
      </div>

      {tab === "tp" && !tp && (
        <Card>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label={t("tp.discipline")}><Select name="tp-discipline" value={disc} onChange={(e) => setDisc(e.target.value)} className="!w-auto"><option value="">{t("c.all")}</option>{TP_DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label={t("c.search")}><Input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          </div>
          <ul className="grid gap-3 md:grid-cols-2" data-testid="tp-list">
            {list.map((x) => (
              <li key={x.key} data-tp={x.key}>
                <button type="button" onClick={() => setOpen(x.key)} className="h-full w-full rounded-lg border border-[var(--line)] p-3 text-left hover:border-[var(--cyan)]">
                  <strong className="text-sm">{x.title}</strong>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs"><Pill tone="info">{x.discipline}</Pill><Pill>{x.level}</Pill><Pill>{x.minutes} min</Pill><Pill tone="ok">{t(`tp.kind.${x.kind}` as "tp.kind.simulation")}</Pill></div>
                  <p className="mt-1 text-xs text-[var(--fg-2)]">{x.goals[0]}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {tab === "tp" && tp && <TpSheet tp={tp} />}

      {tab === "schemas" && (
        <div className="grid gap-4 md:grid-cols-2" data-testid="schema-gallery">
          {previews.map(({ g, svg }) => (
            <Card key={g.kind} title={g.title}>
              <div className="h-48 overflow-hidden rounded border border-[var(--line)] bg-white [&>svg]:h-full [&>svg]:w-full" data-preview={g.kind} dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><Pill>{g.discipline}</Pill><span className="text-[var(--fg-3)]">{g.params.length} {t("tp.params")}</span>
                <Link className="ml-auto rounded-lg border border-[var(--cyan)] px-2 py-1 text-[var(--cyan)]" href={`/schemas?generer=${g.kind}`}>{t("tp.openEditor")}</Link></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "simulations" && (
        <div className="grid gap-4 md:grid-cols-2" data-testid="simulation-bank">
          {SIMULATIONS.map((s) => (
            <Card key={s.group} title={s.group}>
              <ul className="space-y-1 text-sm">{s.items.map((i) => <li key={i.title} className="flex flex-wrap items-center gap-2"><Link className="text-[var(--cyan)] underline" href={i.href}>{i.title}</Link><span className="text-xs text-[var(--fg-3)]">{i.engine}</span></li>)}</ul>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

function TpSheet({ tp }: { tp: Tp }) {
  const t = useT();
  const course = BUILTIN_COURSES.find((c) => c.key === tp.course);
  return (
    <Card title={tp.title} testId="tp-sheet">
      <div className="flex flex-wrap gap-1 text-xs"><Pill tone="info">{tp.discipline}</Pill><Pill>{tp.level}</Pill><Pill>{tp.minutes} min</Pill></div>
      <h3 className="mt-3 text-sm font-semibold">{t("tp.goals")}</h3><ul className="list-disc pl-5 text-sm">{tp.goals.map((g) => <li key={g}>{g}</li>)}</ul>
      <h3 className="mt-3 text-sm font-semibold">{t("tp.tools")}</h3>
      <ul className="space-y-1 text-sm">{tp.tools.map((x) => <li key={x.href}><Link className="text-[var(--cyan)] underline" data-tp-tool href={x.href}>{x.label} →</Link></li>)}</ul>
      <h3 className="mt-3 text-sm font-semibold">{t("tp.steps")}</h3><ol className="list-decimal pl-5 text-sm">{tp.steps.map((s) => <li key={s} className="mt-1">{s}</li>)}</ol>
      <h3 className="mt-3 text-sm font-semibold">{t("tp.expected")}</h3><ul className="list-disc pl-5 text-sm" data-testid="tp-expected">{tp.expected.map((s) => <li key={s} className="mt-1">{s}</li>)}</ul>
      <h3 className="mt-3 text-sm font-semibold">{t("tp.questions")}</h3><ol className="list-decimal pl-5 text-sm">{tp.questions.map((s) => <li key={s} className="mt-1">{s}</li>)}</ol>
      {course && <p className="mt-3 text-sm">{t("tp.course")} <Link className="text-[var(--cyan)] underline" href="/academy">{course.title}</Link></p>}
      <p className="mt-2 text-xs text-[var(--fg-3)]">{t("tp.note")}</p>
    </Card>
  );
}
