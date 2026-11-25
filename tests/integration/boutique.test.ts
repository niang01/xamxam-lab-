import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as listings from "@/app/api/market/listings/route";
import * as vendor from "@/app/api/shop/vendor/route";
import * as shopListing from "@/app/api/shop/listings/[id]/route";
import * as image from "@/app/api/shop/listings/[id]/image/route";
import * as catalog from "@/app/api/shop/catalog/route";
import * as cart from "@/app/api/shop/cart/route";
import * as checkout from "@/app/api/shop/checkout/route";
import * as orders from "@/app/api/shop/orders/route";
import * as order from "@/app/api/shop/orders/[id]/route";
import * as offers from "@/app/api/shop/offers/route";
import * as adminShop from "@/app/api/admin/shop/route";
import { sql } from "@/server/db";
import { canTransition, orderTotal } from "@/lib/shop";

let admin: Session, seller: Session, buyer: Session, buyer2: Session, listing = "";
const esp32 = async () => (await sql<{ id: string }>("SELECT id FROM components WHERE name='Carte ESP32' AND mpn='generic'"))[0].id;

beforeAll(async () => {
  admin = await register(registerRoute.POST as never, "admin@test.local");
  seller = await register(registerRoute.POST as never, "vendeur@test.local", "company");
  buyer = await register(registerRoute.POST as never, "acheteur@test.local", "student");
  buyer2 = await register(registerRoute.POST as never, "acheteur2@test.local", "student");
});

describe("Boutique : règles pures", () => {
  it("transitions par rôle et totaux", () => {
    expect(canTransition("placed", "confirmed", "seller")).toBe(true);
    expect(canTransition("placed", "confirmed", "buyer")).toBe(false);
    expect(canTransition("delivered", "cancelled", "seller")).toBe(false);
    expect(orderTotal([{ qty: 2, unit_price_xof: 6500 }, { qty: 1, unit_price_xof: null }])).toEqual({ total: 13000, hasUnpriced: true });
  });
});

