"use client";
/**
 * Éditeur de schémas 2D multidisciplines : blocs de la bibliothèque, déplacement au doigt ou à la souris, rotation,
 * liaisons broche à broche, paramètres avec unités, annotations, vérification, enregistrement versionné,
 * exports SVG / PNG / JSON et report dans la nomenclature du projet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, Pill, Select } from "./ui";
import { ProjectPicker } from "./ProjectPicker";
import { useData } from "@/lib/client/hooks";
import { api, post, put } from "@/lib/client/api";
import { BLOCK_W, blockHeight, bomOf, checkDiagram, diagramSvg, nextLabel, pinPoint, type Block, type Diagram } from "@/lib/diagram";
import { DISCIPLINE_LABEL, type Discipline } from "@/lib/library";

type Comp = { id: string; name: string; symbol2d: string | null; pins: string[]; params: { key: string; label: string; unit: string }[]; discipline: string | null; category: string };
const EMPTY: Diagram = { discipline: "general", blocks: [], wires: [], notes: [] };
const uid = () => Math.random().toString(36).slice(2, 10);

function download(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export function DiagramEditor() {
  const { t } = useApp();
  const [d, setD] = useState<Diagram>(EMPTY);
  const [title, setTitle] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [pid, setPid] = useState("");
  const [disc, setDisc] = useState("");
  const [q, setQ] = useState("");
  const { data: lib } = useData<{ items: Comp[] }>(`/api/components?q=${encodeURIComponent(q)}${disc ? `&discipline=${disc}` : ""}`);
  const { data: saved, reload: reloadSaved } = useData<{ items: { id: string; title: string; version: number; project_title: string | null }[] }>("/api/diagrams");
  const [sel, setSel] = useState<string | null>(null);
  const [selWire, setSelWire] = useState<number | null>(null);
  const [pending, setPending] = useState<{ block: string; pin: number } | null>(null);
  const [view, setView] = useState({ x: -400, y: -300, w: 800, h: 600 });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState<unknown>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const check = useMemo(() => checkDiagram(d), [d]);
  const selected = d.blocks.find((b) => b.id === sel) ?? null;

  const addComponent = useCallback((c: Comp) => {
    setD((x) => {
      const symbol = c.symbol2d ?? "X";
      const b: Block = { id: uid(), component_id: c.id, name: c.name, symbol, label: nextLabel(x, symbol), pins: c.pins.length ? c.pins.slice(0, 60) : ["1", "2"], x: Math.round((view.x + view.w / 2) / 20) * 20, y: Math.round((view.y + view.h / 2) / 20) * 20 + x.blocks.length * 20 % 200, rot: 0, params: Object.fromEntries(c.params.map((p) => [p.key, ""])), meta: c.params };
      setSel(b.id);
      return { ...x, discipline: x.blocks.length ? x.discipline : (c.discipline ?? "general"), blocks: [...x.blocks, b] };
    });
  }, [view]);

  // Ajout depuis la bibliothèque (?ajout=<id>) ou ouverture (?schema=<id>)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const add = sp.get("ajout"), open = sp.get("schema");
    if (open) void openDiagram(open);
    else if (add) api<{ items: Comp[] }>(`/api/components?q=`).then((r) => { const c = r.items.find((x) => x.id === add); if (c) addComponent(c); }).catch(setErr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDiagram(sid: string) {
    try { const r = await api<{ id: string; title: string; graph: Diagram; project_id: string | null }>(`/api/diagrams/${sid}`); setD(r.graph); setTitle(r.title); setId(r.id); setPid(r.project_id ?? ""); setSel(null); setMsg(""); } catch (e) { setErr(e); }
  }
  const toSvgPoint = (e: React.PointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y] as const;
  };
  const onPinClick = (block: string, pin: number) => {
    if (!pending) { setPending({ block, pin }); return; }
    if (pending.block !== block || pending.pin !== pin) setD((x) => ({ ...x, wires: [...x.wires, { a: pending, b: { block, pin } }] }));
    setPending(null);
  };
  const updateSel = (patch: Partial<Block>) => setD((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === sel ? { ...b, ...patch } : b)) }));
  async function save() {
    setErr(null); setMsg("");
    try {
      if (id) { const r = await put<{ version: number }>(`/api/diagrams/${id}`, { title: title || t("dia.untitled"), graph: d }); setMsg(t("dia.savedV", { v: r.version })); }
      else { const r = await post<{ id: string }>("/api/diagrams", { title: title || t("dia.untitled"), graph: d, project_id: pid || null }); setId(r.id); setMsg(t("dia.savedV", { v: 1 })); }
      reloadSaved();
    } catch (e) { setErr(e); }
  }
  async function exportPng() {
    const s = diagramSvg(d, title);
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = img.width * 2 || 1600; c.height = img.height * 2 || 1200; const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => b && download(`${title || "schema"}.png`, b)); };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
  }
  async function toBom() {
    if (!pid) { setErr(new Error(t("dia.needProject"))); return; }
    try { await post(`/api/projects/${pid}/components`, { items: bomOf(d).map((l) => ({ component_id: l.component_id, name: l.name, qty: l.qty, note: l.labels.join(", ") })) }); setMsg(t("dia.bomDone")); } catch (e) { setErr(e); }
  }
  const zoom = (f: number) => setView((v) => ({ x: v.x + (v.w * (1 - f)) / 2, y: v.y + (v.h * (1 - f)) / 2, w: v.w * f, h: v.h * f }));
  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx * v.w, y: v.y + dy * v.h }));
  const byId = new Map(d.blocks.map((b) => [b.id, b]));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("c.title")}><Input name="diagram-title" value={title} onChange={(e) => setTitle(e.target.value)} className="!w-56" /></Field>
          <ProjectPicker value={pid} onChange={setPid} />
          <Btn onClick={save} data-testid="diagram-save">{t("c.save")}</Btn>
          <Btn kind="ghost" onClick={() => { setD(EMPTY); setId(null); setTitle(""); setSel(null); }}>{t("dia.new")}</Btn>
          <Select aria-label={t("dia.open")} value="" onChange={(e) => e.target.value && openDiagram(e.target.value)} className="!w-auto"><option value="">{t("dia.open")}…</option>{saved?.items.map((s) => <option key={s.id} value={s.id}>{s.title} (v{s.version}){s.project_title ? ` · ${s.project_title}` : ""}</option>)}</Select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Btn kind="ghost" onClick={() => download(`${title || "schema"}.svg`, new Blob([diagramSvg(d, title)], { type: "image/svg+xml" }))} data-testid="export-svg">SVG</Btn>
          <Btn kind="ghost" onClick={exportPng}>PNG</Btn>
          <Btn kind="ghost" onClick={() => download(`${title || "schema"}.json`, new Blob([JSON.stringify({ title, graph: d }, null, 2)], { type: "application/json" }))}>JSON</Btn>
          <Btn kind="ghost" onClick={toBom} data-testid="diagram-bom">{t("dia.toBom")}</Btn>
          {msg && <Pill tone="ok">{msg}</Pill>}
        </div>
        <ErrorBox error={err} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card title={t("nav.components")}>
          <Select aria-label={t("comp.discipline")} name="palette-discipline" value={disc} onChange={(e) => setDisc(e.target.value)} className="mb-2"><option value="">{t("comp.allDisciplines")}</option>{Object.entries(DISCIPLINE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Input aria-label={t("c.search")} placeholder={t("c.search")} value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto text-sm" data-testid="palette">{lib?.items.slice(0, 120).map((c) => (
            <li key={c.id}><button className="w-full rounded px-2 py-1 text-left hover:bg-[var(--panel-2)]" data-palette={c.name} onClick={() => addComponent(c)}>＋ {c.name} <span className="text-xs text-[var(--fg-3)]">{c.discipline ? DISCIPLINE_LABEL[c.discipline as Discipline] : c.category}</span></button></li>))}</ul>
        </Card>
        <div className="space-y-3">
          <Card>
            <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
              <Btn kind="ghost" onClick={() => zoom(0.8)} aria-label="zoom +">＋</Btn><Btn kind="ghost" onClick={() => zoom(1.25)} aria-label="zoom −">−</Btn>
              <Btn kind="ghost" onClick={() => pan(-0.2, 0)} aria-label="←">←</Btn><Btn kind="ghost" onClick={() => pan(0.2, 0)} aria-label="→">→</Btn><Btn kind="ghost" onClick={() => pan(0, -0.2)} aria-label="↑">↑</Btn><Btn kind="ghost" onClick={() => pan(0, 0.2)} aria-label="↓">↓</Btn>
              {selected && <><Btn kind="ghost" onClick={() => updateSel({ rot: ((selected.rot + 90) % 360) as Block["rot"] })} data-testid="rotate">⟳ {t("dia.rotate")}</Btn><Btn kind="danger" onClick={() => { setD((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== sel), wires: x.wires.filter((w) => w.a.block !== sel && w.b.block !== sel) })); setSel(null); }}>{t("c.delete")}</Btn></>}
              {selWire != null && <Btn kind="danger" onClick={() => { setD((x) => ({ ...x, wires: x.wires.filter((_, i) => i !== selWire) })); setSelWire(null); }}>{t("dia.deleteWire")}</Btn>}
              <Btn kind="ghost" onClick={() => { const text = prompt(t("dia.noteText")); if (text) setD((x) => ({ ...x, notes: [...x.notes, { x: Math.round(view.x + 20), y: Math.round(view.y + 40 + x.notes.length * 20), text: text.slice(0, 300) }] })); }}>{t("dia.note")}</Btn>
              {pending && <Pill tone="info">{t("dia.pickSecond")}</Pill>}
            </div>
            <svg ref={svg} data-testid="diagram-canvas" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="h-[55vh] w-full touch-none rounded-lg border border-[var(--line)] bg-[var(--bg-2)]"
              onPointerMove={(e) => { if (!drag.current) return; const [x, y] = toSvgPoint(e); const g = drag.current; setD((dd) => ({ ...dd, blocks: dd.blocks.map((b) => (b.id === g.id ? { ...b, x: Math.round((x - g.dx) / 10) * 10, y: Math.round((y - g.dy) / 10) * 10 } : b)) })); }}
              onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
              onPointerDown={(e) => { if (e.target === svg.current) { setSel(null); setSelWire(null); setPending(null); } }}>
              <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--line)" strokeWidth="0.5" /></pattern></defs>
              <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#grid)" pointerEvents="none" />
              {d.wires.map((w, i) => { const a = byId.get(w.a.block), b = byId.get(w.b.block); if (!a || !b) return null; const [x1, y1] = pinPoint(a, w.a.pin), [x2, y2] = pinPoint(b, w.b.pin); const mx = (x1 + x2) / 2;
                return <polyline key={i} data-wire={i} points={`${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={selWire === i ? "var(--warn)" : "var(--cyan)"} strokeWidth={selWire === i ? 4 : 2} onPointerDown={(e) => { e.stopPropagation(); setSelWire(i); setSel(null); }} />; })}
              {d.blocks.map((b) => { const h = blockHeight(b); return (
                <g key={b.id} data-block={b.label}>
                  <g transform={`rotate(${b.rot} ${b.x} ${b.y})`} onPointerDown={(e) => { e.stopPropagation(); const [x, y] = toSvgPoint(e); drag.current = { id: b.id, dx: x - b.x, dy: y - b.y }; setSel(b.id); setSelWire(null); }}>
                    <rect x={b.x - BLOCK_W / 2} y={b.y - h / 2} width={BLOCK_W} height={h} rx={6} fill="var(--panel)" stroke={sel === b.id ? "var(--cyan)" : "var(--fg-2)"} strokeWidth={sel === b.id ? 2.5 : 1.5} />
                  </g>
                  <text x={b.x} y={b.y - 4} textAnchor="middle" fontSize={12} fontWeight="bold" fill="var(--fg)" pointerEvents="none">{b.label}</text>
                  <text x={b.x} y={b.y + 12} textAnchor="middle" fontSize={9} fill="var(--fg-3)" pointerEvents="none">{b.name.slice(0, 22)}</text>
                  {b.pins.map((p, i) => { const [px, py] = pinPoint(b, i); const on = pending?.block === b.id && pending.pin === i; return (
                    <g key={i} data-pin={`${b.label}.${p}`} onPointerDown={(e) => { e.stopPropagation(); onPinClick(b.id, i); }} style={{ cursor: "crosshair" }}>
                      <circle cx={px} cy={py} r={on ? 7 : 5} fill={on ? "var(--warn)" : "var(--cyan)"} /><text x={px} y={py - 8} textAnchor="middle" fontSize={8} fill="var(--fg-2)" pointerEvents="none">{p}</text>
                    </g>); })}
                </g>); })}
              {d.notes.map((n, i) => <text key={i} x={n.x} y={n.y} fontSize={11} fill="var(--fg-2)">{n.text}</text>)}
            </svg>
            <p className="mt-1 text-xs text-[var(--fg-3)]">{t("dia.help")}</p>
          </Card>
          {selected && (
            <Card title={`${selected.label} — ${selected.name}`} testId="block-props">
              <div className="grid gap-2 md:grid-cols-3">
                <Field label={t("dia.label")}><Input name="block-label" value={selected.label} onChange={(e) => updateSel({ label: e.target.value.slice(0, 40) })} /></Field>
                {(selected.meta ?? Object.keys(selected.params).map((k) => ({ key: k, label: k, unit: "" }))).map((m) => (
                  <Field key={m.key} label={`${m.label}${m.unit ? ` (${m.unit})` : ""}`}><Input name={`param-${m.key}`} value={selected.params[m.key] ?? ""} onChange={(e) => updateSel({ params: { ...selected.params, [m.key]: e.target.value.slice(0, 80) } })} /></Field>
                ))}
              </div>
            </Card>
          )}
          <Card title={t("dia.check")} testId="diagram-check">
            <p className="text-sm">{check.errors.length ? <Pill tone="danger">{t("dia.errors", { n: check.errors.length })}</Pill> : <Pill tone="ok">{t("dia.noError")}</Pill>} <span className="text-xs text-[var(--fg-3)]">{t("dia.stats", { b: d.blocks.length, w: d.wires.length, n: check.nets })}</span></p>
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs">{check.errors.map((x, i) => <li key={`e${i}`} className="text-[var(--danger)]">{x}</li>)}{check.warnings.slice(0, 30).map((x, i) => <li key={`w${i}`} className="text-[var(--warn)]">{x}</li>)}</ul>
            <p className="mt-2 text-xs text-[var(--fg-3)]">{t("dia.notSim")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
