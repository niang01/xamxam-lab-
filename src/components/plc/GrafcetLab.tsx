"use client";
/**
 * Éditeur et simulateur Grafcet : étapes, transitions, réceptivités (notation « . + / ↑ t/Xn/3s »), dessin
 * normalisé (étape initiale à double cadre, transitions, divergences en ET à double trait, renvois), étapes actives
 * mises en évidence pendant la simulation. Moteur : src/lib/plc/grafcet.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Select } from "@/components/ui";
import { checkGrafcet, initialState, outputsOf, step, type GrafcetProgram, type GState } from "@/lib/plc/grafcet";
import { GRAFCET_EXAMPLES } from "@/lib/plc/examples";
import { ProgramStore } from "./ProgramStore";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const nums = (s: string) => s.split(/[,;\s]+/).filter(Boolean).map(Number).filter(Number.isFinite);
const actText = (a: GrafcetProgram["steps"][number]["actions"]) => a.map((x) => `${x.kind} ${x.v}`).join(", ");
const parseActs = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^(N|S|R)?\s*([QM]\d+)$/i.exec(x); return m ? { kind: (m[1]?.toUpperCase() ?? "N") as "N" | "S" | "R", v: m[2].toUpperCase() } : null; }).filter((x): x is { kind: "N" | "S" | "R"; v: string } => !!x);

/** Disposition : niveaux par parcours depuis les étapes initiales (les renvois vers un niveau supérieur sont des rebouclages). */
function layout(g: GrafcetProgram) {
  const level = new Map<number, number>();
  const queue = g.steps.filter((s) => s.initial).map((s) => s.id);
  for (const q of queue) level.set(q, 0);
  while (queue.length) {
    const s = queue.shift()!;
    for (const t of g.transitions.filter((x) => x.from.includes(s))) for (const n of t.to) if (!level.has(n)) { level.set(n, (level.get(s) ?? 0) + 1); queue.push(n); }
  }
  for (const s of g.steps) if (!level.has(s.id)) level.set(s.id, Math.max(0, ...level.values()) + 1);
  const cols = new Map<number, number[]>();
  for (const s of g.steps) { const l = level.get(s.id)!; cols.set(l, [...(cols.get(l) ?? []), s.id]); }
  const pos = new Map<number, [number, number]>();
  for (const [l, ids] of cols) ids.forEach((id, i) => pos.set(id, [160 + i * 200, 40 + l * 120]));
  return { pos, levels: Math.max(...cols.keys()) + 1, width: Math.max(...[...cols.values()].map((c) => c.length)) * 200 + 240 };
}

