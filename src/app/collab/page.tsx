"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Page, Pill, Select, Textarea, Unavailable } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { MeetingRoom } from "@/components/MeetingRoom";
import { api, post } from "@/lib/client/api";

type Msg = { id: string; body: string; author: string | null; author_kind: string; created_at: string };

export default function Collab() {
  const t = useT();
  const { data: projects } = useData<{ items: { id: string; title: string; role: string }[] }>("/api/projects");
  const [pid, setPid] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const last = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const p = new URLSearchParams(window.location.search).get("projet"); if (p) setPid(p); }, []);
  useEffect(() => {
    if (!pid) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgs([]); last.current = null;
    const load = async () => {
      try {
        const r = await api<{ items: Msg[] }>(`/api/projects/${pid}/messages${last.current ? `?after=${encodeURIComponent(last.current)}` : ""}`);
        if (!alive || !r.items.length) return;
        last.current = r.items[r.items.length - 1].created_at;
        setMsgs((m) => [...m, ...r.items.filter((x) => !m.some((y) => y.id === x.id))]);
      } catch (e) { if (alive) setErr(e); }
    };
    void load();
    const i = setInterval(load, 4000);
    return () => { alive = false; clearInterval(i); };
  }, [pid]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const role = projects?.items.find((p) => p.id === pid)?.role;
  async function send() {
    if (!text.trim()) return;
    setErr(null);
    try { await post(`/api/projects/${pid}/messages`, { body: text }); setText(""); } catch (e) { setErr(e); }
  }
  return (
    <Page title={t("nav.collab")} subtitle={t("collab.subtitle")}>
      <Card>
        <Select value={pid} onChange={(e) => setPid(e.target.value)} aria-label={t("c.project")} data-testid="collab-project"><option value="">{t("collab.choose")}</option>{projects?.items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select>
      </Card>
      {pid && (
        <Card title={t("collab.messages")} actions={<span className="flex gap-2"><Link href={`/projects/${pid}`} className="text-xs text-[var(--cyan)] underline">{t("proj.sheet")}</Link><Link href={`/ai?projet=${pid}&q=${encodeURIComponent(t("collab.summaryPrompt"))}`} className="text-xs text-[var(--cyan)] underline">{t("collab.summarize")}</Link></span>}>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto" data-testid="collab-thread">
            {!msgs.length && <p className="text-sm text-[var(--fg-3)]">{t("c.none")}</p>}
            {msgs.map((m) => <div key={m.id} className="rounded-lg bg-[var(--bg-2)] p-2 text-sm"><div className="text-xs text-[var(--fg-3)]">{m.author ?? "—"} {m.author_kind === "ai" && <Pill tone="info">IA</Pill>} · {new Date(m.created_at).toLocaleString()}</div><div className="whitespace-pre-wrap">{m.body}</div></div>)}
            <div ref={endRef} />
          </div>
          {role && role !== "viewer" ? (
            <div className="mt-3 flex gap-2"><Textarea name="message" rows={2} value={text} onChange={(e) => setText(e.target.value)} /><Btn onClick={send} data-testid="collab-send">{t("c.send")}</Btn></div>
          ) : <p className="mt-2 text-xs text-[var(--fg-3)]">{t("collab.readOnly")}</p>}
          <ErrorBox error={err} />
        </Card>
      )}
      {pid && <Card title={t("collab.video")}><p className="mb-2 text-xs text-[var(--fg-3)]">{t("meet.info")}</p><MeetingRoom key={pid} projectId={pid} /></Card>}
      <div className="grid gap-3 md:grid-cols-2">
        <Unavailable title={t("collab.crdt")} reason={t("collab.crdtReason")} phase={8} />
      </div>
    </Page>
  );
}
