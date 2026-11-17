"use client";
/**
 * Éditeur de schémas 2D (SVG) : placement, déplacement, rotation, câblage broche à broche, valeurs,
 * nœuds électriques calculés en direct et vérification électrique (ERC) avant toute simulation.
 */
import { useMemo, useRef, useState } from "react";
import { useT } from "./providers";
import { Btn, Field, Input } from "./ui";
import { PART_INFO, erc, nets, type Graph, type Part, type PartType, type WireEnd } from "@/lib/spice/netlist";

const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;

export function pinPos(p: Part, pin: number): [number, number] {
  if (p.type === "GND") return [p.x, p.y - 20];
  const d = pin === 0 ? -40 : 40;
  const r = ((p.rot % 360) + 360) % 360;
  if (r === 0) return [p.x + d, p.y];
  if (r === 90) return [p.x, p.y + d];
  if (r === 180) return [p.x - d, p.y];
  return [p.x, p.y - d];
}

function Symbol({ p, selected }: { p: Part; selected: boolean }) {
  const c = selected ? "var(--cyan)" : "var(--fg)";
  const s = { stroke: c, strokeWidth: 2, fill: "none" } as const;
  if (p.type === "GND") return <g {...s}><line x1={0} y1={-20} x2={0} y2={0} /><line x1={-14} y1={0} x2={14} y2={0} /><line x1={-9} y1={5} x2={9} y2={5} /><line x1={-4} y1={10} x2={4} y2={10} /></g>;
  const body = (() => {
    switch (p.type) {
      case "R": return <polyline points="-20,0 -16,-7 -10,7 -4,-7 2,7 8,-7 14,7 20,0" />;
      case "C": return <><line x1={-4} y1={-12} x2={-4} y2={12} /><line x1={4} y1={-12} x2={4} y2={12} /></>;
      case "L": return <path d="M-20 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0" />;
      case "D": return <><polygon points="-8,-9 -8,9 8,0" /><line x1={8} y1={-9} x2={8} y2={9} /></>;
      case "V": return <><circle r={14} /><text x={-10} y={4} fontSize={11} fill={c} stroke="none">+</text><text x={5} y={4} fontSize={11} fill={c} stroke="none">−</text></>;
      case "I": return <><circle r={14} /><line x1={-8} y1={0} x2={8} y2={0} /><polyline points="3,-4 8,0 3,4" /></>;
    }
  })();
  const lead = p.type === "V" || p.type === "I" ? 14 : p.type === "C" ? 4 : p.type === "D" ? 8 : 20;
  return <g {...s}><line x1={-40} y1={0} x2={-lead} y2={0} /><line x1={lead} y1={0} x2={40} y2={0} />{body}</g>;
}

