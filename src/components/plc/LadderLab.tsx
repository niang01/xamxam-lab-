"use client";
/**
 * Éditeur et simulateur Ladder : schéma à contacts avec circulation du « courant » en temps réel, édition des
 * échelons, entrées (interrupteurs ou boutons maintenus), sorties, mémoires, temporisations et compteurs.
 * Le calcul est fait par le moteur pur src/lib/plc/ladder.ts (cycle de 10 ms).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Select } from "@/components/ui";
import { checkLadder, emptyState, ladderText, runFor, type Coil, type CoilKind, type Contact, type ContactKind, type LadderProgram, type PlcState } from "@/lib/plc/ladder";
import { LADDER_EXAMPLES } from "@/lib/plc/examples";
import { ProgramStore } from "./ProgramStore";

const CONTACTS: ContactKind[] = ["NO", "NC", "P", "N"];
const COILS: CoilKind[] = ["OUT", "NOT", "SET", "RST", "TON", "TOF", "TP", "CTU", "CTD", "CRES"];
const W = 760, ROW = 46, CX = 70;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
/** Entrées câblées en NF (bouton d'arrêt, contact thermique) : à 1 au repos. */
const ncDefaults = (p: LadderProgram) => Object.fromEntries(p.inputs.filter((i) => /\(NF/.test(i.label)).map((i) => [i.v, true]));
const usedVars = (p: LadderProgram, prefix: string) => [...new Set(p.rungs.flatMap((r) => [...r.branches.flat().map((c) => c.v), r.out.v]).filter((v) => v.startsWith(prefix)))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

function ContactShape({ c, x, y, on, energized }: { c: Contact; x: number; y: number; on: boolean; energized: boolean }) {
  const col = energized ? "var(--ok)" : "var(--fg-2)";
  return (
    <g data-contact={`${c.kind}:${c.v}`} data-on={on ? "1" : "0"}>
      <line x1={x - 14} y1={y} x2={x - 6} y2={y} stroke={col} strokeWidth={2} /><line x1={x + 6} y1={y} x2={x + 14} y2={y} stroke={col} strokeWidth={2} />
      <line x1={x - 6} y1={y - 10} x2={x - 6} y2={y + 10} stroke={col} strokeWidth={2} /><line x1={x + 6} y1={y - 10} x2={x + 6} y2={y + 10} stroke={col} strokeWidth={2} />
      {c.kind === "NC" && <line x1={x - 8} y1={y + 10} x2={x + 8} y2={y - 10} stroke={col} strokeWidth={2} />}
      {(c.kind === "P" || c.kind === "N") && <text x={x} y={y + 4} fontSize={10} textAnchor="middle" fill={col}>{c.kind}</text>}
      <text x={x} y={y - 14} fontSize={11} textAnchor="middle" fill="var(--fg)">{c.v}</text>
    </g>
  );
}

function CoilShape({ o, x, y, energized, state }: { o: Coil; x: number; y: number; energized: boolean; state: PlcState }) {
  const col = energized ? "var(--ok)" : "var(--fg-2)";
  const box = ["TON", "TOF", "TP", "CTU", "CTD", "CRES"].includes(o.kind);
  const t = state.timers[o.v], c = state.counters[o.v];
  return (
    <g data-coil={o.v}>
      {box ? <><rect x={x - 26} y={y - 14} width={52} height={28} rx={3} fill="none" stroke={col} strokeWidth={2} /><text x={x} y={y + 4} fontSize={10} textAnchor="middle" fill={col}>{o.kind}</text></>
        : <><path d={`M${x - 6} ${y - 11} Q${x - 14} ${y} ${x - 6} ${y + 11} M${x + 6} ${y - 11} Q${x + 14} ${y} ${x + 6} ${y + 11}`} fill="none" stroke={col} strokeWidth={2} />{o.kind !== "OUT" && <text x={x} y={y + 4} fontSize={10} textAnchor="middle" fill={col}>{{ NOT: "/", SET: "S", RST: "R" }[o.kind as "SET"]}</text>}</>}
      <text x={x} y={y - 18} fontSize={11} textAnchor="middle" fill="var(--fg)">{o.v}</text>
      {t && <text x={x} y={y + 26} fontSize={9} textAnchor="middle" fill="var(--fg-3)">{(t.et / 1000).toFixed(1)}/{((o.preset ?? 0) / 1000).toFixed(1)} s</text>}
      {c && <text x={x} y={y + 26} fontSize={9} textAnchor="middle" fill="var(--fg-3)">{c.cv}/{o.preset ?? 0}</text>}
    </g>
  );
}

export function LadderLab({ initial }: { initial?: string } = {}) {
  const t = useT();
  const first = LADDER_EXAMPLES.find((x) => x.key === initial) ?? LADDER_EXAMPLES[0];
  const [prog, setProg] = useState<LadderProgram>(() => clone(first));
  const [ex, setEx] = useState(first.key);
  const [inputs, setInputs] = useState<Record<string, boolean>>(() => ncDefaults(first));
  const [running, setRunning] = useState(false);
  const [st, setSt] = useState<PlcState & { power: boolean[] }>({ ...emptyState(), power: [] });
  const [edit, setEdit] = useState<number | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const inRef = useRef(inputs); useEffect(() => { inRef.current = inputs; }, [inputs]);
  const check = useMemo(() => checkLadder(prog), [prog]);
  const ins = useMemo(() => [...new Set([...prog.inputs.map((i) => i.v), ...usedVars(prog, "I")])], [prog]);
  const outs = useMemo(() => [...new Set([...prog.outputs.map((i) => i.v), ...usedVars(prog, "Q")])], [prog]);
  const label = (v: string) => [...prog.inputs, ...prog.outputs].find((x) => x.v === v)?.label ?? "";

  useEffect(() => {
    if (!running || check.errors.length) return;
    const id = setInterval(() => setSt((s) => runFor(prog, s, inRef.current, 50, 10)), 50);
    return () => clearInterval(id);
  }, [running, prog, check.errors.length]);

  const reset = () => { setSt({ ...emptyState(), power: [] }); };
  const load = (p: LadderProgram) => { setRunning(false); setProg(clone(p)); reset(); setEdit(null); setInputs(ncDefaults(p)); };
  const upd = (fn: (p: LadderProgram) => void) => setProg((p) => { const c = clone(p); fn(c); return c; });

  // Mise en page du schéma : une ligne par branche, contacts répartis, bobine à droite.
  const heights = prog.rungs.map((r) => Math.max(1, r.branches.length) * ROW + 26);
  const rows = prog.rungs.map((r, ri) => ({ r, ri, top: 30 + heights.slice(0, ri).reduce((a, b) => a + b, 0), h: heights[ri] - 26, p: st.power[ri] ?? false }));
  const height = 30 + heights.reduce((a, b) => a + b, 0) + 10;

  return (
    <div className="space-y-4">
      <Card title={t("plc.ladder")} testId="ladder-lab">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full min-w-0 sm:w-auto sm:max-w-sm"><Field label={t("plc.example")}><Select data-testid="ladder-example" value={ex} onChange={(e) => { setEx(e.target.value); const p = LADDER_EXAMPLES.find((x) => x.key === e.target.value); if (p) load(p); }} className="min-w-0 truncate">{LADDER_EXAMPLES.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}</Select></Field></div>
          <Btn kind="ghost" onClick={() => { setEx(""); load({ title: t("plc.newProgram"), description: "", inputs: [{ v: "I1", label: "" }], outputs: [{ v: "Q1", label: "" }], rungs: [{ branches: [[{ kind: "NO", v: "I1" }]], out: { kind: "OUT", v: "Q1" } }] }); }}>{t("plc.new")}</Btn>
          {!running ? <Btn kind="ok" data-testid="ladder-run" disabled={!!check.errors.length} onClick={() => setRunning(true)}>▶ {t("plc.run")}</Btn> : <Btn kind="danger" data-testid="ladder-stop" onClick={() => setRunning(false)}>■ {t("plc.stop")}</Btn>}
          <Btn kind="ghost" onClick={reset}>{t("plc.reset")}</Btn>
          <span className="text-xs text-[var(--fg-3)]" data-testid="ladder-time">{t("plc.time")} {(st.timeMs / 1000).toFixed(1)} s · {st.cycles} {t("plc.cycles")}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--fg-2)]">{prog.description}</p>
        {check.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-[var(--danger)]" data-testid="ladder-errors">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {check.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-[var(--warn)]">{check.warnings.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="mt-3 overflow-x-auto rounded border border-[var(--line)] bg-[var(--bg-2)]">
          <svg viewBox={`0 0 ${W} ${height}`} className="min-w-[560px]" style={{ width: "100%" }} data-testid="ladder-diagram">
            <line x1={20} y1={10} x2={20} y2={height - 10} stroke="var(--fg-2)" strokeWidth={3} /><line x1={W - 20} y1={10} x2={W - 20} y2={height - 10} stroke="var(--fg-2)" strokeWidth={3} />
            {rows.map(({ r, ri, top, h, p }) => {
              const coilX = W - 80;
              return (
                <g key={ri} data-rung={ri + 1} data-power={p ? "1" : "0"} onClick={() => setEdit(ri)} style={{ cursor: "pointer" }}>
                  <text x={26} y={top - 8} fontSize={10} fill="var(--fg-3)">{String(ri + 1).padStart(2, "0")}{r.comment ? ` — ${r.comment}` : ""}</text>
                  {r.branches.map((b, bi) => {
                    const by = top + 16 + bi * ROW;
                    let flow = true; // circulation le long de la branche
                    const xs = b.map((_, ci) => 20 + CX * (ci + 1));
                    const endX = xs.length ? xs[xs.length - 1] + 14 : 40;
                    const segs: React.ReactNode[] = [];
                    let prevX = 20;
                    b.forEach((c, ci) => {
                      const v = !!st.bits[c.v], pv = !!st.prev[c.v];
                      const on = c.kind === "NO" ? v : c.kind === "NC" ? !v : c.kind === "P" ? v && !pv : !v && pv;
                      segs.push(<line key={`s${ci}`} x1={prevX} y1={by} x2={xs[ci] - 14} y2={by} stroke={flow && running ? "var(--ok)" : "var(--fg-2)"} strokeWidth={2} />);
                      segs.push(<ContactShape key={`c${ci}`} c={c} x={xs[ci]} y={by} on={on} energized={flow && on && running} />);
                      flow = flow && on; prevX = xs[ci] + 14;
                    });
                    return <g key={bi}>{segs}<line x1={endX} y1={by} x2={coilX - 40} y2={by} stroke={flow && running ? "var(--ok)" : "var(--fg-2)"} strokeWidth={2} />{bi > 0 && <line x1={coilX - 40} y1={top + 16} x2={coilX - 40} y2={by} stroke="var(--fg-2)" strokeWidth={2} />}{bi > 0 && <line x1={20} y1={top + 16} x2={20} y2={by} stroke="var(--fg-2)" strokeWidth={2} />}</g>;
                  })}
                  <line x1={coilX - 40} y1={top + 16} x2={coilX - 26} y2={top + 16} stroke={p && running ? "var(--ok)" : "var(--fg-2)"} strokeWidth={2} />
                  <CoilShape o={r.out} x={coilX} y={top + 16} energized={p && running} state={st} />
                  <line x1={coilX + 26} y1={top + 16} x2={W - 20} y2={top + 16} stroke="var(--fg-2)" strokeWidth={2} />
                  {edit === ri && <rect x={4} y={top - 20} width={W - 8} height={h + 18} fill="none" stroke="var(--cyan)" strokeDasharray="4 3" />}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn kind="ghost" data-testid="rung-add" onClick={() => { upd((p) => p.rungs.push({ branches: [[{ kind: "NO", v: "I1" }]], out: { kind: "OUT", v: "Q1" } })); setEdit(prog.rungs.length); }}>＋ {t("plc.rungAdd")}</Btn>
          <span className="self-center text-xs text-[var(--fg-3)]">{t("plc.editHint")}</span>
        </div>
        {edit != null && prog.rungs[edit] && <RungEditor key={edit} i={edit} prog={prog} upd={upd} onClose={() => setEdit(null)} />}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("plc.inputs")}>
          <p className="text-xs text-[var(--fg-3)]">{t("plc.inputsHint")}</p>
          <ul className="mt-2 space-y-1" data-testid="ladder-inputs">
            {ins.map((v) => (
              <li key={v} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="inline-flex items-center gap-1"><input type="checkbox" data-input={v} checked={!!inputs[v]} onChange={(e) => setInputs((x) => ({ ...x, [v]: e.target.checked }))} /><span className="font-mono">{v}</span></label>
                <button type="button" data-push={v} className="rounded border border-[var(--line)] px-2 py-0.5 text-xs" onPointerDown={() => setInputs((x) => ({ ...x, [v]: !x[v] }))} onPointerUp={() => setInputs((x) => ({ ...x, [v]: !x[v] }))} onPointerLeave={(e) => { if (e.buttons) setInputs((x) => ({ ...x, [v]: !x[v] })); }}>{t("plc.push")}</button>
                <span className="text-xs text-[var(--fg-2)]">{label(v)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t("plc.outputs")}>
          <ul className="space-y-1" data-testid="ladder-outputs">
            {outs.map((v) => <li key={v} data-output={v} data-state={st.bits[v] ? "1" : "0"} className="flex items-center gap-2 text-sm"><span className={`h-3 w-3 rounded-full ${st.bits[v] ? "bg-[var(--ok)] shadow-[0_0_6px_var(--ok)]" : "bg-[var(--bg-2)] ring-1 ring-[var(--line)]"}`} /><span className="font-mono">{v}</span><span className="text-xs text-[var(--fg-2)]">{label(v)}</span></li>)}
          </ul>
          <div className="mt-3 text-xs text-[var(--fg-2)]">
            {usedVars(prog, "M").length > 0 && <p>{t("plc.memory")} : {usedVars(prog, "M").map((m) => `${m}=${st.bits[m] ? 1 : 0}`).join(" · ")}</p>}
            {Object.entries(st.timers).map(([k, v]) => <p key={k} data-timer={k}>{k} : {(v.et / 1000).toFixed(2)} s · Q={v.q ? 1 : 0}</p>)}
            {Object.entries(st.counters).map(([k, v]) => <p key={k} data-counter={k}>{k} : {v.cv} · Q={v.q ? 1 : 0}</p>)}
          </div>
        </Card>
      </div>

      <Card title={t("plc.listing")}>
        <pre className="overflow-x-auto whitespace-pre rounded bg-[var(--bg-2)] p-2 font-mono text-xs" data-testid="ladder-text">{ladderText(prog)}</pre>
        <ErrorBox error={err} />
        <ProgramStore key={prog.title} kind="ladder" title={prog.title} program={prog} onLoad={(p) => load(p as LadderProgram)} onError={setErr} />
      </Card>
    </div>
  );
}

function RungEditor({ i, prog, upd, onClose }: { i: number; prog: LadderProgram; upd: (fn: (p: LadderProgram) => void) => void; onClose: () => void }) {
  const t = useT();
  const r = prog.rungs[i];
  const timer = ["TON", "TOF", "TP"].includes(r.out.kind), counter = ["CTU", "CTD"].includes(r.out.kind);
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-[var(--cyan)] p-3 text-sm" data-testid="rung-editor">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{t("plc.rung")} {i + 1}</strong>
        <span className="flex gap-1">
          <Btn kind="ghost" disabled={i === 0} onClick={() => upd((p) => { [p.rungs[i - 1], p.rungs[i]] = [p.rungs[i], p.rungs[i - 1]]; })}>↑</Btn>
          <Btn kind="ghost" disabled={i === prog.rungs.length - 1} onClick={() => upd((p) => { [p.rungs[i + 1], p.rungs[i]] = [p.rungs[i], p.rungs[i + 1]]; })}>↓</Btn>
          <Btn kind="danger" onClick={() => { upd((p) => { p.rungs.splice(i, 1); }); onClose(); }}>{t("c.delete")}</Btn>
          <Btn kind="ghost" onClick={onClose}>{t("c.close")}</Btn>
        </span>
      </div>
      {r.branches.map((b, bi) => (
        <div key={bi} className="flex flex-wrap items-center gap-1" data-branch={bi}>
          <span className="w-20 text-xs text-[var(--fg-3)]">{bi === 0 ? t("plc.branch") : t("plc.or")}</span>
          {b.map((c, ci) => (
            <span key={ci} className="inline-flex items-center gap-1 rounded border border-[var(--line)] p-1">
              <Select aria-label={t("plc.contactKind")} value={c.kind} className="!w-auto !px-1 !py-0.5" onChange={(e) => upd((p) => { p.rungs[i].branches[bi][ci].kind = e.target.value as ContactKind; })}>{CONTACTS.map((k) => <option key={k} value={k}>{t(`plc.c.${k}` as "plc.c.NO")}</option>)}</Select>
              <Input aria-label={t("plc.variable")} value={c.v} className="!w-16 !px-1 !py-0.5 font-mono" onChange={(e) => upd((p) => { p.rungs[i].branches[bi][ci].v = e.target.value.toUpperCase().slice(0, 4); })} />
              <button type="button" aria-label={t("c.delete")} className="px-1 text-[var(--danger)]" onClick={() => upd((p) => { p.rungs[i].branches[bi].splice(ci, 1); if (!p.rungs[i].branches[bi].length && p.rungs[i].branches.length > 1) p.rungs[i].branches.splice(bi, 1); })}>×</button>
            </span>
          ))}
          <Btn kind="ghost" onClick={() => upd((p) => { p.rungs[i].branches[bi].push({ kind: "NO", v: "I1" }); })}>＋ {t("plc.contactSeries")}</Btn>
        </div>
      ))}
      <Btn kind="ghost" onClick={() => upd((p) => { p.rungs[i].branches.push([{ kind: "NO", v: "I1" }]); })}>＋ {t("plc.branchAdd")}</Btn>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("plc.output")}><Select value={r.out.kind} className="!w-auto" onChange={(e) => upd((p) => { const k = e.target.value as CoilKind; p.rungs[i].out.kind = k; if (["TON", "TOF", "TP"].includes(k) && !p.rungs[i].out.preset) p.rungs[i].out.preset = 1000; })}>{COILS.map((k) => <option key={k} value={k}>{t(`plc.o.${k}` as "plc.o.OUT")}</option>)}</Select></Field>
        <Field label={t("plc.variable")}><Input value={r.out.v} className="!w-20 font-mono" onChange={(e) => upd((p) => { p.rungs[i].out.v = e.target.value.toUpperCase().slice(0, 4); })} /></Field>
        {(timer || counter) && <Field label={timer ? t("plc.presetMs") : t("plc.presetCount")}><Input inputMode="numeric" value={String(r.out.preset ?? "")} className="!w-28" onChange={(e) => upd((p) => { const v = Number(e.target.value); p.rungs[i].out.preset = Number.isFinite(v) && e.target.value !== "" ? Math.max(0, Math.round(v)) : undefined; })} /></Field>}
        <Field label={t("plc.comment")}><Input value={r.comment ?? ""} onChange={(e) => upd((p) => { p.rungs[i].comment = e.target.value.slice(0, 200) || undefined; })} /></Field>
      </div>
    </div>
  );
}
