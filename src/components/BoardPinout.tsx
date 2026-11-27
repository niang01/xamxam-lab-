"use client";
/** Brochage interactif d'une carte (rendu XAM-XAM LAB à partir des données de src/lib/catalogue/boards.ts). */
import { useState } from "react";
import { FN_COLORS, type BoardPin, type BoardPinout as Board } from "@/lib/catalogue/boards";

const ROW = 30, BW = 230, PAD_X = 28, TAG_W = 96;

function Tag({ x, y, text, color, anchor }: { x: number; y: number; text: string; color: string; anchor: "start" | "end" }) {
  const w = Math.max(54, text.length * 7.2 + 14), x0 = anchor === "end" ? x - w : x;
  return <g><path d={`M${x0 + 6} ${y - 10} H${x0 + w} L${x0 + w - 6} ${y + 10} H${x0} Z`} fill={color} /><text x={x0 + w / 2} y={y + 4} fontSize={11} textAnchor="middle" fill={["#111827", "#475569", "#334155", "#6b7280", "#dc2626", "#2563eb", "#8b5cf6"].includes(color) ? "#fff" : "#0b1020"} fontFamily="monospace" fontWeight="bold">{text}</text></g>;
}

function Side({ pins, side, x, top, hover, setHover }: { pins: BoardPin[]; side: "left" | "right"; x: number; top: number; hover: string | null; setHover: (k: string | null) => void }) {
  const dir = side === "left" ? -1 : 1;
  return <>{pins.map((p, i) => {
    const y = top + i * ROW, k = `${side}${i}`, on = hover === k;
    const dot = p.kind === "input" || p.kind === "power" && p.label === "VIN" ? "#f97316" : p.kind === "io" ? "#5eead4" : p.kind === "control" ? "#f97316" : "#94a3b8";
    const gpioLabel = p.gpio != null && p.kind !== "power" && !/^(A\d|D\d|GP\d)/.test(p.label) ? `GPIO${p.gpio}` : p.kind === "nc" ? "NE PAS CONNECTER" : p.label;
    const fns = [{ type: p.kind === "gnd" ? "GND" : p.kind === "power" ? "POWER" : p.kind === "nc" ? "NC" : "RESET", name: gpioLabel } as const, ...p.fns.filter((f) => f.name !== gpioLabel && !(p.kind === "gnd" || p.kind === "power" || p.kind === "nc"))];
    const tagsX = x + dir * 70;
    return (
      <g key={k} data-pin={p.label} data-kind={p.kind} onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)} style={{ cursor: "default" }} opacity={hover && !on ? 0.45 : 1}>
        <circle cx={x} cy={y} r={8} fill="#d4a017" stroke="#1f2937" strokeWidth={2} /><circle cx={x} cy={y} r={3} fill="#1f2937" />
        <line x1={x + dir * 12} y1={y} x2={x + dir * 52} y2={y} stroke="#64748b" strokeWidth={1.5} />
        {p.pwm && <path d={`M${x + dir * 26} ${y} l${dir * 4} -7 l${dir * 4} 14 l${dir * 4} -7`} fill="none" stroke="#64748b" strokeWidth={1.5} />}
        <circle cx={x + dir * 58} cy={y} r={6} fill="#0b1020" stroke={dot} strokeWidth={3} />
        {fns.map((f, j) => (
          <Tag key={j} x={tagsX + dir * j * (TAG_W + 6)} y={y} text={f.name} anchor={side === "left" ? "end" : "start"}
            color={j === 0 && (p.kind === "io" || p.kind === "input") ? (p.fns.find((x) => x.name === f.name) ? FN_COLORS[p.fns.find((x) => x.name === f.name)!.type] : "#334155") : FN_COLORS[f.type]} />
        ))}
        <title>{`${p.label}${p.gpio != null ? ` — GPIO ${p.gpio}` : ""}${p.kind === "input" ? " — entrée seulement" : ""}${p.pwm ? " — PWM" : ""}${p.fns.length ? ` — ${p.fns.map((f) => f.name).join(", ")}` : ""}`}</title>
      </g>
    );
  })}</>;
}