export function SchematicEditor({ graph, onChange }: { graph: Graph; onChange: (g: Graph) => void }) {
  const t = useT();
  const svg = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [selWire, setSelWire] = useState<number | null>(null);
  const [pending, setPending] = useState<WireEnd | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const nodeMap = useMemo(() => nets(graph), [graph]);
  const issues = useMemo(() => erc(graph), [graph]);
  const selected = graph.parts.find((p) => p.id === sel) ?? null;

  const toSvg = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const vb = svg.current!.viewBox.baseVal;
    return [((e.clientX - r.left) / r.width) * vb.width, ((e.clientY - r.top) / r.height) * vb.height];
  };

  function add(type: PartType) {
    const used = new Set(graph.parts.map((p) => p.id));
    const prefix = type === "GND" ? "G" : type;
    let n = 1; while (used.has(`${prefix}${n}`)) n++;
    const id = `${prefix}${n}`;
    const p: Part = { id, type, x: snap(120 + (graph.parts.length % 6) * 100), y: snap(100 + Math.floor(graph.parts.length / 6) * 100), rot: 0, value: PART_INFO[type].defaultValue };
    onChange({ ...graph, parts: [...graph.parts, p] });
    setSel(id); setSelWire(null);
  }
  function update(id: string, patch: Partial<Part>) { onChange({ ...graph, parts: graph.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }); }
  function removeSel() {
    if (selWire != null) { onChange({ ...graph, wires: graph.wires.filter((_, i) => i !== selWire) }); setSelWire(null); return; }
    if (!sel) return;
    onChange({ parts: graph.parts.filter((p) => p.id !== sel), wires: graph.wires.filter((w) => w.a.part !== sel && w.b.part !== sel) });
    setSel(null);
  }
  function clickPin(part: string, pin: number) {
    if (!pending) { setPending({ part, pin }); return; }
    if (pending.part === part && pending.pin === pin) { setPending(null); return; }
    const exists = graph.wires.some((w) => (w.a.part === pending.part && w.a.pin === pending.pin && w.b.part === part && w.b.pin === pin) || (w.b.part === pending.part && w.b.pin === pending.pin && w.a.part === part && w.a.pin === pin));
    if (!exists) onChange({ ...graph, wires: [...graph.wires, { a: pending, b: { part, pin } }] });
    setPending(null);
  }

  const byId = new Map(graph.parts.map((p) => [p.id, p]));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label={t("sch.palette")}>
        {(Object.keys(PART_INFO) as PartType[]).map((k) => <Btn key={k} kind="ghost" data-add={k} onClick={() => add(k)} title={PART_INFO[k].label}>+ {PART_INFO[k].label}</Btn>)}
        <Btn kind="ghost" disabled={!sel} onClick={() => selected && update(selected.id, { rot: (selected.rot + 90) % 360 })}>⟳ {t("sch.rotate")}</Btn>
        <Btn kind="danger" disabled={!sel && selWire == null} onClick={removeSel}>{t("c.delete")}</Btn>
      </div>
      <p className="text-xs text-[var(--fg-3)]">{pending ? t("sch.wiring", { pin: `${pending.part}.${pending.pin + 1}` }) : t("sch.help")}</p>
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <svg ref={svg} viewBox="0 0 900 520" data-testid="schematic-canvas" className="grid-bg w-full touch-none rounded-lg border border-[var(--line)] bg-[var(--bg-2)]"
          onPointerMove={(e) => { if (!drag.current) return; const [x, y] = toSvg(e); update(drag.current.id, { x: snap(x - drag.current.dx), y: snap(y - drag.current.dy) }); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerDown={(e) => { if (e.target === svg.current) { setSel(null); setSelWire(null); setPending(null); } }}>
          {graph.wires.map((w, i) => {
            const a = byId.get(w.a.part), b = byId.get(w.b.part);
            if (!a || !b) return null;
            const [x1, y1] = pinPos(a, w.a.pin), [x2, y2] = pinPos(b, w.b.pin);
            return <path key={i} data-wire={i} d={`M${x1} ${y1} L${x2} ${y1} L${x2} ${y2}`} fill="none" stroke={selWire === i ? "var(--cyan)" : "var(--ok)"} strokeWidth={selWire === i ? 3 : 2}
              onPointerDown={(e) => { e.stopPropagation(); setSelWire(i); setSel(null); }} className="cursor-pointer" />;
          })}
          {graph.parts.map((p) => (
            <g key={p.id} data-part={p.id}>
              <g transform={`translate(${p.x} ${p.y}) rotate(${p.type === "GND" ? 0 : p.rot})`} className="cursor-move"
                onPointerDown={(e) => { e.stopPropagation(); const [x, y] = toSvg(e); drag.current = { id: p.id, dx: x - p.x, dy: y - p.y }; setSel(p.id); setSelWire(null); }}>
                <rect x={-42} y={-18} width={84} height={36} fill="transparent" />
                <Symbol p={p} selected={sel === p.id} />
              </g>
              <text x={p.x} y={p.y - 22} fontSize={11} textAnchor="middle" fill="var(--fg-2)">{p.type === "GND" ? "0" : `${p.id} ${p.value}`}</text>
              {Array.from({ length: PART_INFO[p.type].pins }, (_, pin) => {
                const [x, y] = pinPos(p, pin);
                const active = pending?.part === p.id && pending.pin === pin;
                return (
                  <g key={pin}>
                    <circle data-pin={`${p.id}:${pin}`} cx={x} cy={y} r={6} fill={active ? "var(--cyan)" : "var(--panel-2)"} stroke="var(--cyan)" strokeWidth={1.5} className="cursor-crosshair"
                      onPointerDown={(e) => { e.stopPropagation(); clickPin(p.id, pin); }} />
                    {p.type !== "GND" && <text x={x + 7} y={y + 14} fontSize={9} fill="var(--violet)">{nodeMap.get(`${p.id}:${pin}`)}</text>}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
        <div className="space-y-3">
          {selected ? (
            <div className="space-y-2 rounded-lg border border-[var(--line)] p-3 text-sm" data-testid="inspector">
              <div className="font-semibold">{selected.id} — {PART_INFO[selected.type].label}</div>
              {selected.type !== "GND" && selected.type !== "D" && <Field label={t("c.value")} hint={PART_INFO[selected.type].unitHint}><Input name="part-value" value={selected.value} onChange={(e) => update(selected.id, { value: e.target.value })} /></Field>}
              {selected.type === "D" && <p className="text-xs text-[var(--fg-3)]">{PART_INFO.D.unitHint}. {t("sch.diodeModel")}</p>}
            </div>
          ) : <p className="text-xs text-[var(--fg-3)]">{t("sch.selectHint")}</p>}
          <div className="rounded-lg border border-[var(--line)] p-3 text-sm" data-testid="erc">
            <div className="mb-1 font-semibold">{t("sch.erc")}</div>
            {!issues.length ? <p className="text-[var(--ok)]">✓ {t("sch.ercOk")}</p> : (
              <ul className="space-y-1 text-xs">{issues.map((i, k) => <li key={k} className={i.level === "error" ? "text-[var(--danger)]" : "text-[var(--warn)]"}>{i.level === "error" ? "✕" : "!"} {i.message}</li>)}</ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