describe("Boutique : de l'article à la livraison", () => {
  it("mise en rayon : profil vendeur obligatoire, image contrôlée", async () => {
    const l = await call(listings.POST as never, "POST", "/x", { session: seller, body: { title: "Carte ESP32 DevKit", category: "component", condition: "new", price_xof: 6500, quantity: 3, delivery: ["pickup", "shipping"], component_id: await esp32() } });
    listing = l.json.id as string;
    expect((await call(shopListing.PATCH as never, "PATCH", "/x", { session: seller, params: { id: listing }, body: { shop_section: "iot" } })).json.key).toBe("shop.err.vendor");
    await call(vendor.PUT as never, "PUT", "/x", { session: seller, body: { business_name: "Électro Dakar", phone: "+221 00 000 00 00" } });
    expect((await call(shopListing.PATCH as never, "PATCH", "/x", { session: seller, params: { id: listing }, body: { shop_section: "iot", datasheet_url: "https://exemple.sn/esp32.pdf" } })).status).toBe(200);
    expect((await call(shopListing.PATCH as never, "PATCH", "/x", { session: buyer, params: { id: listing }, body: { shop_section: "iot" } })).status).toBe(409);
    const fd = new FormData(); fd.append("image", new File([new Uint8Array([1, 2, 3])], "x.gif"));
    const bad = await (image.POST as never as (r: Request, c: unknown) => Promise<Response>)(new Request("http://x", { method: "POST", body: fd, headers: { cookie: seller.cookie } }), { params: Promise.resolve({ id: listing }) });
    expect(bad.status).toBe(400);
    const c = await call(catalog.GET as never, "GET", "/api/shop/catalog?section=iot", { session: buyer });
    expect((c.json.items as { title: string; seller_verified: boolean }[])[0]).toMatchObject({ title: "Carte ESP32 DevKit", seller_verified: false });
    expect((c.json.payment as { online: boolean }).online).toBe(false);
  });

  it("panier : stock déclaré respecté, pas d'achat de son propre article", async () => {
    expect((await call(cart.POST as never, "POST", "/x", { session: buyer, body: { items: [{ listing_id: listing, qty: 5 }] } })).json.key).toBe("shop.err.stock");
    expect((await call(cart.POST as never, "POST", "/x", { session: seller, body: { items: [{ listing_id: listing, qty: 1 }] } })).json.key).toBe("shop.err.own");
    const c = await call(cart.POST as never, "POST", "/x", { session: buyer, body: { items: [{ listing_id: listing, qty: 2 }] } });
    expect(c.json.total_xof).toBe(13000);
  });

  it("commande : mode de remise vérifié, paiement à convenir, stock décrémenté à la confirmation", async () => {
    expect((await call(checkout.POST as never, "POST", "/x", { session: buyer, body: { delivery_method: "digital" } })).json.key).toBe("shop.err.delivery");
    expect((await call(checkout.POST as never, "POST", "/x", { session: buyer, body: { delivery_method: "shipping" } })).json.key).toBe("shop.err.address");
    const ok = await call(checkout.POST as never, "POST", "/x", { session: buyer, body: { delivery_method: "pickup", phone: "77 000 00 00" } });
    expect(ok.status).toBe(201);
    const id = (ok.json.orders as string[])[0];
    expect((await call(cart.GET as never, "GET", "/x", { session: buyer })).json.items).toEqual([]);
    expect((await call(order.POST as never, "POST", "/x", { session: buyer, params: { id }, body: { status: "confirmed" } })).status).toBe(409);
    // Second acheteur : 2 unités alors qu'il n'en restera qu'une après confirmation de la première commande
    await call(cart.POST as never, "POST", "/x", { session: buyer2, body: { items: [{ listing_id: listing, qty: 2 }] } });
    const id2 = ((await call(checkout.POST as never, "POST", "/x", { session: buyer2, body: { delivery_method: "pickup" } })).json.orders as string[])[0];
    expect((await call(order.POST as never, "POST", "/x", { session: seller, params: { id }, body: { status: "confirmed" } })).status).toBe(200);
    expect((await sql<{ quantity: number }>("SELECT quantity FROM market_listings WHERE id=$1", [listing]))[0].quantity).toBe(1);
    expect((await call(order.POST as never, "POST", "/x", { session: seller, params: { id: id2 }, body: { status: "confirmed" } })).json.key).toBe("shop.err.stock");
    expect((await call(order.POST as never, "POST", "/x", { session: seller, params: { id: id2 }, body: { status: "refused", note: "Stock épuisé" } })).status).toBe(200);
    // Annulation après confirmation → remise en stock ; suivi complet
    expect((await call(order.POST as never, "POST", "/x", { session: seller, params: { id }, body: { status: "cancelled" } })).status).toBe(200);
    expect((await sql<{ quantity: number }>("SELECT quantity FROM market_listings WHERE id=$1", [listing]))[0].quantity).toBe(3);
    const mine = (await call(orders.GET as never, "GET", "/api/shop/orders", { session: buyer })).json.items as { status: string; payment_method: string; events: { status: string }[] }[];
    expect(mine[0]).toMatchObject({ status: "cancelled", payment_method: "a_convenir" });
    expect(mine[0].events.map((e) => e.status)).toEqual(["placed", "confirmed", "cancelled"]);
    expect(((await call(orders.GET as never, "GET", "/api/shop/orders", { session: buyer2 })).json.items as unknown[]).length).toBe(1);
    expect((await call(order.POST as never, "POST", "/x", { session: buyer2, params: { id }, body: { status: "cancelled" } })).status).toBe(404);
  });

  it("offres pour les composants d'un projet de la banque ; administration des vendeurs", async () => {
    const o = await call(offers.GET as never, "GET", "/api/shop/offers?bank=iot-irrigation-jardin-scolaire", { session: buyer });
    const line = (o.json.lines as { name: string; offers: { title: string }[] }[]).find((l) => l.name === "Carte ESP32")!;
    expect(line.offers[0].title).toBe("Carte ESP32 DevKit");
    expect((await call(adminShop.GET as never, "GET", "/x", { session: buyer })).status).toBe(403);
    const sid = (await sql<{ id: string }>("SELECT id FROM users WHERE email='vendeur@test.local'"))[0].id;
    await call(adminShop.POST as never, "POST", "/x", { session: admin, body: { vendor_id: sid, verified: true } });
    const c = await call(catalog.GET as never, "GET", "/api/shop/catalog?q=ESP32", { session: buyer });
    expect((c.json.items as { seller_verified: boolean }[])[0].seller_verified).toBe(true);
  });
});