export function BoardPinout({ board }: { board: Board }) {
  const [hover, setHover] = useState<string | null>(null);
  const n = Math.max(board.left.length, board.right.length);
  const top = 150, H = top + n * ROW + 150, W = 1100, cx = W / 2;
  const used = [...new Set([...board.left, ...board.right].flatMap((p) => p.fns.map((f) => f.type)).filter((t) => !["POWER", "GND", "NC", "RESET"].includes(t)))];
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white" data-testid="board-pinout" data-board={board.key}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 720 }} role="img" aria-label={`Brochage ${board.name}`}>
        <rect x={cx - BW / 2} y={40} width={BW} height={H - 80} rx={26} fill="#0f172a" />
        <rect x={cx - 70} y={52} width={140} height={70} rx={6} fill="#1e293b" stroke="#334155" />
        <text x={cx} y={88} fontSize={13} textAnchor="middle" fill="#e2e8f0" fontFamily="sans-serif">{board.mcu.split(" (")[0]}</text>
        <text x={cx} y={24} fontSize={16} textAnchor="middle" fill="#0f172a" fontWeight="bold" fontFamily="sans-serif">{board.name}</text>
        <text x={cx} y={112} fontSize={10} textAnchor="middle" fill="#94a3b8" fontFamily="sans-serif">{board.manufacturer} · logique {board.logic}</text>
        <rect x={cx - 34} y={H - 62} width={68} height={30} rx={6} fill="#cbd5e1" /><text x={cx} y={H - 42} fontSize={10} textAnchor="middle" fill="#0f172a" fontFamily="sans-serif">{board.usb}</text>
        {board.buttons.map((b, i) => <g key={b}><rect x={cx + (i ? 40 : -100)} y={H - 112} width={60} height={34} rx={5} fill="#334155" /><circle cx={cx + (i ? 70 : -70)} cy={H - 95} r={9} fill="#0f172a" /><text x={cx + (i ? 70 : -70)} y={H - 120} fontSize={10} textAnchor="middle" fill="#e2e8f0" fontFamily="sans-serif">{b.split(" ")[0]}</text></g>)}
        {[...board.left.map((p, i) => [p, cx - BW / 2 + PAD_X, i] as const), ...board.right.map((p, i) => [p, cx + BW / 2 - PAD_X, i] as const)].map(([p, x, i]) => <text key={`s${x}${i}`} x={x + (x < cx ? 16 : -16)} y={top + i * ROW + 4} fontSize={10} textAnchor={x < cx ? "start" : "end"} fill="#e2e8f0" fontFamily="monospace">{p.label.replace(/^GP/, "")}</text>)}
        <Side pins={board.left} side="left" x={cx - BW / 2 + PAD_X} top={top} hover={hover} setHover={setHover} />
        <Side pins={board.right} side="right" x={cx + BW / 2 - PAD_X} top={top} hover={hover} setHover={setHover} />
        <g fontFamily="sans-serif" fontSize={13}>
          <circle cx={40} cy={H - 70} r={6} fill="#0b1020" stroke="#f97316" strokeWidth={3} /><text x={54} y={H - 66}>Entrée seulement</text>
          <circle cx={40} cy={H - 46} r={6} fill="#0b1020" stroke="#5eead4" strokeWidth={3} /><text x={54} y={H - 42}>Entrée / sortie</text>
          <path d="M28 -22 l4 -7 l4 14 l4 -7" transform={`translate(0 ${H})`} fill="none" stroke="#64748b" strokeWidth={1.5} /><text x={54} y={H - 18}>Sortie PWM</text>
          {used.map((t, i) => <Tag key={t} x={W - 30 - ((used.length - 1 - i) % 4) * 70} y={H - 70 + Math.floor((used.length - 1 - i) / 4) * 26} text={t} color={FN_COLORS[t]} anchor="end" />)}
        </g>
      </svg>
    </div>
  );
}
