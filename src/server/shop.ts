/**
 * Boutique : panier, passage de commande (une commande par vendeur), suivi des états, stock décrémenté à la
 * confirmation du vendeur (jamais au-delà du stock déclaré), offres pour la nomenclature d'un projet.
 * Paiement : « à convenir avec le vendeur » tant qu'aucun prestataire n'est configuré (aucun encaissement simulé).
 */
import { ApiFailure, type User } from "./api";
import { getDb, sql, sqlOne } from "./db";
import { audit } from "./audit";
import { notify } from "./settings";
import { canTransition, orderTotal, type OrderStatus } from "@/lib/shop";

export const LISTING_VISIBLE = "l.status='published' AND l.moderation='visible' AND l.shop_section IS NOT NULL";

export async function catalog(f: { q: string; section: string | null; maxPrice: number | null; sort?: "recent" | "price_asc" | "price_desc" }) {
  return sql(`SELECT l.id, l.title, l.description, l.category, l.condition, l.price_xof, l.quantity, l.location, l.delivery, l.specs, l.shop_section, l.datasheet_url, l.component_id,
      l.seller_id, COALESCE(v.business_name, u.display_name) AS seller, COALESCE(v.verified, false) AS seller_verified,
      (SELECT id FROM listing_images i WHERE i.listing_id=l.id ORDER BY created_at LIMIT 1) AS image_id
    FROM market_listings l JOIN users u ON u.id=l.seller_id LEFT JOIN shop_vendors v ON v.user_id=l.seller_id
    WHERE ${LISTING_VISIBLE} AND ($1='' OR l.title ILIKE '%'||$1||'%' OR l.description ILIKE '%'||$1||'%') AND ($2::text IS NULL OR l.shop_section=$2) AND ($3::bigint IS NULL OR l.price_xof <= $3)
    ORDER BY ${f.sort === "price_asc" ? "l.price_xof ASC NULLS LAST," : f.sort === "price_desc" ? "l.price_xof DESC NULLS LAST," : "l.sponsored DESC,"} l.created_at DESC LIMIT 300`, [f.q, f.section, f.maxPrice]);
}

export async function addToCart(u: User, listingId: string, qty: number) {
  const l = await sqlOne<{ seller_id: string; quantity: number | null }>(`SELECT l.seller_id, l.quantity FROM market_listings l WHERE l.id=$1 AND ${LISTING_VISIBLE}`, [listingId]);
  if (!l) throw new ApiFailure(404, "Article introuvable ou indisponible", "shop.err.unavailable");
  if (l.seller_id === u.id) throw new ApiFailure(400, "Vous ne pouvez pas acheter votre propre article", "shop.err.own");
  if (l.quantity != null && qty > l.quantity) throw new ApiFailure(409, `Stock déclaré insuffisant (${l.quantity} disponible(s))`, "shop.err.stock");
  await sql("INSERT INTO shop_cart_items(user_id, listing_id, qty) VALUES ($1,$2,$3) ON CONFLICT (user_id, listing_id) DO UPDATE SET qty=EXCLUDED.qty", [u.id, listingId, qty]);
}

export async function cart(u: User) {
  const items = await sql<{ listing_id: string; qty: number; title: string; price_xof: number | null; quantity: number | null; seller_id: string; seller: string; delivery: string[]; available: boolean }>(
    `SELECT c.listing_id, c.qty, l.title, l.price_xof, l.quantity, l.seller_id, COALESCE(v.business_name, us.display_name) AS seller, l.delivery,
       (l.status='published' AND l.moderation='visible' AND l.shop_section IS NOT NULL) AS available
     FROM shop_cart_items c JOIN market_listings l ON l.id=c.listing_id JOIN users us ON us.id=l.seller_id LEFT JOIN shop_vendors v ON v.user_id=l.seller_id
     WHERE c.user_id=$1 ORDER BY c.created_at`, [u.id]);
  const t = orderTotal(items.map((i) => ({ qty: i.qty, unit_price_xof: i.price_xof == null ? null : Number(i.price_xof) })));
  return { items, total_xof: t.total, has_unpriced: t.hasUnpriced };
}

