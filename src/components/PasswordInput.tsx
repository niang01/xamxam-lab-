"use client";
/**
 * Champ de mot de passe avec bouton « œil » : affichage temporaire, contrôlé par l'utilisateur (re-masqué
 * automatiquement après 30 s, à la soumission du formulaire et quand la page est quittée). Le texte n'est jamais
 * mémorisé hors du champ, ni journalisé. Indicateurs facultatifs : robustesse et concordance avec la confirmation.
 */
import { useEffect, useId, useState, type InputHTMLAttributes } from "react";
import { useT } from "./providers";
import { inputCls } from "./ui";
import { passwordStrength } from "@/lib/password";
import type { MsgKey } from "@/lib/i18n/messages";

const REVEAL_MS = 30_000;

function Eye({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export function PasswordInput({ strength = false, value, className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { value: string; strength?: boolean }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const hintId = useId();
  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(false), REVEAL_MS);
    const hide = () => setShown(false);
    window.addEventListener("pagehide", hide);
    document.addEventListener("submit", hide, true);
    document.addEventListener("visibilitychange", hide);
    return () => { clearTimeout(id); window.removeEventListener("pagehide", hide); document.removeEventListener("submit", hide, true); document.removeEventListener("visibilitychange", hide); };
  }, [shown]);
  const s = strength ? passwordStrength(value) : null;
  const colors = ["var(--danger)", "var(--danger)", "var(--warn)", "var(--cyan)", "var(--ok)"];
  return (
    <div>
      <div className="relative">
        <input {...p} value={value} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-describedby={s ? hintId : p["aria-describedby"]} className={`${inputCls} pr-11 ${className ?? ""}`}
          onInvalid={(e) => { setShown(false); p.onInvalid?.(e); }} />
        <button type="button" data-testid="pw-toggle" aria-pressed={shown} aria-label={shown ? t("pw.hide") : t("pw.show")} title={shown ? t("pw.hide") : t("pw.show")}
          onClick={() => setShown((x) => !x)} onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[var(--fg-2)] hover:text-[var(--cyan)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]">
          <Eye open={shown} />
        </button>
      </div>
      {s && value && (
        <div id={hintId} className="mt-1.5" data-testid="pw-strength" data-score={s.score} aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">{[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= Math.max(1, s.score) ? colors[s.score] : "var(--line)" }} />)}</div>
          <p className="mt-1 text-xs" style={{ color: colors[s.score] }}>{t(`pw.strength.${s.key}` as MsgKey)}{s.tips.length > 0 && <span className="text-[var(--fg-3)]"> — {s.tips.map((x) => t(`pw.tip.${x}` as MsgKey)).join(" ; ")}</span>}</p>
        </div>
      )}
    </div>
  );
}

/** Indicateur de concordance entre le mot de passe et sa confirmation. */
export function PasswordMatch({ a, b }: { a: string; b: string }) {
  const t = useT();
  if (!b) return null;
  const same = a === b;
  return <p data-testid="pw-match" data-match={same} aria-live="polite" className={`mt-1 text-xs ${same ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{same ? `✓ ${t("pw.matchOk")}` : `✗ ${t("pw.mismatch")}`}</p>;
}
