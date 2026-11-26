"use client";
/** Composants d'interface partagés (identité XAM-XAM : noir profond, bleu technologique, cyan, violet, vert). */
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useT } from "./providers";
import { usePathname, useRouter } from "next/navigation";
import { RequestError } from "@/lib/client/api";
import { MESSAGES, type MsgKey } from "@/lib/i18n/messages";
import type { CalcResult } from "@/lib/eng/result";

/** Rubrique parente d'un chemin (« /dimensionnement/pompage » → « /dimensionnement », « /lab/iot » → « /lab »). */
export function parentPath(path: string): string {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  return parts.length <= 1 ? "/" : `/${parts.slice(0, -1).join("/")}`;
}

/** Commande « Retour » : page précédente de la navigation, sinon rubrique parente (page ouverte depuis un lien). */
export function BackButton({ href, onBack }: { href?: string; onBack?: () => void }) {
  const t = useT();
  const router = useRouter();
  const path = usePathname() ?? "/";
  if (path === "/" && !href && !onBack) return null;
  const go = () => {
    if (onBack) { onBack(); return; }
    if (href) { router.push(href); return; }
    const internal = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin) && window.history.length > 1;
    if (internal) router.back(); else router.push(parentPath(path));
  };
  return (
    <button type="button" onClick={go} data-testid="back" aria-label={t("c.back")}
      className="mb-3 inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--fg-2)] hover:border-[var(--cyan)] hover:text-[var(--fg)]">
      <span aria-hidden>←</span>{t("c.back")}
    </button>
  );
}

/** `onBack` : une vue détaillée ouverte dans la page est d'abord refermée par « Retour ». */
export function Page({ title, subtitle, actions, children, back, onBack }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; back?: string | false; onBack?: () => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      {back !== false && <BackButton href={back || undefined} onBack={onBack} />}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)] md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-[var(--fg-2)]">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function Card({ title, children, className = "", actions, testId }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className={`holo rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 md:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ kind = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "danger" | "ok" }) {
  const k = {
    primary: "bg-[var(--tech)] text-white hover:brightness-110",
    ghost: "border border-[var(--line)] text-[var(--fg)] hover:bg-[var(--panel-2)]",
    danger: "bg-[var(--danger)] text-white hover:brightness-110",
    ok: "bg-[var(--ok)] text-black hover:brightness-110",
  }[kind];
  return <button {...p} className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${k} ${className}`} />;
}

export const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--cyan)]";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${inputCls} ${p.className ?? ""}`} />;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--fg-2)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--fg-3)]">{hint}</span>}
    </label>
  );
}

const NATURE_STYLE: Record<string, string> = {
  measurement: "border-[var(--ok)] text-[var(--ok)]",
  calculation: "border-[var(--cyan)] text-[var(--cyan)]",
  simulation: "border-[var(--violet)] text-[var(--violet)]",
  prediction: "border-[var(--warn)] text-[var(--warn)]",
  modelled: "border-[var(--tech)] text-[var(--tech-2)]",
  demo: "border-[var(--warn)] text-[var(--warn)]",
  simulated: "border-[var(--warn)] text-[var(--warn)]",
  recommendation: "border-[var(--fg-2)] text-[var(--fg-2)]",
  animation: "border-[var(--fg-3)] text-[var(--fg-3)]",
};
export function Nature({ kind, title }: { kind: keyof typeof NATURE_STYLE; title?: string }) {
  const t = useT();
  return <span title={title} data-nature={kind} className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${NATURE_STYLE[kind]}`}>{t(`nature.${kind}` as MsgKey)}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "info" }) {
  const c = { neutral: "bg-[var(--panel-2)] text-[var(--fg-2)]", ok: "bg-[color-mix(in_srgb,var(--ok)_20%,transparent)] text-[var(--ok)]", warn: "bg-[color-mix(in_srgb,var(--warn)_20%,transparent)] text-[var(--warn)]", danger: "bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] text-[var(--danger)]", info: "bg-[color-mix(in_srgb,var(--cyan)_15%,transparent)] text-[var(--cyan)]" }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${c}`}>{children}</span>;
}

/** Fonctionnalité non disponible : raison et phase prévue, jamais de bouton décoratif. */
export function Unavailable({ title, reason, phase }: { title: string; reason: string; phase?: number }) {
  const t = useT();
  return (
    <div data-testid="unavailable" className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-2)] p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Pill tone="warn">{t("c.unavailable")}</Pill><strong className="text-[var(--fg)]">{title}</strong>{phase && <span className="text-xs text-[var(--fg-3)]">{t("c.phase", { n: phase })}</span>}</div>
      <p className="mt-2 text-[var(--fg-2)]">{reason}</p>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const t = useT();
  if (!error) return null;
  const e = error as RequestError;
  const msg = e?.key && e.key in MESSAGES ? t(e.key as MsgKey) : (e?.message ?? String(error));
  const details = Array.isArray(e?.details) ? (e.details as { path?: string; message?: string }[]) : null;
  return (
    <div role="alert" className="rounded-lg border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-sm text-[var(--fg)]">
      {msg}{e?.key && e.key in MESSAGES && e.message && t(e.key as MsgKey) !== e.message ? <span className="block text-xs text-[var(--fg-2)]">{e.message}</span> : null}
      {details && <ul className="mt-1 list-disc pl-5 text-xs">{details.map((d, i) => <li key={i}>{d.path ? `${d.path} : ` : ""}{d.message ?? String(d)}</li>)}</ul>}
    </div>
  );
}