export function GrafcetLab() {
  const t = useT();
  const [g, setG] = useState<GrafcetProgram>(() => clone(GRAFCET_EXAMPLES[0]));
  const [ex, setEx] = useState(GRAFCET_EXAMPLES[0].key);
  const [inputs, setInputs] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [st, setSt] = useState<GState>(() => initialState(GRAFCET_EXAMPLES[0]));
  const [err, setErr] = useState<unknown>(null);
  const inRef = useRef(inputs); useEffect(() => { inRef.current = inputs; }, [inputs]);
  const check = useMemo(() => checkGrafcet(g), [g]);
  const lay = useMemo(() => layout(g), [g]);
  const outs = outputsOf(g, st);
  const ins = useMemo(() => [...new Set([...g.inputs.map((i) => i.v), ...g.transitions.flatMap((x) => x.cond.match(/I\d+/g) ?? [])])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))), [g]);
  const label = (v: string) => [...g.inputs, ...g.outputs].find((x) => x.v === v)?.label ?? "";

  useEffect(() => {
    if (!running || check.errors.length) return;
    const id = setInterval(() => setSt((s) => step(g, s, inRef.current, 50)), 50);
    return () => clearInterval(id);
  }, [running, g, check.errors.length]);

  const load = (p: GrafcetProgram) => { setRunning(false); setG(clone(p)); setSt(initialState(p)); setInputs({}); };
  const upd = (fn: (p: GrafcetProgram) => void) => { setRunning(false); const c = clone(g); fn(c); setG(c); setSt(initialState(c)); };
  const H = lay.levels * 120 + 40;

  return (
    <div className="space-y-4">
      <Card title={t("plc.grafcet")} testId="grafcet-lab">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full min-w-0 sm:w-auto sm:max-w-sm"><Field label={t("plc.example")}><Select data-testid="grafcet-example" value={ex} onChange={(e) => { setEx(e.target.value); const p = GRAFCET_EXAMPLES.find((x) => x.key === e.target.value); if (p) load(p); }} className="min-w-0 truncate">{GRAFCET_EXAMPLES.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}</Select></Field></div>
          {!running ? <Btn kind="ok" data-testid="grafcet-run" disabled={!!check.errors.length} onClick={() => setRunning(true)}>▶ {t("plc.run")}</Btn> : <Btn kind="danger" onClick={() => setRunning(false)}>■ {t("plc.stop")}</Btn>}
          <Btn kind="ghost" onClick={() => setSt(initialState(g))}>{t("plc.reset")}</Btn>
          <span className="text-xs text-[var(--fg-3)]">{t("plc.time")} {(st.timeMs / 1000).toFixed(1)} s · {t("plc.activeSteps")} : <span data-testid="grafcet-active">{st.active.map((a) => `X${a}`).join(", ")}</span></span>
        </div>
        <p className="mt-2 text-sm text-[var(--fg-2)]">{g.description}</p>
        {check.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-[var(--danger)]" data-testid="grafcet-errors">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="mt-3 overflow-x-auto rounded border border-[var(--line)] bg-[var(--bg-2)]">
          <svg viewBox={`0 0 ${lay.width} ${H}`} style={{ width: "100%", minWidth: 520 }} data-testid="grafcet-diagram">
            {g.transitions.map((tr) => {
              const fp = tr.from.map((f) => lay.pos.get(f)!).filter(Boolean), tp = tr.to.map((x) => lay.pos.get(x)!).filter(Boolean);
              if (!fp.length || !tp.length) return null;
              const back = tp[0][1] <= fp[0][1];
              const fx = fp.reduce((a, p) => a + p[0], 0) / fp.length, fy = Math.max(...fp.map((p) => p[1])) + 20;
              const ty = back ? fy + 40 : Math.min(...tp.map((p) => p[1])) - 20;
              const ybar = back ? fy + 22 : (fy + ty) / 2;
              return (
                <g key={tr.id} data-transition={tr.id}>
                  {fp.map((p, i) => <line key={i} x1={p[0]} y1={p[1] + 20} x2={p[0]} y2={fp.length > 1 ? ybar - 10 : ybar} stroke="var(--fg-2)" strokeWidth={1.5} />)}
                  {fp.length > 1 && <><line x1={Math.min(...fp.map((p) => p[0]))} y1={ybar - 12} x2={Math.max(...fp.map((p) => p[0]))} y2={ybar - 12} stroke="var(--fg-2)" /><line x1={Math.min(...fp.map((p) => p[0]))} y1={ybar - 8} x2={Math.max(...fp.map((p) => p[0]))} y2={ybar - 8} stroke="var(--fg-2)" /><line x1={fx} y1={ybar - 8} x2={fx} y2={ybar} stroke="var(--fg-2)" /></>}
                  <line x1={fx - 14} y1={ybar} x2={fx + 14} y2={ybar} stroke="var(--fg)" strokeWidth={3} />
                  <text x={fx + 20} y={ybar + 4} fontSize={11} fill="var(--cyan)">({tr.id}) {tr.cond}</text>
                  {back ? (
                    <path d={`M${fx} ${ybar} V${ybar + 10} H${40} V${tp[0][1]} H${tp[0][0] - 20}`} fill="none" stroke="var(--fg-2)" strokeWidth={1.5} markerEnd="url(#gar)" />
                  ) : <>
                    <line x1={fx} y1={ybar} x2={fx} y2={tp.length > 1 ? ybar + 8 : ty} stroke="var(--fg-2)" strokeWidth={1.5} />
                    {tp.length > 1 && <><line x1={Math.min(...tp.map((p) => p[0]))} y1={ybar + 8} x2={Math.max(...tp.map((p) => p[0]))} y2={ybar + 8} stroke="var(--fg-2)" /><line x1={Math.min(...tp.map((p) => p[0]))} y1={ybar + 12} x2={Math.max(...tp.map((p) => p[0]))} y2={ybar + 12} stroke="var(--fg-2)" /></>}
                    {tp.map((p, i) => <line key={i} x1={p[0]} y1={tp.length > 1 ? ybar + 12 : ty} x2={p[0]} y2={p[1] - 20} stroke="var(--fg-2)" strokeWidth={1.5} />)}
                  </>}
                </g>
              );
            })}
            <defs><marker id="gar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--fg-2)" /></marker></defs>
            {g.steps.map((s) => {
              const [x, y] = lay.pos.get(s.id)!; const act = st.active.includes(s.id);
              return (
                <g key={s.id} data-step={s.id} data-active={act ? "1" : "0"}>
                  <rect x={x - 20} y={y - 20} width={40} height={40} fill={act ? "color-mix(in srgb, var(--ok) 25%, transparent)" : "var(--panel)"} stroke={act ? "var(--ok)" : "var(--fg)"} strokeWidth={2} />
                  {s.initial && <rect x={x - 16} y={y - 16} width={32} height={32} fill="none" stroke={act ? "var(--ok)" : "var(--fg)"} strokeWidth={1.5} />}
                  <text x={x} y={y + 5} fontSize={14} textAnchor="middle" fill="var(--fg)">{s.id}</text>
                  {act && <circle cx={x} cy={y + 12} r={3} fill="var(--ok)" />}
                  {s.actions.length > 0 && <><line x1={x + 20} y1={y} x2={x + 34} y2={y} stroke="var(--fg-2)" /><rect x={x + 34} y={y - 13} width={Math.max(60, actText(s.actions).length * 7 + 10)} height={26} fill="var(--panel)" stroke="var(--fg-2)" /><text x={x + 40} y={y + 4} fontSize={11} fill="var(--fg)">{actText(s.actions)}</text></>}
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("plc.inputs")}>
          <ul className="space-y-1" data-testid="grafcet-inputs">
            {ins.map((v) => <li key={v} className="flex flex-wrap items-center gap-2 text-sm"><label className="inline-flex items-center gap-1"><input type="checkbox" data-input={v} checked={!!inputs[v]} onChange={(e) => setInputs((x) => ({ ...x, [v]: e.target.checked }))} /><span className="font-mono">{v}</span></label><span className="text-xs text-[var(--fg-2)]">{label(v)}</span></li>)}
          </ul>
        </Card>
        <Card title={t("plc.outputs")}>
          <ul className="space-y-1" data-testid="grafcet-outputs">
            {[...new Set([...g.outputs.map((o) => o.v), ...g.steps.flatMap((s) => s.actions.map((a) => a.v))])].map((v) => <li key={v} data-output={v} data-state={outs[v] ? "1" : "0"} className="flex items-center gap-2 text-sm"><span className={`h-3 w-3 rounded-full ${outs[v] ? "bg-[var(--ok)] shadow-[0_0_6px_var(--ok)]" : "bg-[var(--bg-2)] ring-1 ring-[var(--line)]"}`} /><span className="font-mono">{v}</span><span className="text-xs text-[var(--fg-2)]">{label(v)}</span></li>)}
          </ul>
        </Card>
      </div>

      <Card title={t("plc.edit")}>
        <h3 className="text-sm font-semibold">{t("plc.steps")}</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {g.steps.map((s, i) => (
            <li key={`${g.title}:${i}:${s.id}:${actText(s.actions)}`} className="flex flex-wrap items-center gap-2" data-step-edit={s.id}>
              <Input aria-label={t("plc.stepNumber")} className="!w-16" inputMode="numeric" value={String(s.id)} onChange={(e) => upd((p) => { p.steps[i].id = Number(e.target.value) || 0; })} />
              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={!!s.initial} onChange={(e) => upd((p) => { p.steps[i].initial = e.target.checked; })} />{t("plc.initial")}</label>
              <Input aria-label={t("plc.actions")} placeholder="N Q1, S M1" className="!w-44 font-mono" defaultValue={actText(s.actions)} onBlur={(e) => upd((p) => { p.steps[i].actions = parseActs(e.target.value); })} />
              <button type="button" className="text-[var(--danger)]" aria-label={t("c.delete")} onClick={() => upd((p) => { p.steps.splice(i, 1); })}>×</button>
            </li>
          ))}
        </ul>
        <Btn kind="ghost" className="mt-1" onClick={() => upd((p) => { p.steps.push({ id: Math.max(-1, ...p.steps.map((s) => s.id)) + 1, actions: [] }); })}>＋ {t("plc.stepAdd")}</Btn>
        <h3 className="mt-3 text-sm font-semibold">{t("plc.transitions")}</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {g.transitions.map((tr, i) => (
            <li key={`${g.title}:${i}:${tr.id}:${tr.from}:${tr.to}:${tr.cond}`} className="flex flex-wrap items-center gap-2" data-transition-edit={tr.id}>
              <span className="text-xs text-[var(--fg-3)]">({tr.id})</span>
              <Input aria-label={t("plc.from")} className="!w-20" defaultValue={tr.from.join(",")} onBlur={(e) => upd((p) => { p.transitions[i].from = nums(e.target.value); })} />→
              <Input aria-label={t("plc.to")} className="!w-20" defaultValue={tr.to.join(",")} onBlur={(e) => upd((p) => { p.transitions[i].to = nums(e.target.value); })} />
              <Input aria-label={t("plc.cond")} className="!w-56 font-mono" defaultValue={tr.cond} onBlur={(e) => upd((p) => { p.transitions[i].cond = e.target.value; })} />
              <button type="button" className="text-[var(--danger)]" aria-label={t("c.delete")} onClick={() => upd((p) => { p.transitions.splice(i, 1); })}>×</button>
            </li>
          ))}
        </ul>
        <Btn kind="ghost" className="mt-1" onClick={() => upd((p) => { p.transitions.push({ id: Math.max(0, ...p.transitions.map((x) => x.id)) + 1, from: [p.steps[0]?.id ?? 0], to: [p.steps[0]?.id ?? 0], cond: "I1" }); })}>＋ {t("plc.transitionAdd")}</Btn>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("plc.condHelp")}</p>
        <ErrorBox error={err} />
        <ProgramStore key={g.title} kind="grafcet" title={g.title} program={g} onLoad={(p) => load(p as GrafcetProgram)} onError={setErr} />
      </Card>
    </div>
  );
}
