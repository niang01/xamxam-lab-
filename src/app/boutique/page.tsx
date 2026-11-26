"use client";
/** Boutique XAM-XAM LAB : catalogue par rayon, panier, commandes, ventes, profil vendeur ; offres pour un projet. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { Mareme } from "@/components/Mareme";
import { useData } from "@/lib/client/hooks";
import { api, del, patch, post, put, RequestError } from "@/lib/client/api";
import type { MsgKey } from "@/lib/i18n/messages";

type Item = { id: string; title: string; description: string; price_xof: number | null; quantity: number | null; location: string | null; delivery: string[]; shop_section: string; datasheet_url: string | null; seller: string; seller_verified: boolean; image_id: string | null };
type Cat = { sections: { key: string; label: string }[]; payment: { online: boolean; message: string }; items: Item[] };
type CartT = { items: { listing_id: string; qty: number; title: string; price_xof: number | null; seller: string; available: boolean }[]; total_xof: number; has_unpriced: boolean };
type Order = { id: string; status: string; total_xof: number | null; has_unpriced: boolean; delivery_method: string; delivery_address: string | null; phone: string | null; created_at: string; buyer_name: string; seller_name: string; items: { title: string; qty: number; unit_price_xof: number | null }[]; events: { status: string; note: string | null; created_at: string }[] };
type Offer = { lines: { name: string; qty: number; offers: { id: string; title: string; price_xof: number | null; quantity: number | null; seller: string; seller_verified: boolean }[] }[] };
type Tab = "catalogue" | "panier" | "commandes" | "ventes" | "vendeur";
const fcfa = (n: number | null) => (n == null ? null : `${Number(n).toLocaleString("fr-FR")} FCFA`);

export default function Shop() {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>("catalogue");
  const [sort, setSort] = useState("");
  const [imp, setImp] = useState<{ csv: string; result: { created: number; dry_run: boolean; lines: { line: number; ok: boolean; errors: string[] }[] } | null }>({ csv: "", result: null });
  const [studyCtx, setStudyCtx] = useState<string | null>(null); const [projectCtx, setProjectCtx] = useState<string | null>(null);
  const [q, setQ] = useState(""); const [section, setSection] = useState("");
  const { data: cat, reload: reloadCat } = useData<Cat>(`/api/shop/catalog?q=${encodeURIComponent(q)}${section ? `&section=${section}` : ""}${sort ? `&tri=${sort}` : ""}`);
  const { data: cart, reload: reloadCart } = useData<CartT>("/api/shop/cart");
  const { data: mine, reload: reloadMine } = useData<{ items: Order[] }>(tab === "commandes" ? "/api/shop/orders" : null);
  const { data: sales, reload: reloadSales } = useData<{ items: Order[] }>(tab === "ventes" ? "/api/shop/orders?role=seller" : null);
  const { data: vend, reload: reloadVend } = useData<{ vendor: { business_name: string; phone: string | null; address: string | null; description: string | null; verified: boolean } | null; listings: { id: string; title: string; price_xof: number | null; quantity: number | null; status: string; shop_section: string | null }[] }>(tab === "vendeur" ? "/api/shop/vendor" : null);
  const [offers, setOffers] = useState<Offer | null>(null);
  const [co, setCo] = useState({ delivery_method: "pickup", delivery_address: "", phone: "", note: "" });
  const [vf, setVf] = useState({ business_name: "", phone: "", address: "", description: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>, ok = "") => { setErr(null); setMsg(""); try { await fn(); if (ok) setMsg(ok); reloadCart(); reloadCat(); reloadMine(); reloadSales(); reloadVend(); } catch (e) { setErr(e); } };
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const b = sp.get("projet_banque"), p = sp.get("projet"), st = sp.get("etude"), o = sp.get("onglet");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- contexte (étude, projet) et onglet lus dans l'URL après le montage
    setStudyCtx(st); setProjectCtx(p);
    if (o && ["catalogue", "panier", "commandes", "ventes", "vendeur"].includes(o)) setTab(o as Tab);
    if (b || p || st) api<Offer>(`/api/shop/offers?${b ? `bank=${encodeURIComponent(b)}` : p ? `project=${p}` : `study=${st}`}`).then(setOffers).catch(setErr);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- préremplissage du formulaire avec le profil chargé
  useEffect(() => { if (vend?.vendor) setVf({ business_name: vend.vendor.business_name, phone: vend.vendor.phone ?? "", address: vend.vendor.address ?? "", description: vend.vendor.description ?? "" }); }, [vend]);
  const label = (k: string) => cat?.sections.find((s) => s.key === k)?.label ?? k;
  const tabs: [Tab, MsgKey][] = [["catalogue", "shop.catalogue"], ["panier", "shop.cart"], ["commandes", "shop.myOrders"], ["ventes", "shop.sales"], ["vendeur", "shop.vendor"]];
  const OrderCard = ({ o, seller }: { o: Order; seller: boolean }) => (
    <li className="rounded-lg border border-[var(--line)] p-3 text-sm" data-order={o.status}>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{seller ? o.buyer_name : o.seller_name}</strong> · {new Date(o.created_at).toLocaleString()}</span><Pill tone={o.status === "delivered" ? "ok" : ["cancelled", "refused"].includes(o.status) ? "danger" : "info"}>{t(`shop.st.${o.status}` as MsgKey)}</Pill></div>
      <ul className="mt-1 text-xs">{o.items.map((i, k) => <li key={k}>{i.qty} × {i.title} — {fcfa(i.unit_price_xof) ?? t("shop.onRequest")}</li>)}</ul>
      <p className="mt-1 text-xs">{t("shop.total")} : {o.total_xof != null ? fcfa(o.total_xof) : "—"}{o.has_unpriced ? ` (${t("shop.incomplete")})` : ""} · {t(`shop.dm.${o.delivery_method}` as MsgKey)}{o.delivery_address ? ` · ${o.delivery_address}` : ""}{seller && o.phone ? ` · ${o.phone}` : ""}</p>
      <p className="text-xs text-[var(--warn)]">{t("shop.payOffline")}</p>
      <details className="mt-1 text-xs"><summary className="cursor-pointer">{t("shop.tracking")}</summary><ol className="pl-4">{o.events.map((e, k) => <li key={k}>{new Date(e.created_at).toLocaleString()} — {t(`shop.st.${e.status}` as MsgKey)}{e.note ? ` (${e.note})` : ""}</li>)}</ol></details>
      <div className="mt-2 flex flex-wrap gap-2">
        {seller && o.status === "placed" && <><Btn kind="ok" data-testid="order-confirm" onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "confirmed" }))}>{t("shop.confirm")}</Btn><Btn kind="danger" onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "refused", note: prompt(t("shop.reason")) }))}>{t("shop.refuse")}</Btn></>}
        {seller && o.status === "confirmed" && <><Btn onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "shipped" }))}>{t("shop.ship")}</Btn><Btn onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "delivered" }))}>{t("shop.delivered")}</Btn></>}
        {!seller && o.status === "placed" && <Btn kind="danger" onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "cancelled" }))}>{t("shop.cancel")}</Btn>}
        {!seller && o.status === "shipped" && <Btn kind="ok" onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "delivered" }))}>{t("shop.received")}</Btn>}
        {!seller && o.status === "delivered" && <Btn kind="ghost" data-testid="order-return" onClick={() => { const r = prompt(t("shop.returnReason")); if (r) void run(() => post(`/api/shop/orders/${o.id}`, { status: "return_requested", note: r })); }}>{t("shop.returnAsk")}</Btn>}
        {seller && o.status === "return_requested" && <><Btn kind="ok" data-testid="return-accept" onClick={() => run(() => post(`/api/shop/orders/${o.id}`, { status: "returned", note: null }))}>{t("shop.returnAccept")}</Btn><Btn kind="danger" onClick={() => { const r = prompt(t("shop.reason")); if (r) void run(() => post(`/api/shop/orders/${o.id}`, { status: "return_refused", note: r })); }}>{t("shop.returnRefuse")}</Btn></>}
      </div>
    </li>);
  return (
    <Page title={t("nav.shop")} subtitle={t("shop.subtitle")}>
      {cat && <p className="rounded-lg border border-[var(--warn)] px-3 py-2 text-xs" data-testid="payment-status">{cat.payment.message}</p>}
      <Mareme study={studyCtx} project={projectCtx} onCart={reloadCart} />
      <div className="flex flex-wrap gap-1" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" data-tab={k} aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-[var(--tech)] text-white" : "border border-[var(--line)]"}`}>{t(l)}{k === "panier" && cart?.items.length ? ` (${cart.items.length})` : ""}</button>)}</div>
      {msg && <Pill tone="ok">{msg}</Pill>}<ErrorBox error={err} />
      {offers && (
        <Card title={t("shop.projectOffers")} testId="project-offers">
          <ul className="space-y-2 text-sm">{offers.lines.map((l) => (
            <li key={l.name}><strong>{l.qty} × {l.name}</strong>{!l.offers.length ? <span className="ml-2 text-xs text-[var(--fg-3)]">{t("shop.noOffer")}</span> :
              <ul className="ml-3 text-xs">{l.offers.map((o) => <li key={o.id} className="flex flex-wrap items-center gap-2">{o.title} — {fcfa(o.price_xof) ?? t("shop.onRequest")} · {o.seller}{o.seller_verified ? " ✓" : ""}<button className="underline" onClick={() => run(() => post("/api/shop/cart", { items: [{ listing_id: o.id, qty: Math.max(1, Math.round(l.qty)) }] }), t("shop.added"))}>{t("shop.addToCart")}</button></li>)}</ul>}</li>))}</ul>
        </Card>
      )}
      {tab === "catalogue" && (
        <Card testId="shop-catalog">
          <div className="mb-3 grid gap-2 sm:grid-cols-2"><Input aria-label={t("c.search")} placeholder={t("c.search")} name="shop-q" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select aria-label={t("shop.section")} name="shop-section" value={section} onChange={(e) => setSection(e.target.value)}><option value="">{t("shop.allSections")}</option>{cat?.sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
            <Select aria-label={t("shop.sort")} name="shop-sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="">{t("shop.sortRecent")}</option><option value="prix">{t("shop.sortPriceAsc")}</option><option value="prix_desc">{t("shop.sortPriceDesc")}</option></Select></div>
          {!cat?.items.length ? <p className="text-sm text-[var(--fg-3)]" data-testid="shop-empty">{t("shop.empty")}</p> :
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cat.items.map((i) => (
              <li key={i.id} className="flex flex-col rounded-xl border border-[var(--line)] p-3 text-sm" data-product={i.title}>
                {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la plateforme */}
                {i.image_id ? <img src={`/api/shop/images/${i.image_id}`} alt={i.title} className="mb-2 h-32 w-full rounded-lg object-contain" /> : <div className="mb-2 flex h-32 items-center justify-center rounded-lg bg-[var(--bg-2)] text-xs text-[var(--fg-3)]">{t("shop.noImage")}</div>}
                <strong>{i.title}</strong><span className="text-xs text-[var(--fg-3)]">{label(i.shop_section)} · {i.seller}{i.seller_verified ? ` · ✓ ${t("shop.verified")}` : ""}</span>
                <span className="mt-1">{fcfa(i.price_xof) ?? t("shop.onRequest")}</span>
                <span className="text-xs">{i.quantity == null ? t("shop.stockNa") : t("shop.stock", { n: i.quantity })}</span>
                {i.datasheet_url && <a href={i.datasheet_url} target="_blank" rel="noreferrer noopener" className="text-xs underline">{t("comp.datasheet")}</a>}
                <p className="mt-1 line-clamp-3 text-xs text-[var(--fg-2)]">{i.description}</p>
                <Btn className="mt-auto" data-testid="add-to-cart" onClick={() => run(() => post("/api/shop/cart", { items: [{ listing_id: i.id, qty: 1 }] }), t("shop.added"))}>{t("shop.addToCart")}</Btn>
              </li>))}</ul>}
          <p className="mt-3 text-xs text-[var(--fg-3)]">{t("shop.declared")}</p>
        </Card>
      )}
      {tab === "panier" && (
        <Card title={t("shop.cart")} testId="shop-cart">
          {!cart?.items.length ? <p className="text-sm">{t("shop.cartEmpty")}</p> : (<>
            <ul className="divide-y divide-[var(--line)] text-sm">{cart.items.map((i) => (
              <li key={i.listing_id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{i.title} <span className="text-xs text-[var(--fg-3)]">· {i.seller}</span>{!i.available && <Pill tone="danger">{t("shop.unavailable")}</Pill>}</span>
                <span className="flex items-center gap-2"><Input aria-label={t("proj.qty")} type="number" min={1} defaultValue={i.qty} className="!w-20" onBlur={(e) => { const n = Number(e.target.value); if (n >= 1 && n !== i.qty) void run(() => post("/api/shop/cart", { items: [{ listing_id: i.listing_id, qty: n }] })); }} />
                  <span className="text-xs">{fcfa(i.price_xof) ?? t("shop.onRequest")}</span><button aria-label={t("c.delete")} onClick={() => run(() => del(`/api/shop/cart?listing=${i.listing_id}`))}>✕</button></span></li>))}</ul>
            <p className="mt-2 text-sm"><strong>{t("shop.total")} :</strong> {fcfa(cart.total_xof)}{cart.has_unpriced ? ` — ${t("shop.incomplete")}` : ""}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <Field label={t("shop.deliveryMethod")}><Select name="delivery_method" value={co.delivery_method} onChange={(e) => setCo({ ...co, delivery_method: e.target.value })}>{["pickup", "shipping", "digital", "onsite"].map((m) => <option key={m} value={m}>{t(`shop.dm.${m}` as MsgKey)}</option>)}</Select></Field>
              <Field label={t("shop.phone")}><Input name="phone" value={co.phone} onChange={(e) => setCo({ ...co, phone: e.target.value })} /></Field>
              {co.delivery_method === "shipping" && <Field label={t("shop.address")}><Input name="delivery_address" value={co.delivery_address} onChange={(e) => setCo({ ...co, delivery_address: e.target.value })} /></Field>}
              <Field label={t("shop.note")}><Input value={co.note} onChange={(e) => setCo({ ...co, note: e.target.value })} /></Field>
            </div>
            <p className="mt-2 text-xs text-[var(--warn)]">{t("shop.payOffline")}</p>
            <Btn className="mt-2" data-testid="checkout" onClick={() => run(async () => { await post("/api/shop/checkout", { delivery_method: co.delivery_method, delivery_address: co.delivery_address || null, phone: co.phone || null, note: co.note || null }); setTab("commandes"); }, t("shop.ordered"))}>{t("shop.order")}</Btn>
          </>)}
        </Card>
      )}
      {tab === "commandes" && <Card title={t("shop.myOrders")} testId="shop-orders">{!mine?.items.length ? <p className="text-sm">{t("c.none")}</p> : <ul className="space-y-2">{mine.items.map((o) => <OrderCard key={o.id} o={o} seller={false} />)}</ul>}</Card>}
      {tab === "ventes" && <Card title={t("shop.sales")} testId="shop-sales">{!sales?.items.length ? <p className="text-sm">{t("c.none")}</p> : <ul className="space-y-2">{sales.items.map((o) => <OrderCard key={o.id} o={o} seller />)}</ul>}</Card>}
      {tab === "vendeur" && (
        <div className="space-y-4">
          <Card title={t("shop.vendorProfile")} testId="vendor-profile">
            {vend?.vendor && <p className="mb-2"><Pill tone={vend.vendor.verified ? "ok" : "warn"}>{vend.vendor.verified ? t("shop.verified") : t("shop.notVerified")}</Pill></p>}
            <div className="grid gap-2 md:grid-cols-2">
              <Field label={t("shop.business")}><Input name="business_name" value={vf.business_name} onChange={(e) => setVf({ ...vf, business_name: e.target.value })} /></Field>
              <Field label={t("shop.phone")}><Input name="vendor-phone" value={vf.phone} onChange={(e) => setVf({ ...vf, phone: e.target.value })} /></Field>
              <Field label={t("shop.address")}><Input value={vf.address} onChange={(e) => setVf({ ...vf, address: e.target.value })} /></Field>
              <Field label={t("c.description")}><Textarea rows={2} value={vf.description} onChange={(e) => setVf({ ...vf, description: e.target.value })} /></Field>
            </div>
            <Btn className="mt-2" data-testid="vendor-save" onClick={() => run(() => put("/api/shop/vendor", { business_name: vf.business_name, phone: vf.phone || null, address: vf.address || null, description: vf.description || null }), t("c.saved"))}>{t("c.save")}</Btn>
          </Card>
          <Card title={t("shop.myProducts")}>
            <p className="mb-2 text-xs text-[var(--fg-3)]">{t("shop.howToSell")} <Link className="underline" href="/marketplace">{t("nav.market")}</Link></p>
            <details className="mb-3 rounded-lg border border-[var(--line)] p-2 text-sm" data-testid="shop-import">
              <summary className="cursor-pointer">{t("shop.import")}</summary>
              <p className="mt-1 text-xs text-[var(--fg-3)]">{t("shop.importInfo")} <a className="underline" href="/api/shop/import">{t("shop.importTemplate")}</a></p>
              <input type="file" accept=".csv,text/csv" name="import-file" className="mt-1 text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImp({ csv: await f.text(), result: null }); }} />
              <div className="mt-1 flex gap-2"><Btn kind="ghost" disabled={!imp.csv} data-testid="import-check" onClick={() => run(async () => setImp({ ...imp, result: await post("/api/shop/import", { csv: imp.csv, dry_run: true }) }))}>{t("shop.importCheck")}</Btn>
                <Btn disabled={!imp.csv || !imp.result || imp.result.lines.every((l) => !l.ok)} data-testid="import-run" onClick={() => run(async () => setImp({ csv: "", result: await post("/api/shop/import", { csv: imp.csv, dry_run: false }) }), t("shop.imported"))}>{t("shop.importRun")}</Btn></div>
              {imp.result && <ul className="mt-1 max-h-40 overflow-y-auto text-xs" data-testid="import-result">{!imp.result.dry_run && <li>{t("shop.importCreated", { n: imp.result.created })}</li>}{imp.result.lines.map((l) => <li key={l.line} className={l.ok ? "" : "text-[var(--danger)]"}>{t("shop.importLine", { n: l.line })} : {l.ok ? "✓" : l.errors.join(" ; ")}</li>)}</ul>}
            </details>
            <ul className="divide-y divide-[var(--line)] text-sm">{vend?.listings.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-mine={l.title}><span>{l.title} · {fcfa(l.price_xof) ?? t("shop.onRequest")} · {l.quantity ?? "—"}</span>
                <span className="flex flex-wrap items-center gap-2"><Select aria-label={t("shop.section")} name="listing-section" value={l.shop_section ?? ""} onChange={(e) => run(() => patch(`/api/shop/listings/${l.id}`, { shop_section: e.target.value || null }), t("c.saved"))} className="!w-auto"><option value="">{t("shop.notInShop")}</option>{cat?.sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
                  <label className="cursor-pointer text-xs underline">{t("shop.addImage")}<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("image", f); const r = await fetch(`/api/shop/listings/${l.id}/image`, { method: "POST", body: fd }); const j = await r.json(); if (!r.ok) setErr(new RequestError(r.status, j.error, j.key)); else { setMsg(t("c.saved")); reloadCat(); } }} /></label></span></li>))}</ul>
          </Card>
        </div>
      )}
    </Page>
  );
}
