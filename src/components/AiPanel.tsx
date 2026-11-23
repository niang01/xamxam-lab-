"use client";
/**
 * Panneau contextuel droit « Aláji IA » : conversation courte accessible depuis toutes les rubriques.
 * Il passe par la même route et la même gouvernance qu'Aláji IA (agents, niveaux d'autonomie, approbations) ;
 * la rubrique ouverte est indiquée à l'IA comme contexte, sans rien lui faire exécuter de plus.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./providers";
import { post } from "@/lib/client/api";
import { RUBRICS } from "@/lib/catalog";
import type { MsgKey } from "@/lib/i18n/messages";

type Answer = { conversationId: string; mode: "llm" | "rules"; model: string | null; answer: string; agents: string[]; warning?: string };
type Turn = { role: "user" | "assistant"; text: string; meta?: Answer };

export function rubricFor(path: string) {
  return [...RUBRICS].sort((a, b) => b.path.length - a.path.length).find((r) => (r.path === "/" ? path === "/" : path === r.path || path.startsWith(`${r.path}/`)));
}

export function AiPanel({ open, onClose, path }: { open: boolean; onClose: () => void; path: string }) {
  const { t, lang } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conv, setConv] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const rubric = rubricFor(path);
  const rubricName = rubric ? t(`nav.${rubric.key}` as MsgKey) : "";

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns]);

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(""); setText("");
    setTurns((x) => [...x, { role: "user", text: q }]);
    try {
      // Contexte transmis en clair dans la question : la rubrique ouverte par l'utilisateur.
      const question = rubricName ? `[${t("panel.context")} : ${rubricName}] ${q}` : q;
      const r = await post<Answer>("/api/ai/chat", { question, conversation_id: conv, lang });
      setConv(r.conversationId);
      setTurns((x) => [...x, { role: "assistant", text: r.answer, meta: r }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <aside data-testid="ai-panel" aria-label={t("panel.title")} className="fixed inset-x-0 bottom-0 top-[49px] z-30 flex flex-col border-l border-[var(--line)] bg-[var(--bg-2)] sm:left-auto sm:w-[380px]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">{t("panel.title")}</h2>
          {rubricName && <p className="text-[11px] text-[var(--fg-3)]">{t("panel.context")} : {rubricName}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link href="/ai" className="underline" onClick={onClose}>{t("panel.full")}</Link>
          <button onClick={onClose} className="rounded-lg border border-[var(--line)] px-2 py-1" aria-label={t("c.close")}>✕</button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm" data-testid="ai-panel-thread">
        {!turns.length && <p className="text-[var(--fg-3)]">{t("panel.empty")}</p>}
        {turns.map((x, i) => x.role === "user" ? (
          <div key={i} className="ml-auto max-w-[90%] rounded-lg bg-[var(--panel-2)] px-3 py-2">{x.text}</div>
        ) : (
          <div key={i} className="space-y-1">
            <div className="text-[11px] text-[var(--fg-3)]">{x.meta?.mode === "llm" ? `IA · ${x.meta.model}` : t("ai.rules")}{x.meta?.agents.length ? ` · ${x.meta.agents.join(", ")}` : ""}</div>
            {x.meta?.warning && <p className="text-xs text-[var(--warn)]">{x.meta.warning}</p>}
            <div className="whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">{x.text}</div>
          </div>
        ))}
        {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
        <div ref={end} />
      </div>
      <form className="border-t border-[var(--line)] p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label={t("ai.placeholder")} placeholder={t("ai.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 text-sm" />
        <button type="submit" disabled={busy || !text.trim()} data-testid="ai-panel-send" className="mt-2 w-full rounded-lg bg-[var(--tech)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("c.loading") : t("c.send")}</button>
      </form>
    </aside>
  );
}
