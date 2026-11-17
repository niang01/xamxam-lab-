"use client";
/** Coque de l'application : menu des 26 rubriques groupées, sélecteur WO/FR/EN, notifications, compte. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./providers";
import { RUBRICS, type Group } from "@/lib/catalog";
import { LANGS } from "@/lib/i18n/runtime";
import type { MsgKey } from "@/lib/i18n/messages";
import { api, post } from "@/lib/client/api";
import { StatusBar } from "./StatusBar";
import { AiPanel } from "./AiPanel";

const PUBLIC = ["/connexion", "/inscription"];
const THEMES = ["dark", "light", "system"] as const;
type Theme = (typeof THEMES)[number];

/** Logo XAM-XAM LAB : horizontal sur grand écran (version claire ou sombre selon le thème), symbole seul sur téléphone. */
function Brand() {
  return (
    <Link href="/" aria-label="XAM-XAM LAB — tableau de bord" className="flex shrink-0 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique local, sans optimisation nécessaire */}
      <img src="/brand/symbole.svg" alt="" width={32} height={32} className="h-8 w-8 sm:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-sombre.svg" alt="XAM-XAM LAB" height={32} className="logo-sombre hidden h-8 w-auto sm:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-clair.svg" alt="XAM-XAM LAB" height={32} className="logo-clair hidden h-8 w-auto sm:block" />
    </Link>
  );
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "system" ? t : "dark";
}
const GROUPS: Group[] = ["core", "lab", "connect", "knowledge", "ecosystem", "me"];

export function LabShell({ children }: { children: ReactNode }) {
  const { me, meLoaded, t, lang, setLang, fallback, wolofCount, totalKeys, refreshMe } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [offline, setOffline] = useState(false);
  const [theme, setThemeState] = useState<Theme>("dark");
  // Thème déjà appliqué par le script de démarrage (layout) : on le relit après le montage.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setThemeState(readTheme()); }, []);
  const setTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("xx-theme", next); } catch { /* stockage indisponible : thème pour la session seulement */ }
    setThemeState(next);
  };
  useEffect(() => {
    const on = () => setOffline(true), off = () => setOffline(false);
    window.addEventListener("xx-offline", on); window.addEventListener("offline", on); window.addEventListener("online", off);
    return () => { window.removeEventListener("xx-offline", on); window.removeEventListener("offline", on); window.removeEventListener("online", off); };
  }, []);
  const isPublic = PUBLIC.includes(path) || path.startsWith("/p/");

  useEffect(() => {
    if (meLoaded && !me && !isPublic) router.replace(`/connexion?suite=${encodeURIComponent(path)}`);
  }, [meLoaded, me, isPublic, path, router]);

  useEffect(() => {
    if (!me) return;
    const load = () => api<{ unread: number }>("/api/notifications?count=1").then((r) => setUnread(r.unread)).catch(() => undefined);
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [me, path]);

  // Fermer le menu mobile à chaque navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false); }, [path]);

  const langSwitch = (
    <div role="group" aria-label={t("c.language")} className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] text-xs">
      {LANGS.map((l) => (
        <button key={l} data-lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`px-2.5 py-1.5 font-semibold ${lang === l ? "bg-[var(--tech)] text-white" : "text-[var(--fg-2)] hover:bg-[var(--panel-2)]"}`}>{l.toUpperCase()}</button>
      ))}
    </div>
  );

  const themeSwitch = (
    <label className="inline-flex items-center">
      <span className="sr-only">{t("theme.label")}</span>
      <select data-testid="theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label={t("theme.label")}
        className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-1.5 py-1 text-xs text-[var(--fg-2)]">
        {THEMES.map((x) => <option key={x} value={x}>{t(`theme.${x}` as MsgKey)}</option>)}
      </select>
    </label>
  );

  const banner = lang === "wo" && wolofCount < totalKeys ? (
    <div data-testid="wolof-banner" className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] px-4 py-1.5 text-xs text-[var(--fg-2)]">
      {t("lang.fallbackBanner", { v: wolofCount, n: totalKeys, fb: t(`lang.${fallback}` as MsgKey) })}
    </div>
  ) : null;

  if (isPublic || !me) {
    return (
      <div className="min-h-dvh">
        {banner}
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="flex items-center gap-2">{themeSwitch}{langSwitch}</div>
        </div>
        {isPublic ? children : <p className="p-6 text-sm text-[var(--fg-2)]">{t("c.loading")}</p>}
      </div>
    );
  }

  const nav = (
    <nav aria-label="Menu principal" className="space-y-4 pb-10">
      {GROUPS.map((g) => (
        <div key={g}>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--fg-3)]">{t(`group.${g}` as MsgKey)}</div>
          <ul>
            {RUBRICS.filter((r) => r.group === g).map((r) => {
              const active = r.path === "/" ? path === "/" : path === r.path || path.startsWith(`${r.path}/`) && !(r.path === "/lab" && RUBRICS.some((x) => x.path !== "/lab" && path.startsWith(x.path)));
              return (
                <li key={r.key}>
                  <Link href={r.path} data-nav={r.key} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${active ? "bg-[color-mix(in_srgb,var(--tech)_30%,transparent)] text-[var(--fg)]" : "text-[var(--fg-2)] hover:bg-[var(--panel-2)]"}`}>
                    <span aria-hidden className="w-4 text-center text-[var(--cyan)]">{r.icon}</span>{t(`nav.${r.key}` as MsgKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <header data-shell className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] px-4 py-2 backdrop-blur">
        <button className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm lg:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>☰</button>
        <Brand />
        <div className="ml-auto flex items-center gap-2">
          {path !== "/ai" && (
            <button data-testid="ai-panel-toggle" aria-expanded={aiOpen} aria-label={t("panel.open")} onClick={() => setAiOpen((o) => !o)}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${aiOpen ? "border-[var(--cyan)] text-[var(--cyan)]" : "border-[var(--line)] text-[var(--fg-2)]"}`}>✦ <span className="hidden sm:inline">AI</span></button>
          )}
          <span className="hidden md:inline">{themeSwitch}</span>
          {langSwitch}
          <Link href="/notifications" data-testid="notif-link" className="relative rounded-lg border border-[var(--line)] px-2 py-1 text-sm" aria-label="Notifications">
            ◔{unread > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--danger)] px-1.5 text-[10px] text-white">{unread}</span>}
          </Link>
          <span className="hidden text-xs text-[var(--fg-2)] sm:inline">{me.display_name} · {t(`profile.${me.profile_kind}` as MsgKey)}{me.is_admin ? " · admin" : ""}</span>
          <button className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs text-[var(--fg-2)]" onClick={async () => { await post("/api/auth/logout", {}); await refreshMe(); router.replace("/connexion"); }}>{t("auth.logout")}</button>
        </div>
      </header>
      {banner}
      {offline && <div role="status" className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-4 py-1.5 text-xs">{t("c.offline")}</div>}
      <div className="flex">
        <aside className={`${open ? "fixed inset-0 top-[49px] z-20 block overflow-y-auto bg-[var(--bg)] p-3" : "hidden"} w-64 shrink-0 border-r border-[var(--line)] lg:sticky lg:top-[49px] lg:block lg:h-[calc(100dvh-49px)] lg:overflow-y-auto lg:p-3`}>{nav}</aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <AiPanel open={aiOpen && path !== "/ai"} onClose={() => setAiOpen(false)} path={path} />
      <StatusBar />
    </div>
  );
}
