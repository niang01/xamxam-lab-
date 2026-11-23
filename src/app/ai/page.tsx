"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Btn, Card, ErrorBox, Page, Pill, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, post } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type Step = { id: string; agent_key: string; tool: string; status: string; error: string | null; required_level: number };
type Answer = { conversationId: string; mode: "llm" | "rules"; model: string | null; answer: string; agents: string[]; steps: Step[]; warning?: string; level: number; verification?: { ok: boolean; checked: number; issues: string[] } };
type Conv = { id: string; title: string; created_at: string };
type Status = { mode: "llm" | "rules"; model: string | null; reason?: string; aiEnabled: boolean; level: number; agents: { key: string; name: string; domain: string; tools: string[]; limits: string; enabled: boolean; runs: number }[] };
type Pending = { id: string; agent_key: string; tool: string; input: unknown; error: string; created_at: string };
type Turn = { role: "user" | "assistant"; text: string; meta?: Answer };

const STEP_TONE: Record<string, "ok" | "warn" | "danger" | "info"> = { done: "ok", approved: "ok", awaiting_approval: "warn", blocked: "danger", failed: "danger", rejected: "danger" };
const SPEECH_LANG: Record<string, string> = { wo: "wo-SN", fr: "fr-FR", en: "en-US" };

/** Rendu Markdown minimal et sûr (gras, listes) — aucun HTML injecté. */
function Md({ text }: { text: string }) {
  return <div className="space-y-1 whitespace-pre-wrap text-sm leading-relaxed">{text.split("\n").map((l, i) => {
    const parts = l.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p));
    return <div key={i} className={/^\s*[-•·]/.test(l) ? "pl-2" : ""}>{parts}</div>;
  })}</div>;
}

