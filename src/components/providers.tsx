"use client";
/** Contexte global : utilisateur connecté, langue (WO/FR/EN), traductions wolof validées, fonction t(). */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, patch } from "@/lib/client/api";
import { resolve, type Lang } from "@/lib/i18n/runtime";
import { MSG_KEYS, type MsgKey } from "@/lib/i18n/messages";

export interface Me {
  id: string; email: string; display_name: string; profile_kind: string; is_admin: boolean; locale: Lang; fallback_locale: "fr" | "en";
  autonomy_level: number; public_profile: boolean; country: string | null; bio: string | null; skills: string[]; clearances: string[]; capabilities: string[];
}

interface Ctx {
  me: Me | null; meLoaded: boolean; refreshMe: () => Promise<void>;
  lang: Lang; fallback: "fr" | "en"; setLang: (l: Lang) => void; setFallback: (l: "fr" | "en") => void;
  t: (key: MsgKey, params?: Record<string, string | number>) => string;
  wolofCount: number; totalKeys: number;
}

const C = createContext<Ctx | null>(null);

function stored<T extends string>(k: string, allowed: readonly T[], d: T): T {
  try { const v = localStorage.getItem(k) as T | null; return v && allowed.includes(v) ? v : d; } catch { return d; }
}

export function Providers({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  // Wolof = langue de référence (sélection par défaut). Le choix est conservé localement et sur le compte.
  const [lang, setLangState] = useState<Lang>("wo");
  const [fallback, setFallbackState] = useState<"fr" | "en">("fr");
  const [wolof, setWolof] = useState<Record<string, string>>({});

  useEffect(() => {
    // Lecture de la préférence locale après le montage (évite toute différence de rendu serveur/client).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(stored("xx.lang", ["wo", "fr", "en"] as const, "wo"));
    setFallbackState(stored("xx.fallback", ["fr", "en"] as const, "fr"));
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const r = await api<{ user: Me | null }>("/api/auth/me");
      setMe(r.user);
      if (r.user) {
        setLangState(r.user.locale); setFallbackState(r.user.fallback_locale);
        try { localStorage.setItem("xx.lang", r.user.locale); localStorage.setItem("xx.fallback", r.user.fallback_locale); } catch { /* stockage indisponible */ }
      }
    } catch { setMe(null); } finally { setMeLoaded(true); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec une source externe (URL, session, WebGL)
  useEffect(() => { void refreshMe(); }, [refreshMe]);

  useEffect(() => {
    api<{ entries: Record<string, string> }>("/api/i18n/catalog?lang=wo").then((r) => setWolof(r.entries)).catch(() => setWolof({}));
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // PWA : service worker (cache réseau d'abord, réponses hors ligne signalées).
  useEffect(() => { if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("xx.lang", l); } catch { /* ignore */ }
    if (me) void patch("/api/me", { locale: l }).catch(() => undefined);
  }, [me]);
  const setFallback = useCallback((l: "fr" | "en") => {
    setFallbackState(l);
    try { localStorage.setItem("xx.fallback", l); } catch { /* ignore */ }
    if (me) void patch("/api/me", { fallback_locale: l }).catch(() => undefined);
  }, [me]);

  const t = useCallback((key: MsgKey, params?: Record<string, string | number>) => resolve(key, lang, fallback, wolof, params).text, [lang, fallback, wolof]);
  const wolofCount = useMemo(() => MSG_KEYS.filter((k) => wolof[k]).length, [wolof]);

  const value = useMemo(() => ({ me, meLoaded, refreshMe, lang, fallback, setLang, setFallback, t, wolofCount, totalKeys: MSG_KEYS.length }), [me, meLoaded, refreshMe, lang, fallback, setLang, setFallback, t, wolofCount]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp() {
  const c = useContext(C);
  if (!c) throw new Error("useApp hors de Providers");
  return c;
}
export const useT = () => useApp().t;
