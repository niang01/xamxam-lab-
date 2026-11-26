/** Boutique : import CSV des vendeurs (validation ligne à ligne), tri par prix, retours après livraison. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as vendor from "@/app/api/shop/vendor/route";
import * as imp from "@/app/api/shop/import/route";
import * as catalog from "@/app/api/shop/catalog/route";
import * as cart from "@/app/api/shop/cart/route";
import * as checkout from "@/app/api/shop/checkout/route";
import * as order from "@/app/api/shop/orders/[id]/route";
import { sql } from "@/server/db";
import { SHOP_SECTIONS } from "@/lib/shop";
import { parseCsv } from "@/lib/shop-import";

let seller: Session, buyer: Session;
const CSV = `titre;rayon;categorie;etat;prix_fcfa;stock;remise;marque;reference;description;fiche_url
Carte ESP32 DevKit;esp32;component;new;6 500;5;pickup|shipping;Espressif;ESP32-DevKitC;"Carte Wi-Fi; Bluetooth";https://exemple.sn/esp32.pdf
Batterie LiFePO4 12,8 V 100 Ah;batteries;component;new;;2;pickup;;;Prix sur demande;
Ligne fausse;inconnu;component;new;100;1;pickup;;;;
Panneau 450 Wc;enr;component;new;95000;10;avion;;;;`;

beforeAll(async () => {
  seller = await register(registerRoute.POST as never, "fournisseur@test.local", "company");
  buyer = await register(registerRoute.POST as never, "client@test.local", "student");
});

describe("Boutique : rayons, import, tri, retours", () => {
  it("31 rayons (les 27 catégories du cahier des charges sont couvertes) ; lecture CSV avec guillemets", () => {
    expect(SHOP_SECTIONS.length).toBe(31);
    for (const k of ["arduino", "esp32", "batteries", "onduleurs", "regulateurs", "pompes", "automates", "laboratoire", "consommables", "agricole"]) expect(SHOP_SECTIONS.map(([x]) => x)).toContain(k);
    expect(parseCsv('a;b\n"x; y";"z ""q"""')).toEqual([["a", "b"], ["x; y", 'z "q"']]);
  });
  it("import : profil vendeur exigé ; vérification ligne à ligne ; seules les lignes valides sont créées ; prix vide conservé vide", async () => {
    expect((await call(imp.POST as never, "POST", "/x", { session: seller, body: { csv: CSV } })).json.key).toBe("shop.err.vendor");
    await call(vendor.PUT as never, "PUT", "/x", { session: seller, body: { business_name: "Fournisseur test", phone: "+221 00 000 00 00" } });
    const dry = await call(imp.POST as never, "POST", "/x", { session: seller, body: { csv: CSV, dry_run: true } });
    const lines = dry.json.lines as { line: number; ok: boolean; errors: string[] }[];
    expect(lines.map((l) => l.ok)).toEqual([true, true, false, false]);
    expect(lines[2].errors.join()).toContain("rayon inconnu"); expect(lines[3].errors.join()).toContain("mode de remise inconnu");
    expect(dry.json.created).toBe(0);
    const real = await call(imp.POST as never, "POST", "/x", { session: seller, body: { csv: CSV, dry_run: false } });
    expect(real.json.created).toBe(2);
    const bat = (await sql<{ price_xof: number | null; quantity: number; shop_section: string }>("SELECT price_xof, quantity, shop_section FROM market_listings WHERE title LIKE 'Batterie LiFePO4%'"))[0];
    expect(bat.price_xof).toBeNull(); expect(bat.quantity).toBe(2); expect(bat.shop_section).toBe("batteries");
    const esp = (await sql<{ price_xof: string; specs: { name: string; value: string }[]; datasheet_url: string }>("SELECT price_xof, specs, datasheet_url FROM market_listings WHERE title='Carte ESP32 DevKit'"))[0];
    expect(Number(esp.price_xof)).toBe(6500); expect(esp.specs).toEqual([{ name: "Marque", value: "Espressif" }, { name: "Référence", value: "ESP32-DevKitC" }]);
  });
  it("tri par prix croissant (prix sur demande en dernier)", async () => {
    const c = await call(catalog.GET as never, "GET", "/api/shop/catalog?tri=prix", { session: buyer });
    const prices = (c.json.items as { price_xof: number | null }[]).map((i) => i.price_xof);
    expect(prices[prices.length - 1]).toBeNull();
  });
  it("retour : demande motivée par l'acheteur après livraison, acceptation par le vendeur, stock réintégré", async () => {
    const esp = (await sql<{ id: string }>("SELECT id FROM market_listings WHERE title='Carte ESP32 DevKit'"))[0].id;
    await call(cart.POST as never, "POST", "/x", { session: buyer, body: { items: [{ listing_id: esp, qty: 2 }] } });
    const id = ((await call(checkout.POST as never, "POST", "/x", { session: buyer, body: { delivery_method: "pickup" } })).json.orders as string[])[0];
    const go = (s: Session, status: string, note: string | null = null) => call(order.POST as never, "POST", "/x", { session: s, params: { id }, body: { status, note } });
    expect((await go(buyer, "return_requested", "x")).status).toBe(409); // pas encore livrée
    await go(seller, "confirmed"); await go(seller, "delivered");
    expect((await sql<{ quantity: number }>("SELECT quantity FROM market_listings WHERE id=$1", [esp]))[0].quantity).toBe(3);
    expect((await go(buyer, "return_requested", null)).status).toBe(400); // motif obligatoire
    expect((await go(buyer, "return_requested", "Carte défectueuse")).status).toBe(200);
    expect((await go(buyer, "returned")).status).toBe(409); // seul le vendeur accepte
    expect((await go(seller, "returned")).status).toBe(200);
    expect((await sql<{ quantity: number }>("SELECT quantity FROM market_listings WHERE id=$1", [esp]))[0].quantity).toBe(5);
  });
});