/** Affichage normalisé d'un résultat de calcul : valeurs, formules, hypothèses, références, paramètres manquants. */
export function CalcView({ r, testId }: { r: CalcResult | null; testId?: string }) {
  const t = useT();
  if (!r) return null;
  return (
    <div data-testid={testId ?? "calc-result"} className="space-y-3 text-sm">
      <div className="flex items-center gap-2"><Nature kind="calculation" />{!r.ok && <Pill tone="warn">{t("c.missing")}</Pill>}</div>
      {r.missing.length > 0 && <ul className="list-disc pl-5 text-[var(--warn)]">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
      {Object.keys(r.outputs).length > 0 && (
        <table className="w-full text-left">
          <tbody>
            {Object.entries(r.outputs).map(([k, v]) => (
              <tr key={k} className="border-b border-[var(--line)]"><td className="py-1 pr-3 text-[var(--fg-2)]">{v.label}</td><td className="py-1 font-mono text-[var(--fg)]" data-out={k}>{v.value.toLocaleString("fr-FR", { maximumSignificantDigits: 6 })} {v.unit}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {[["c.formulas", r.formulas], ["c.assumptions", r.assumptions], ["c.references", r.references], ["c.warnings", r.warnings]].map(([k, list]) =>
        (list as string[]).length ? <div key={k as string}><div className="text-xs uppercase tracking-wide text-[var(--fg-3)]">{t(k as MsgKey)}</div><ul className="list-disc pl-5 text-[var(--fg-2)]">{(list as string[]).map((x) => <li key={x} className={k === "c.formulas" ? "font-mono text-xs" : ""}>{x}</li>)}</ul></div> : null)}
    </div>
  );
}

export interface Series { name: string; x: number[]; y: number[]; color?: string; dashed?: boolean }
const PALETTE = ["#22E3FF", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444", "#1E5BFF"];

/** Graphique en lignes SVG (pas de bibliothèque externe), échelle automatique, axe X log optionnel. */
export function LineChart({ series, xLabel, yLabel, logX = false, height = 260 }: { series: Series[]; xLabel?: string; yLabel?: string; logX?: boolean; height?: number }) {
  const W = 720, H = height, L = 56, R = 12, T = 12, B = 36;
  const fx = (v: number) => (logX ? Math.log10(Math.max(v, 1e-30)) : v);
  const xs = series.flatMap((s) => s.x.map(fx)), ys = series.flatMap((s) => s.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  if (y0 === y1) { y0 -= Math.abs(y0) * 0.1 || 1; y1 += Math.abs(y1) * 0.1 || 1; }
  const pad = (y1 - y0) * 0.05; y0 -= pad; y1 += pad;
  const sx = (v: number) => L + ((fx(v) - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = (a: number, b: number) => Array.from({ length: 5 }, (_, i) => a + ((b - a) * i) / 4);
  const fmt = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(1) : Number(v.toPrecision(3)).toString());
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel}>
        {ticks(y0, y1).map((v) => <g key={`y${v}`}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={0.5} /><text x={L - 4} y={sy(v) + 3} fontSize={10} textAnchor="end" fill="var(--fg-3)">{fmt(v)}</text></g>)}
        {ticks(x0, x1).map((v) => <text key={`x${v}`} x={L + ((v - x0) / (x1 - x0)) * (W - L - R)} y={H - B + 14} fontSize={10} textAnchor="middle" fill="var(--fg-3)">{fmt(logX ? 10 ** v : v)}</text>)}
        {series.map((s, i) => (
          <polyline key={s.name} fill="none" stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={1.8} strokeDasharray={s.dashed ? "5 4" : undefined}
            points={s.x.map((x, j) => (Number.isFinite(s.y[j]) ? `${sx(x).toFixed(1)},${sy(s.y[j]).toFixed(1)}` : "")).filter(Boolean).join(" ")} />
        ))}
        {xLabel && <text x={(L + W - R) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--fg-2)">{xLabel}</text>}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--fg-2)]">
        {series.map((s, i) => <span key={s.name} className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />{s.name}</span>)}
        {yLabel && <span className="text-[var(--fg-3)]">({yLabel})</span>}
      </figcaption>
    </figure>
  );
}

/** Champ numérique optionnel : chaîne vide → null (paramètre manquant signalé, jamais remplacé par une valeur par défaut). */
export const num = (s: string): number | null => { const v = s.trim().replace(",", "."); if (!v) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
