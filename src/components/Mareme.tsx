"use client";
/** Panneau de Marème IA (boutique) : questions libres, réponses tirées des données réelles, ajout au panier sur action. */
import { useState } from "react";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Input, Pill } from "./ui";
import { post } from "@/lib/client/api";

type Item = { id: string; title: string; price_xof: number | null; quantity: number | null; seller: string };
type Reply = { intent: string; text: string[]; items: Item[]; mode: "rules"; sources: string[] };

export function Mareme({ study, project, onCart }: { study?: string | null; project?: string | null; onCart: () => void }) {
  const { t } = useApp();
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ q: string; r: Reply }[]>([]);
  const [err, setErr] = useState<unknown>(null); const [added, setAdded] = useState<string | null>(null);
  async function ask(message: string) {
    if (!message.trim()) return;
    setBusy(true); setErr(null);
    try { const r = await post<Reply>("/api/shop/assistant", { message, study: study ?? null, project: project ?? null }); setLog((l) => [...l, { q: message, r }].slice(-6)); setQ(""); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  }
  return (
    <Card title={<span>Marème IA <Pill tone="info">{t("mareme.rules")}</Pill></span>} testId="mareme">
      <p className="mb-2 text-xs text-[var(--fg-3)]">{t("mareme.intro")}</p>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">{(["mareme.s1", "mareme.s2", "mareme.s3", "mareme.s4"] as const).map((k) => <button key={k} className="rounded-full border border-[var(--line)] px-2 py-0.5" onClick={() => ask(t(k))}>{t(k)}</button>)}</div>
      <ul className="max-h-96 space-y-3 overflow-y-auto text-sm" data-testid="mareme-log">{log.map((x, i) => (
        <li key={i}><p className="text-right text-[var(--fg-3)]">{x.q}</p>
          <div className="rounded-lg border border-[var(--line)] p-2">{x.r.text.map((l, k) => <p key={k}>{l}</p>)}
            {!!x.r.items.length && <ul className="mt-2 space-y-1">{x.r.items.map((it) => <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{it.title} — {it.seller}</span>
              <Btn kind="ghost" data-testid="mareme-add" onClick={async () => { try { await post("/api/shop/cart", { items: [{ listing_id: it.id, qty: 1 }] }); setAdded(it.title); onCart(); } catch (e) { setErr(e); } }}>{t("shop.addToCart")}</Btn></li>)}</ul>}
            {!!x.r.sources.length && <p className="mt-1 text-xs text-[var(--fg-3)]">{t("mareme.sources")} : {x.r.sources.join(", ")}</p>}
          </div></li>))}</ul>
      {added && <Pill tone="ok">{t("shop.added")} : {added}</Pill>}
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <Input name="mareme-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("mareme.placeholder")} />
        <Btn disabled={busy} data-testid="mareme-send">{t("c.send")}</Btn>
      </form>
      <ErrorBox error={err} />
    </Card>
  );
}
