"use client";
/**
 * XAM-XAM MARKETPLACE : annonces techniques entre membres, demandes et messagerie acheteur ↔ vendeur, favoris,
 * signalements et modération. Aucun paiement en ligne : la plateforme met en relation, rien de plus.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { del, patch, post } from "@/lib/client/api";
import { MARKET_CATEGORIES, MARKET_CONDITIONS, MARKET_DELIVERY, REPORT_REASONS, canMoveInquiry, canMoveListing, formatXof, isIntangible, type Category, type InquiryStatus, type ListingStatus } from "@/lib/market";
import type { MsgKey } from "@/lib/i18n/messages";

type Listing = {
  id: string; seller_id: string; title: string; description: string; category: Category; condition: string; price_xof: number | null; quantity: number | null;
  location: string | null; delivery: string[]; specs: { name: string; value: string }[]; component_id: string | null; component_name: string | null;
  status: ListingStatus; moderation: "visible" | "hidden"; moderation_note: string | null; sponsored: boolean; favorite: boolean;
  seller_name: string; seller_since: string; seller_active: number; seller_sold: number; created_at: string;
};
type Inquiry = { id: string; status: InquiryStatus; quantity: number | null; created_at: string; buyer_name?: string; last_message?: string | null };
type Detail = { listing: Listing; isSeller: boolean; inquiries: Inquiry[]; reported: boolean };
type MyInquiry = { id: string; status: InquiryStatus; role: "buyer" | "seller"; counterpart: string; title: string; listing_id: string; price_xof: number | null; last_message: string | null; last_at: string | null };
type Thread = { inquiry: { id: string; status: InquiryStatus; role: "buyer" | "seller"; title: string; listing_id: string; quantity: number | null }; messages: { id: string; body: string; created_at: string; mine: boolean; author: string }[] };
type Counts = { listings: number; open_received: number; open_sent: number };

const TABS = ["browse", "mine", "favorites", "inquiries", "new", "moderation"] as const;
type Tab = (typeof TABS)[number];
const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info"> = { published: "ok", reserved: "warn", sold: "info", draft: "neutral", withdrawn: "neutral", open: "warn", accepted: "ok", declined: "danger", closed: "neutral" };

function useQueryState() {
  const [state, setState] = useState<{ tab: Tab; listing: string | null; inquiry: string | null }>({ tab: "browse", listing: null, inquiry: null });
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const tab = (sp.get("onglet") ?? "") as Tab;
    // Lecture unique des paramètres d'adresse (liens de notification) au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ tab: TABS.includes(tab) ? tab : sp.get("demande") ? "inquiries" : "browse", listing: sp.get("annonce"), inquiry: sp.get("demande") });
  }, []);
  // L'onglet, l'annonce et la demande ouvertes sont reflétés dans l'adresse (rechargement, partage, retour d'une notification).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (state.tab !== "browse") sp.set("onglet", state.tab);
    if (state.listing) sp.set("annonce", state.listing);
    if (state.inquiry && state.tab === "inquiries") sp.set("demande", state.inquiry);
    const next = `${window.location.pathname}${sp.size ? `?${sp}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [state]);
  return [state, setState] as const;
}

function Price({ value }: { value: number | null }) {
  const { t, lang } = useApp();
  const s = formatXof(value, lang);
  return <span data-testid="price" className="font-mono font-semibold text-[var(--fg)]">{s ?? t("market.onRequest")}</span>;
}

function ListingCard({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  const { t } = useApp();
  return (
    <button data-testid="listing-card" onClick={onOpen} className="flex h-full flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-left hover:border-[var(--cyan)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="info">{t(`market.cat.${l.category}` as MsgKey)}</Pill>
        {l.condition !== "na" && <Pill>{t(`market.cond.${l.condition}` as MsgKey)}</Pill>}
        {l.sponsored && <Pill tone="warn">{t("market.sponsored")}</Pill>}
        {l.status !== "published" && <Pill tone={STATUS_TONE[l.status]}>{t(`market.status.${l.status}` as MsgKey)}</Pill>}
        {l.moderation === "hidden" && <Pill tone="danger">{t("market.hidden")}</Pill>}
        {l.favorite && <span aria-label={t("market.unfavorite")} className="ml-auto text-[var(--violet)]">♥</span>}
      </div>
      <h3 className="font-semibold leading-snug text-[var(--fg)]">{l.title}</h3>
      <p className="line-clamp-2 text-sm text-[var(--fg-2)]">{l.description}</p>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 text-xs text-[var(--fg-3)]">
        <Price value={l.price_xof} />
        <span>{l.seller_name}{l.location ? ` · ${l.location}` : ""}</span>
      </div>
    </button>
  );
}

function Browse({ scope, onOpen }: { scope: "all" | "mine" | "favorites"; onOpen: (id: string) => void }) {
  const { t } = useApp();
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [sort, setSort] = useState("recent");
  const params = new URLSearchParams({ scope, sort, ...(q ? { q } : {}), ...(cat ? { category: cat } : {}), ...(min ? { min } : {}), ...(max ? { max } : {}) });
  const { data, error } = useData<{ items: Listing[]; counts: Counts }>(`/api/market/listings?${params}`);
  return (
    <div className="space-y-4">
      {data && <p data-testid="market-counts" className="text-xs text-[var(--fg-3)]">{t("market.counts", { l: data.counts.listings, r: data.counts.open_received, s: data.counts.open_sent })}</p>}
      <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <Input aria-label={t("market.search")} placeholder={t("market.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label={t("market.category")} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t("market.allCategories")}</option>
          {MARKET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`market.cat.${c}` as MsgKey)}</option>)}
        </Select>
        <Input aria-label={t("market.priceMin")} placeholder={t("market.priceMin")} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} />
        <Input aria-label={t("market.priceMax")} placeholder={t("market.priceMax")} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
        <Select aria-label={t("market.sort")} value={sort} onChange={(e) => setSort(e.target.value)}>
          {(["recent", "price_asc", "price_desc"] as const).map((s) => <option key={s} value={s}>{t(`market.sort.${s}` as MsgKey)}</option>)}
        </Select>
      </div>
      <ErrorBox error={error} />
      {data && !data.items.length && <p className="text-sm text-[var(--fg-3)]">{t("market.empty")}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data?.items.map((l) => <ListingCard key={l.id} l={l} onOpen={() => onOpen(l.id)} />)}</div>
    </div>
  );
}

function ListingDetail({ id, onClose, onInquiry }: { id: string; onClose: () => void; onInquiry: (id: string) => void }) {
  const { t, me, lang } = useApp();
  const { data, error, reload } = useData<Detail>(`/api/market/listings/${id}`);
  const [msg, setMsg] = useState(""); const [qty, setQty] = useState(""); const [reason, setReason] = useState<string>("fraud"); const [details, setDetails] = useState("");
  const [price, setPrice] = useState<string | null>(null); const [stock, setStock] = useState<string | null>(null);
  const [note, setNote] = useState(""); const [err, setErr] = useState<unknown>(null); const [info, setInfo] = useState("");
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="text-sm text-[var(--fg-3)]">{t("c.loading")}</p>;
  const l = data.listing;
  const act = async (fn: () => Promise<unknown>, done?: string) => { setErr(null); setInfo(""); try { await fn(); if (done) setInfo(done); reload(); } catch (e) { setErr(e); } };
  const current = data.inquiries.find((i) => i.status === "open" || i.status === "accepted");
  const since = new Date(l.seller_since).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { month: "long", year: "numeric" });

  return (
    <Card testId="listing-detail" title={l.title} actions={<Btn kind="ghost" onClick={onClose}>{t("c.close")}</Btn>}>
      <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="info">{t(`market.cat.${l.category}` as MsgKey)}</Pill>
            <Pill tone={STATUS_TONE[l.status]}>{t(`market.status.${l.status}` as MsgKey)}</Pill>
            {l.sponsored && <Pill tone="warn">{t("market.sponsored")}</Pill>}
            {l.moderation === "hidden" && <Pill tone="danger">{t("market.hidden")}{l.moderation_note ? ` : ${l.moderation_note}` : ""}</Pill>}
          </div>
          <div className="text-2xl"><Price value={l.price_xof} /></div>
          <p className="whitespace-pre-wrap text-[var(--fg-2)]">{l.description}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {l.condition !== "na" && <><dt className="text-[var(--fg-3)]">{t("market.condition")}</dt><dd>{t(`market.cond.${l.condition}` as MsgKey)}</dd></>}
            {l.quantity !== null && <><dt className="text-[var(--fg-3)]">{t("market.quantity")}</dt><dd data-testid="quantity">{l.quantity}</dd></>}
            {l.location && <><dt className="text-[var(--fg-3)]">{t("market.location")}</dt><dd>{l.location}</dd></>}
            {!!l.delivery.length && <><dt className="text-[var(--fg-3)]">{t("market.delivery")}</dt><dd>{l.delivery.map((d) => t(`market.delivery.${d}` as MsgKey)).join(" · ")}</dd></>}
            {l.component_name && <><dt className="text-[var(--fg-3)]">{t("market.component")}</dt><dd><Link className="underline" href="/components">{l.component_name}</Link></dd></>}
          </dl>
          {!!l.specs.length && (
            <div>
              <h3 className="font-semibold">{t("market.specs")}</h3>
              <p className="mb-1 text-xs text-[var(--warn)]">{t("market.specsNote")}</p>
              <table className="w-full text-sm"><tbody>{l.specs.map((s, i) => <tr key={i} className="border-t border-[var(--line)]"><td className="py-1 pr-3 text-[var(--fg-3)]">{s.name}</td><td className="py-1 font-mono">{s.value}</td></tr>)}</tbody></table>
            </div>
          )}
          <p className="text-xs text-[var(--fg-3)]">{t("market.seller")} : <strong className="text-[var(--fg-2)]">{l.seller_name}</strong> — {t("market.sellerSince", { d: since, a: l.seller_active, s: l.seller_sold })}</p>
        </div>

        <div className="space-y-4">
          {!data.isSeller && (
            <>
              <Btn kind="ghost" data-testid="favorite" onClick={() => act(() => post(`/api/market/listings/${l.id}/favorite`, { on: !l.favorite }))}>{l.favorite ? `♥ ${t("market.unfavorite")}` : `♡ ${t("market.favorite")}`}</Btn>
              {current ? (
                <p className="text-sm">{t("market.yourInquiry", { s: t(`market.inq.${current.status}` as MsgKey) })} — <button className="underline" onClick={() => onInquiry(current.id)}>{t("market.thread")}</button></p>
              ) : l.status === "published" && l.moderation === "visible" ? (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void act(async () => { const r = await post<{ id: string }>(`/api/market/listings/${l.id}/inquiries`, { message: msg, quantity: qty ? Number(qty) : null }); setMsg(""); setQty(""); onInquiry(r.id); }, t("market.inquirySent")); }}>
                  <h3 className="font-semibold">{t("market.contact")}</h3>
                  <Field label={t("market.message")}><Textarea name="message" rows={4} required value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
                  {!isIntangible(l.category) && <Field label={t("market.qtyWanted")}><Input name="quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>}
                  <Btn type="submit" data-testid="send-inquiry" disabled={!msg.trim()}>{t("market.sendInquiry")}</Btn>
                  <p className="text-xs text-[var(--warn)]">{t("market.noPayment")}</p>
                </form>
              ) : null}
              {data.reported ? <p className="text-xs text-[var(--fg-3)]">{t("market.reported")}</p> : (
                <details className="text-sm">
                  <summary className="cursor-pointer text-[var(--fg-3)]">{t("market.report")}</summary>
                  <div className="mt-2 space-y-2">
                    <Field label={t("market.reason")}><Select name="reason" value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`market.reason.${r}` as MsgKey)}</option>)}</Select></Field>
                    <Field label={t("market.reportDetails")}><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
                    <Btn kind="danger" data-testid="report" onClick={() => act(() => post(`/api/market/listings/${l.id}/report`, { reason, details: details || null }), t("market.reported"))}>{t("market.report")}</Btn>
                  </div>
                </details>
              )}
            </>
          )}

          {data.isSeller && (
            <div className="space-y-3" data-testid="seller-tools">
              <h3 className="font-semibold">{t("market.manage")}</h3>
              <div className="flex flex-wrap gap-2">
                {(["published", "reserved", "sold", "withdrawn", "draft"] as ListingStatus[]).filter((s) => s !== l.status && canMoveListing(l.status, s)).map((s) => (
                  <Btn key={s} kind={s === "sold" ? "ok" : "ghost"} data-testid={`status-${s}`} onClick={() => act(() => patch(`/api/market/listings/${l.id}`, { status: s }))}>{t("market.setStatus", { s: t(`market.status.${s}` as MsgKey) })}</Btn>
                ))}
              </div>
              {(l.status === "published" || l.status === "reserved" || l.status === "draft") && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("market.edit.price")}><Input inputMode="numeric" value={price ?? (l.price_xof === null ? "" : String(l.price_xof))} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} /></Field>
                  {!isIntangible(l.category) && <Field label={t("market.quantity")}><Input inputMode="numeric" value={stock ?? (l.quantity === null ? "" : String(l.quantity))} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} /></Field>}
                  <Btn kind="ghost" className="col-span-2" onClick={() => act(() => patch(`/api/market/listings/${l.id}`, { ...(price !== null ? { price_xof: price === "" ? null : Number(price) } : {}), ...(stock !== null ? { quantity: stock === "" ? null : Number(stock) } : {}) }))}>{t("market.save")}</Btn>
                </div>
              )}
              {!data.inquiries.length && <Btn kind="danger" onClick={() => act(async () => { await del(`/api/market/listings/${l.id}`); onClose(); })}>{t("market.delete")}</Btn>}
              <h3 className="font-semibold">{t("market.received")}</h3>
              {!data.inquiries.length && <p className="text-sm text-[var(--fg-3)]">{t("market.noInquiries")}</p>}
              <ul className="space-y-1 text-sm">{data.inquiries.map((i) => (
                <li key={i.id}><button className="w-full rounded-lg bg-[var(--bg-2)] p-2 text-left" onClick={() => onInquiry(i.id)}>
                  <Pill tone={STATUS_TONE[i.status]}>{t(`market.inq.${i.status}` as MsgKey)}</Pill> <strong>{i.buyer_name}</strong>{i.quantity ? ` · ×${i.quantity}` : ""}
                  <span className="block truncate text-xs text-[var(--fg-3)]">{i.last_message}</span>
                </button></li>))}</ul>
            </div>
          )}

          {me?.is_admin && (
            <div className="space-y-2 rounded-lg border border-dashed border-[var(--line)] p-3 text-sm" data-testid="admin-tools">
              <h3 className="font-semibold">{t("market.tab.moderation")}</h3>
              <Field label={t("market.mod.note")}><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="flex flex-wrap gap-2">
                <Btn kind="ghost" disabled={note.trim().length < 3} onClick={() => act(() => patch(`/api/admin/market/listings/${l.id}`, { moderation: l.moderation === "hidden" ? "visible" : "hidden", note }))}>{l.moderation === "hidden" ? t("market.mod.restore") : t("market.mod.uphold")}</Btn>
                <Btn kind="ghost" disabled={note.trim().length < 3} onClick={() => act(() => patch(`/api/admin/market/listings/${l.id}`, { sponsored: !l.sponsored, note }))}>{l.sponsored ? t("market.unsponsor") : t("market.sponsor")}</Btn>
              </div>
            </div>
          )}
          {info && <p role="status" className="text-sm text-[var(--ok)]">{info}</p>}
          <ErrorBox error={err} />
        </div>
      </div>
    </Card>
  );
}

function Inquiries({ selected, onSelect, onOpenListing }: { selected: string | null; onSelect: (id: string) => void; onOpenListing: (id: string) => void }) {
  const { t } = useApp();
  const { data, reload } = useData<{ items: MyInquiry[] }>("/api/market/inquiries");
  const { data: thread, reload: reloadThread } = useData<Thread>(selected ? `/api/market/inquiries/${selected}` : null);
  const [body, setBody] = useState(""); const [err, setErr] = useState<unknown>(null);
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reloadThread(); reload(); } catch (e) { setErr(e); } };
  const inq = thread?.inquiry;
  return (
    <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
      <ul className="space-y-1" data-testid="inquiry-list">
        {data && !data.items.length && <li className="text-sm text-[var(--fg-3)]">{t("market.noInquiries")}</li>}
        {data?.items.map((i) => (
          <li key={i.id}><button onClick={() => onSelect(i.id)} className={`w-full rounded-lg border p-2 text-left text-sm ${selected === i.id ? "border-[var(--cyan)]" : "border-[var(--line)]"}`}>
            <div className="flex flex-wrap items-center gap-1"><Pill tone={STATUS_TONE[i.status]}>{t(`market.inq.${i.status}` as MsgKey)}</Pill><Pill>{t(`market.as.${i.role}` as MsgKey)}</Pill><strong className="truncate">{i.title}</strong></div>
            <span className="block truncate text-xs text-[var(--fg-3)]">{i.counterpart} — {i.last_message}</span>
          </button></li>))}
      </ul>
      {inq && thread && (
        <Card testId="inquiry-thread" title={inq.title} actions={<button className="text-xs underline" onClick={() => onOpenListing(inq.listing_id)}>{t("market.viewListing")}</button>}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><Pill tone={STATUS_TONE[inq.status]}>{t(`market.inq.${inq.status}` as MsgKey)}</Pill>{inq.quantity ? <span>×{inq.quantity}</span> : null}</div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {thread.messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.mine ? "ml-auto bg-[color-mix(in_srgb,var(--tech)_35%,transparent)]" : "bg-[var(--panel-2)]"}`}>
                <div className="text-[10px] text-[var(--fg-3)]">{m.author} · {new Date(m.created_at).toLocaleString()}</div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>))}
          </div>
          {(inq.status === "open" || inq.status === "accepted") && (
            <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void act(async () => { await post(`/api/market/inquiries/${inq.id}/messages`, { body }); setBody(""); }); }}>
              <Textarea aria-label={t("market.reply")} name="reply" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Btn type="submit" data-testid="reply" disabled={!body.trim()}>{t("market.reply")}</Btn>
                {(["accepted", "declined", "closed"] as InquiryStatus[]).filter((s) => canMoveInquiry(inq.status, s, inq.role)).map((s) => (
                  <Btn key={s} type="button" kind={s === "accepted" ? "ok" : "ghost"} data-testid={`inq-${s}`} onClick={() => act(() => patch(`/api/market/inquiries/${inq.id}`, { status: s }))}>{t(`market.inqAction.${s}` as MsgKey)}</Btn>
                ))}
              </div>
            </form>
          )}
          <p className="mt-2 text-xs text-[var(--fg-3)]">{t("market.noPayment")}</p>
          <ErrorBox error={err} />
        </Card>
      )}
    </div>
  );
}

function NewListing({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useApp();
  const [v, setV] = useState({ title: "", description: "", category: "component" as Category, condition: "new", price: "", quantity: "", location: "", specs: "" });
  const [delivery, setDelivery] = useState<string[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const intangible = isIntangible(v.category);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function submit(status: "draft" | "published") {
    setErr(null);
    try {
      const specs = v.specs.split("\n").map((line) => line.split("=")).filter((p) => p.length >= 2 && p[0].trim() && p.slice(1).join("=").trim()).map((p) => ({ name: p[0].trim(), value: p.slice(1).join("=").trim() }));
      const r = await post<{ id: string }>("/api/market/listings", {
        title: v.title, description: v.description, category: v.category, condition: intangible ? "na" : v.condition,
        price_xof: v.price ? Number(v.price) : null, quantity: intangible || !v.quantity ? null : Number(v.quantity), location: v.location || null, delivery, specs, status,
      });
      onCreated(r.id);
    } catch (e) { setErr(e); }
  }
  return (
    <Card testId="new-listing">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("market.form.title")}><Input name="title" value={v.title} onChange={set("title")} /></Field>
        <Field label={t("market.category")}><Select name="category" value={v.category} onChange={set("category")}>{MARKET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`market.cat.${c}` as MsgKey)}</option>)}</Select></Field>
        {!intangible && <Field label={t("market.condition")}><Select name="condition" value={v.condition} onChange={set("condition")}>{MARKET_CONDITIONS.filter((c) => c !== "na").map((c) => <option key={c} value={c}>{t(`market.cond.${c}` as MsgKey)}</option>)}</Select></Field>}
        <Field label={t("market.edit.price")}><Input name="price" inputMode="numeric" value={v.price} onChange={(e) => setV((x) => ({ ...x, price: e.target.value.replace(/\D/g, "") }))} /></Field>
        {!intangible && <Field label={t("market.quantity")}><Input name="quantity" inputMode="numeric" value={v.quantity} onChange={(e) => setV((x) => ({ ...x, quantity: e.target.value.replace(/\D/g, "") }))} /></Field>}
        <Field label={t("market.location")}><Input name="location" value={v.location} onChange={set("location")} /></Field>
        <div className="md:col-span-2"><Field label={t("market.form.description")}><Textarea name="description" rows={4} value={v.description} onChange={set("description")} /></Field></div>
        <div className="md:col-span-2"><Field label={t("market.form.specs")} hint={t("market.specsNote")}><Textarea name="specs" rows={3} value={v.specs} onChange={set("specs")} placeholder="Tension = 12 V" /></Field></div>
        <fieldset className="md:col-span-2 text-sm"><legend className="mb-1 text-[var(--fg-2)]">{t("market.delivery")}</legend>
          <div className="flex flex-wrap gap-3">{MARKET_DELIVERY.map((d) => (
            <label key={d} className="inline-flex items-center gap-1.5"><input type="checkbox" name={`delivery-${d}`} checked={delivery.includes(d)} onChange={(e) => setDelivery((x) => (e.target.checked ? [...x, d] : x.filter((y) => y !== d)))} />{t(`market.delivery.${d}` as MsgKey)}</label>))}</div>
        </fieldset>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn data-testid="publish" disabled={v.title.trim().length < 3} onClick={() => submit("published")}>{t("market.form.publish")}</Btn>
        <Btn kind="ghost" disabled={v.title.trim().length < 3} onClick={() => submit("draft")}>{t("market.form.draft")}</Btn>
      </div>
      <p className="mt-2 text-xs text-[var(--fg-3)]">{t("market.noPayment")}</p>
      <ErrorBox error={err} />
    </Card>
  );
}

function Moderation({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useApp();
  const { data, reload } = useData<{ reports: { id: string; reason: string; details: string | null; status: string; title: string; listing_id: string; seller: string; reporter: string }[]; hidden: { id: string; title: string; moderation_note: string; seller: string }[] }>("/api/admin/market");
  const [note, setNote] = useState<Record<string, string>>({}); const [err, setErr] = useState<unknown>(null);
  const decide = async (id: string, decision: "upheld" | "dismissed") => { setErr(null); try { await patch(`/api/admin/market/reports/${id}`, { decision, note: note[id] ?? "" }); reload(); } catch (e) { setErr(e); } };
  return (
    <div className="space-y-4" data-testid="moderation">
      <Card title={t("market.mod.reports")}>
        {data && !data.reports.length && <p className="text-sm text-[var(--fg-3)]">{t("market.mod.none")}</p>}
        <ul className="space-y-2 text-sm">{data?.reports.map((r) => (
          <li key={r.id} className="rounded-lg bg-[var(--bg-2)] p-2">
            <div className="flex flex-wrap items-center gap-2"><Pill tone={r.status === "open" ? "warn" : "neutral"}>{r.status}</Pill><button className="font-semibold underline" onClick={() => onOpen(r.listing_id)}>{r.title}</button>
              <span className="text-xs text-[var(--fg-3)]">{t(`market.reason.${r.reason}` as MsgKey)} · {r.reporter} → {r.seller}</span></div>
            {r.details && <p className="mt-1 text-xs">{r.details}</p>}
            {r.status === "open" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input aria-label={t("market.mod.note")} placeholder={t("market.mod.note")} value={note[r.id] ?? ""} onChange={(e) => setNote((x) => ({ ...x, [r.id]: e.target.value }))} />
                <Btn kind="danger" data-testid="uphold" disabled={(note[r.id] ?? "").trim().length < 3} onClick={() => decide(r.id, "upheld")}>{t("market.mod.uphold")}</Btn>
                <Btn kind="ghost" disabled={(note[r.id] ?? "").trim().length < 3} onClick={() => decide(r.id, "dismissed")}>{t("market.mod.dismiss")}</Btn>
              </div>
            )}
          </li>))}</ul>
      </Card>
      <Card title={t("market.mod.hidden")}>
        <ul className="space-y-1 text-sm">{data?.hidden.map((h) => <li key={h.id}><button className="underline" onClick={() => onOpen(h.id)}>{h.title}</button> <span className="text-xs text-[var(--fg-3)]">{h.seller} — {h.moderation_note}</span></li>)}</ul>
      </Card>
      <ErrorBox error={err} />
    </div>
  );
}

export default function Marketplace() {
  const { t, me } = useApp();
  const [st, setSt] = useQueryState();
  const tabs = TABS.filter((x) => x !== "moderation" || me?.is_admin);
  const openListing = (id: string | null) => setSt((s) => ({ ...s, listing: id }));
  const openInquiry = (id: string) => setSt({ tab: "inquiries", listing: null, inquiry: id });
  return (
    <Page title={t("nav.market")} subtitle={t("market.subtitle")}>
      <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((x) => (
          <button key={x} role="tab" data-tab={x} aria-selected={st.tab === x} onClick={() => setSt({ tab: x, listing: null, inquiry: st.inquiry })}
            className={`rounded-lg px-3 py-1.5 text-sm ${st.tab === x ? "bg-[var(--tech)] text-white" : "border border-[var(--line)] text-[var(--fg-2)]"}`}>{t(`market.tab.${x}` as MsgKey)}</button>
        ))}
      </div>
      {st.listing ? <ListingDetail key={st.listing} id={st.listing} onClose={() => openListing(null)} onInquiry={openInquiry} /> : (
        <>
          {st.tab === "browse" && <Browse scope="all" onOpen={openListing} />}
          {st.tab === "mine" && <Browse scope="mine" onOpen={openListing} />}
          {st.tab === "favorites" && <Browse scope="favorites" onOpen={openListing} />}
          {st.tab === "inquiries" && <Inquiries selected={st.inquiry} onSelect={(id) => setSt((s) => ({ ...s, inquiry: id }))} onOpenListing={openListing} />}
          {st.tab === "new" && <NewListing onCreated={(id) => setSt({ tab: "mine", listing: id, inquiry: null })} />}
          {st.tab === "moderation" && me?.is_admin && <Moderation onOpen={openListing} />}
        </>
      )}
    </Page>
  );
}
