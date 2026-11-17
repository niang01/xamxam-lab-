/** Résolution d'un message : anglais/français depuis le catalogue ; wolof UNIQUEMENT depuis les traductions validées. */
import { MESSAGES, type MsgKey } from "./messages";

export type Lang = "wo" | "fr" | "en";
export const LANGS: Lang[] = ["wo", "fr", "en"];

export function fill(s: string, params?: Record<string, string | number>) {
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}

/** `missing` = vrai si le texte wolof validé manque et que la langue de repli a été utilisée. */
export function resolve(key: MsgKey, lang: Lang, fallback: "fr" | "en", wolof: Record<string, string>, params?: Record<string, string | number>): { text: string; missing: boolean } {
  const m = MESSAGES[key];
  if (!m) return { text: String(key), missing: true };
  if (lang === "wo") {
    const w = wolof[key];
    if (w) return { text: fill(w, params), missing: false };
    return { text: fill(m[fallback], params), missing: true };
  }
  return { text: fill(m[lang], params), missing: false };
}
