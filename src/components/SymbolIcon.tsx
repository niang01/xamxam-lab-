"use client";
/** Vignette du symbole conventionnel d'un composant (CEI 60617, ISO 1219, ISA 5.1) ; rien si l'équipement n'a pas de symbole élémentaire. */
import { glyphFor } from "@/lib/symbols";

export function SymbolIcon({ name, code, size = 44 }: { name: string; code: string | null; size?: number }) {
  const g = glyphFor(name, code ?? "");
  if (!g) return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded border border-[var(--line)] font-mono text-[10px] text-[var(--fg-3)]" style={{ width: size, height: size * 0.66 }}>{(code ?? "").slice(0, 4)}</span>;
  return (
    <svg viewBox="-32 -22 64 44" width={size} height={size * 0.69} role="img" aria-label={`${g.title} (${g.norm})`} data-glyph={g.key} className="shrink-0 rounded border border-[var(--line)] bg-[var(--bg-2)]">
      <title>{`${g.title} — ${g.norm}`}</title>
      {g.lines.map((l, i) => <polyline key={i} points={l.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="var(--fg)" strokeWidth={1.6} strokeLinejoin="round" />)}
      {g.texts.map((t, i) => <text key={`t${i}`} x={t.x} y={t.y} fontSize={t.size} textAnchor="middle" fill="var(--fg)">{t.s}</text>)}
    </svg>
  );
}