export async function checkout(u: User, o: { delivery_method: "pickup" | "shipping" | "digital" | "onsite"; delivery_address: string | null; phone: string | null; note: string | null }) {
  const c = await cart(u);
  if (!c.items.length) throw new ApiFailure(400, "Panier vide", "shop.err.empty");
  const unavailable = c.items.filter((i) => !i.available);
  if (unavailable.length) throw new ApiFailure(409, `Articles devenus indisponibles : ${unavailable.map((i) => i.title).join(", ")}`, "shop.err.unavailable");
  const bySeller = new Map<string, typeof c.items>();
  for (const i of c.items) bySeller.set(i.seller_id, [...(bySeller.get(i.seller_id) ?? []), i]);
  for (const [, lines] of bySeller) {
    const bad = lines.find((l) => l.delivery.length && !l.delivery.includes(o.delivery_method));
    if (bad) throw new ApiFailure(409, `Mode de remise non proposé par le vendeur pour « ${bad.title} »`, "shop.err.delivery");
  }
  if (o.delivery_method === "shipping" && !o.delivery_address) throw new ApiFailure(400, "Adresse de livraison requise", "shop.err.address");
  const ids: string[] = [];
  const db = await getDb();
  for (const [seller, lines] of bySeller) {
    const t = orderTotal(lines.map((l) => ({ qty: l.qty, unit_price_xof: l.price_xof == null ? null : Number(l.price_xof) })));
    const order = (await db.query<{ id: string }>(`INSERT INTO shop_orders(buyer_id, seller_id, delivery_method, delivery_address, phone, note, total_xof, has_unpriced) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [u.id, seller, o.delivery_method, o.delivery_address, o.phone, o.note, t.hasUnpriced && t.total === 0 ? null : t.total, t.hasUnpriced])).rows[0];
    for (const l of lines) await sql("INSERT INTO shop_order_items(order_id, listing_id, title, qty, unit_price_xof) VALUES ($1,$2,$3,$4,$5)", [order.id, l.listing_id, l.title, l.qty, l.price_xof]);
    await sql("INSERT INTO shop_order_events(order_id, status, by_user, note) VALUES ($1,'placed',$2,'Commande passée')", [order.id, u.id]);
    await notify(seller, "market", "Nouvelle commande", `Commande de ${lines.length} article(s) à confirmer.`, "/boutique?onglet=ventes");
    await audit(u.id, "human", "shop.order.place", { kind: "shop_order", id: order.id }, { seller, lines: lines.length });
    ids.push(order.id);
  }
  await sql("DELETE FROM shop_cart_items WHERE user_id=$1", [u.id]);
  return ids;
}

/** Changement d'état (rôle vérifié) ; à la confirmation, le stock déclaré est décrémenté ou la confirmation refusée. */
export async function transition(u: User, orderId: string, to: OrderStatus, note: string | null) {
  const o = await sqlOne<{ id: string; status: OrderStatus; buyer_id: string; seller_id: string }>("SELECT id, status, buyer_id, seller_id FROM shop_orders WHERE id=$1", [orderId]);
  if (!o || (o.buyer_id !== u.id && o.seller_id !== u.id)) throw new ApiFailure(404, "Commande introuvable", "err.notFound");
  const role = o.seller_id === u.id ? "seller" : "buyer";
  if (!canTransition(o.status, to, role)) throw new ApiFailure(409, `Transition impossible : ${o.status} → ${to}`, "shop.err.transition");
  const items = await sql<{ listing_id: string | null; qty: number; title: string }>("SELECT listing_id, qty, title FROM shop_order_items WHERE order_id=$1", [orderId]);
  if (to === "confirmed") {
    for (const it of items) {
      if (!it.listing_id) continue;
      const r = await sql("UPDATE market_listings SET quantity = quantity - $2, status = CASE WHEN quantity - $2 = 0 THEN 'sold' ELSE status END, updated_at=now() WHERE id=$1 AND (quantity IS NULL OR quantity >= $2) RETURNING id", [it.listing_id, it.qty]);
      if (!r.length) throw new ApiFailure(409, `Stock insuffisant pour « ${it.title} » : mettez le stock à jour ou refusez la commande`, "shop.err.stock");
    }
  }
  if (["return_requested", "return_refused"].includes(to) && !note?.trim()) throw new ApiFailure(400, "Motif obligatoire", "shop.err.reason");
  if (to === "cancelled" && o.status === "confirmed" || to === "returned") {
    for (const it of items) if (it.listing_id) await sql("UPDATE market_listings SET quantity = quantity + $2, status = CASE WHEN status='sold' THEN 'published' ELSE status END WHERE id=$1 AND quantity IS NOT NULL", [it.listing_id, it.qty]);
  }
  await sql("UPDATE shop_orders SET status=$2, updated_at=now() WHERE id=$1", [orderId, to]);
  await sql("INSERT INTO shop_order_events(order_id, status, by_user, note) VALUES ($1,$2,$3,$4)", [orderId, to, u.id, note]);
  await notify(role === "seller" ? o.buyer_id : o.seller_id, "market", "Commande mise à jour", `Nouvel état : ${to}`, "/boutique?onglet=commandes");
  await audit(u.id, "human", `shop.order.${to}`, { kind: "shop_order", id: orderId });
}

export async function orders(u: User, role: "buyer" | "seller") {
  const rows = await sql<{ id: string }>(`SELECT o.*, b.display_name AS buyer_name, COALESCE(v.business_name, s.display_name) AS seller_name FROM shop_orders o
    LEFT JOIN users b ON b.id=o.buyer_id LEFT JOIN users s ON s.id=o.seller_id LEFT JOIN shop_vendors v ON v.user_id=o.seller_id
    WHERE ${role === "buyer" ? "o.buyer_id" : "o.seller_id"}=$1 ORDER BY o.created_at DESC LIMIT 200`, [u.id]);
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await sql<{ order_id: string }>("SELECT * FROM shop_order_items WHERE order_id = ANY($1)", [ids]) : [];
  const events = ids.length ? await sql<{ order_id: string }>("SELECT * FROM shop_order_events WHERE order_id = ANY($1) ORDER BY id", [ids]) : [];
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.order_id === r.id), events: events.filter((e) => e.order_id === r.id) }));
}

/** Offres de la boutique pour une liste de composants (bibliothèque) : par identifiant puis par nom. */
export async function offersFor(names: string[]) {
  const out: Record<string, unknown[]> = {};
  for (const n of names) {
    out[n] = await sql(`SELECT l.id, l.title, l.price_xof, l.quantity, COALESCE(v.business_name, u.display_name) AS seller, COALESCE(v.verified,false) AS seller_verified
      FROM market_listings l JOIN users u ON u.id=l.seller_id LEFT JOIN shop_vendors v ON v.user_id=l.seller_id
      WHERE ${LISTING_VISIBLE} AND (l.component_id = (SELECT id FROM components WHERE name=$1 AND mpn='generic' LIMIT 1) OR l.title ILIKE '%'||$1||'%')
      ORDER BY l.price_xof NULLS LAST LIMIT 5`, [n]);
  }
  return out;
}
