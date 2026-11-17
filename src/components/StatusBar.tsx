"use client";
/**
 * Barre d'état inférieure : uniquement des états réellement mesurés (santé du serveur, base, mode de l'IA,
 * appareils vus depuis 15 min, commandes et actions IA en attente, connexion du navigateur).
 * Chaque état porte un libellé texte : la couleur n'est jamais la seule information.
 */
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "./providers";
import { api } from "@/lib/client/api";

type Health = { ok: boolean; db: string; ai: "llm" | "rules" };
type Counts = { devices: number; devicesLive: number; pendingCmd: number; approvals: number };

const REFRESH_MS = 60_000;

function subscribeNetwork(cb: () => void) {
  window.addEventListener("online", cb); window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

function Item({ tone, children, href, testId }: { tone: "ok" | "warn" | "danger" | "muted"; children: React.ReactNode; href?: string; testId?: string }) {
  const dot = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", muted: "var(--fg-3)" }[tone];
  const body = <><span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dot }} />{children}</>;
  const cls = "inline-flex items-center gap-1.5 whitespace-nowrap";
  return href ? <Link href={href} data-testid={testId} className={`${cls} hover:text-[var(--fg)]`}>{body}</Link> : <span data-testid={testId} className={cls}>{body}</span>;
}

export function StatusBar() {
  const { t } = useApp();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true);
  const [checkedAt, setCheckedAt] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const h = await api<Health>("/api/health"); if (alive) { setHealth(h); setHealthFailed(false); } } catch { if (alive) setHealthFailed(true); }
      try { const d = await api<{ counts: Counts }>("/api/dashboard"); if (alive) setCounts(d.counts); } catch { /* compteurs indisponibles : rien n'est affiché à leur place */ }
      if (alive) setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <footer data-testid="status-bar" aria-label={t("status.label")} className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 py-1.5 text-[11px] text-[var(--fg-2)] backdrop-blur">
      <Item tone={online ? "ok" : "danger"} testId="status-network">{online ? t("status.online") : t("status.offline")}</Item>
      {healthFailed ? <Item tone="danger" testId="status-server">{t("status.serverDown")}</Item> : health && (
        <>
          <Item tone="ok" testId="status-server">{t("status.serverOk")} · {health.db === "postgres" ? "PostgreSQL" : "PGlite"}</Item>
          <Item tone={health.ai === "llm" ? "ok" : "warn"} href="/ai" testId="status-ai">{health.ai === "llm" ? t("status.aiLlm") : t("status.aiRules")}</Item>
        </>
      )}
      {counts && (
        <>
          <Item tone={counts.devices === 0 ? "muted" : counts.devicesLive === counts.devices ? "ok" : "warn"} href="/iot" testId="status-devices">{t("status.devices", { live: counts.devicesLive, n: counts.devices })}</Item>
          {counts.pendingCmd > 0 && <Item tone="warn" href="/iot" testId="status-commands">{t("status.pendingCmd", { n: counts.pendingCmd })}</Item>}
          {counts.approvals > 0 && <Item tone="warn" href="/ai" testId="status-approvals">{t("status.approvals", { n: counts.approvals })}</Item>}
        </>
      )}
      {checkedAt && <span className="ml-auto hidden text-[var(--fg-3)] sm:inline">{t("status.checkedAt", { t: checkedAt })}</span>}
    </footer>
  );
}