export default function AiCore() {
  const { t, lang } = useApp();
  const [pid, setPid] = useState("");
  const { data: st } = useData<Status>(`/api/ai/status${pid ? `?project=${pid}` : ""}`);
  const { data: pend, reload: reloadPend } = useData<{ items: Pending[] }>("/api/ai/steps");
  const { data: convs, reload: reloadConvs } = useData<{ items: Conv[] }>("/api/ai/conversations");
  async function openConv(id: string) {
    try {
      const c = await api<{ messages: { role: "user" | "assistant"; content: string; mode: "llm" | "rules" | null; model: string | null; agents: string[] | null }[] }>(`/api/ai/conversations/${id}`);
      setConv(id);
      setTurns(c.messages.map((m) => m.role === "user" ? { role: "user", text: m.content } : { role: "assistant", text: m.content, meta: { conversationId: id, mode: m.mode ?? "rules", model: m.model, answer: m.content, agents: m.agents ?? [], steps: [], level: 0 } }));
    } catch (e) { setErr(e); }
  }
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conv, setConv] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sp.get("q")) setText(sp.get("q")!);
    if (sp.get("projet")) setPid(sp.get("projet")!);
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  async function send() {
    const qn = text.trim();
    if (!qn) return;
    setBusy(true); setErr(null); setText("");
    setTurns((x) => [...x, { role: "user", text: qn }]);
    try {
      const r = await post<Answer>("/api/ai/chat", { question: qn, conversation_id: conv, project_id: pid || null, lang, agents: chosen.length ? chosen : undefined });
      setConv(r.conversationId);
      setTurns((x) => [...x, { role: "assistant", text: r.answer, meta: r }]);
      reloadPend(); reloadConvs();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  function dictate() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { setVoiceMsg(t("ai.noStt")); return; }
    const r = new SR();
    r.lang = SPEECH_LANG[lang]; r.interimResults = false;
    r.onresult = (e) => { setText((x) => `${x} ${e.results[0][0].transcript}`.trim()); };
    r.onerror = (e) => { setVoiceMsg(lang === "wo" ? t("ai.noSttWo") : `${t("ai.sttError")} ${e.error}`); setListening(false); };
    r.onend = () => setListening(false);
    setVoiceMsg(lang === "wo" ? t("ai.sttWoTry") : ""); setListening(true); r.start();
  }
  function speak(s: string) {
    if (!("speechSynthesis" in window)) { setVoiceMsg(t("ai.noTts")); return; }
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    if (!voices.length) { setVoiceMsg(t("ai.noVoice", { l: t(`lang.${lang}` as MsgKey) })); return; }
    const u = new SpeechSynthesisUtterance(s.replace(/\*\*/g, "")); u.voice = voices[0]; u.lang = voices[0].lang;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  return (
    <Page title={t("nav.ai")} subtitle={t("ai.subtitle")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      {st && (
        <div data-testid="ai-mode" className={`rounded-lg border px-3 py-2 text-sm ${st.mode === "llm" ? "border-[var(--ok)]" : "border-[var(--warn)]"}`}>
          {!st.aiEnabled ? <strong className="text-[var(--danger)]">{t("ai.killed")}</strong> : st.mode === "llm" ? <span><Pill tone="ok">IA</Pill> {st.model}</span> : <span><Pill tone="warn">{t("ai.rules")}</Pill> {st.reason}</span>}
          <span className="ml-2 text-xs text-[var(--fg-3)]">{t("ai.level", { n: st.level })} · <Link href="/settings" className="underline">{t("nav.settings")}</Link></span>
        </div>
      )}
      {!!pend?.items.length && (
        <Card title={t("ai.pending")} testId="ai-pending">
          <ul className="space-y-2 text-sm">{pend.items.map((p) => (
            <li key={p.id} className="rounded-lg bg-[var(--bg-2)] p-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{p.tool}</strong> · {p.agent_key}</span>
                <span className="flex gap-2"><Btn kind="ok" onClick={async () => { try { await post(`/api/ai/steps/${p.id}`, { approve: true }); reloadPend(); } catch (e) { setErr(e); } }}>{t("c.approve")}</Btn><Btn kind="ghost" onClick={async () => { await post(`/api/ai/steps/${p.id}`, { approve: false }); reloadPend(); }}>{t("c.refuse")}</Btn></span></div>
              <pre className="mt-1 max-h-32 overflow-auto text-xs text-[var(--fg-2)]">{JSON.stringify(p.input, null, 1)}</pre>
              <p className="text-xs text-[var(--warn)]">{p.error}</p>
            </li>))}</ul>
        </Card>
      )}
      <Card title={t("ai.agents")}>
        <p className="mb-2 text-xs text-[var(--fg-3)]">{t("ai.agentsHint")}</p>
        <div className="flex flex-wrap gap-1.5">{st?.agents.filter((a) => a.key !== "verifier").map((a) => (
          <button key={a.key} title={`${a.domain} — ${a.limits}`} disabled={!a.enabled} onClick={() => setChosen((c) => (c.includes(a.key) ? c.filter((x) => x !== a.key) : [...c, a.key]))}
            className={`rounded-full border px-2.5 py-1 text-xs ${chosen.includes(a.key) ? "border-[var(--cyan)] bg-[color-mix(in_srgb,var(--cyan)_20%,transparent)]" : "border-[var(--line)]"} ${a.enabled ? "" : "line-through opacity-50"}`}>{a.name.replace("AI ", "")}{a.runs > 0 ? ` · ${a.runs}` : ""}</button>))}</div>
      </Card>
      {!!convs?.items.length && (
        <Card title={t("ai.history")} testId="ai-history">
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">{convs.items.map((c) => (
            <li key={c.id}><button className={`text-left hover:underline ${conv === c.id ? "text-[var(--cyan)]" : ""}`} onClick={() => openConv(c.id)}>{new Date(c.created_at).toLocaleDateString()} — {c.title}</button></li>
          ))}</ul>
        </Card>
      )}
      <Card>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto" data-testid="ai-thread">
          {!turns.length && <p className="text-sm text-[var(--fg-3)]">{t("ai.empty")}</p>}
          {turns.map((x, i) => (
            <div key={i} className={x.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-[var(--panel-2)] p-3 text-sm" : "space-y-2"}>
              {x.role === "user" ? x.text : (
                <>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <Pill tone={x.meta?.mode === "llm" ? "ok" : "warn"}>{x.meta?.mode === "llm" ? `IA · ${x.meta.model}` : t("ai.rules")}</Pill>
                    {x.meta?.agents.map((a) => <Pill key={a} tone="info">{a}</Pill>)}
                    {x.meta?.verification && x.meta.verification.checked > 0 && <Pill tone={x.meta.verification.ok ? "ok" : "warn"}>{x.meta.verification.ok ? t("ai.verified") : t("ai.issues", { n: x.meta.verification.issues.length })}</Pill>}
                    <button className="underline" onClick={() => speak(x.text)}>{t("ai.listen")}</button>
                  </div>
                  {x.meta?.warning && <p className="text-xs text-[var(--warn)]">{x.meta.warning}</p>}
                  <div data-testid="ai-answer"><Md text={x.text} /></div>
                  {!!x.meta?.steps.length && (
                    <details open className="rounded-lg border border-[var(--line)] p-2 text-xs" data-testid="ai-steps">
                      <summary className="cursor-pointer text-[var(--fg-2)]">{t("ai.journal", { n: x.meta.steps.length })}</summary>
                      <ul className="mt-1 space-y-0.5">{x.meta.steps.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-2"><Pill tone={STEP_TONE[s.status] ?? "info"}>{t(`ai.st.${s.status}` as MsgKey)}</Pill><span className="font-mono">{s.tool}</span><span className="text-[var(--fg-3)]">{s.agent_key} · N{s.required_level}{s.error ? ` · ${s.error}` : ""}</span></li>)}</ul>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="mt-3 space-y-2">
          <Textarea name="question" rows={3} value={text} placeholder={t("ai.placeholder")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(); }} />
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={send} disabled={busy || !text.trim()} data-testid="ai-send">{busy ? t("c.loading") : t("c.send")}</Btn>
            <Btn kind="ghost" onClick={dictate} disabled={listening}>{listening ? "…" : t("ai.dictate")}</Btn>
            <Btn kind="ghost" onClick={() => { setTurns([]); setConv(null); }}>{t("ai.newConv")}</Btn>
            {voiceMsg && <span className="text-xs text-[var(--warn)]">{voiceMsg}</span>}
          </div>
          <ErrorBox error={err} />
        </div>
      </Card>
    </Page>
  );
}

interface SpeechRecognitionLike { lang: string; interimResults: boolean; start: () => void; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onerror: (e: { error: string }) => void; onend: () => void }
