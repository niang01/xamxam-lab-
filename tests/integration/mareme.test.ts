/** Marème IA : réponses issues du catalogue réel, des commandes et des études ; aucune donnée inventée. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as listings from "@/app/api/market/listings/route";
import * as vendor from "@/app/api/shop/vendor/route";
import * as shopListing from "@/app/api/shop/listings/[id]/route";
import * as cart from "@/app/api/shop/cart/route";
import * as checkout from "@/app/api/shop/checkout/route";
import * as assistant from "@/app/api/shop/assistant/route";
import * as studies from "@/app/api/studies/route";
import { ELECTRICAL } from "@/lib/studies/electrical";

let seller: Session, buyer: Session;
const ask = (s: Session, message: string, extra: Record<string, unknown> = {}) => call(assistant.POST as never, "POST", "/x", { session: s, body: { message, ...extra } });
type R = { intent: string; text: string[]; items: { id: string; title: string; price_xof: number | null }[]; mode: string };

beforeAll(async () => {
  seller = await register(registerRoute.POST as never, "vendeur-m@test.local", "company");
  buyer = await register(registerRoute.POST as never, "acheteur-m@test.local", "student");
  await call(vendor.PUT as never, "PUT", "/x", { session: seller, body: { business_name: "Électro Thiès", phone: "+221 00 000 00 00" } });
  for (const [title, price, qty] of [["Carte ESP32 DevKit V1", 6500, 5], ["Carte ESP32-S3 DevKit", 9000, 2], ["Disjoncteur 16 A", null, 10]] as const) {
    const l = await call(listings.POST as never, "POST", "/x", { session: seller, body: { title, category: "component", condition: "new", price_xof: price, quantity: qty, delivery: ["pickup"] } });
    await call(shopListing.PATCH as never, "PATCH", "/x", { session: seller, params: { id: l.json.id as string }, body: { shop_section: "electronique" } });
  }
});

describe("Marème IA", () => {
  it("comparaison : seulement les offres réelles, prix déclarés, le moins cher identifié", async () => {
    const r = (await ask(buyer, "Compare les ESP32 s'il te plaît")).json as unknown as R;
    expect(r.mode).toBe("rules"); expect(r.intent).toBe("compare");
    expect(r.items.map((i) => i.title).sort()).toEqual(["Carte ESP32 DevKit V1", "Carte ESP32-S3 DevKit"]);
    expect(r.text.join(" ").replace(/[\u202f\u00a0]/g, " ")).toContain("6 500 FCFA");
    expect(r.text.join(" ")).toContain("Prix le plus bas déclaré");
  });
  it("article sans prix : « prix sur demande », jamais un prix inventé ; article absent : signalé", async () => {
    const r = (await ask(buyer, "je cherche un disjoncteur")).json as unknown as R;
    expect(r.text.join(" ")).toContain("prix sur demande");
    const none = (await ask(buyer, "onduleur hybride 5 kW")).json as unknown as R;
    expect(none.items).toEqual([]); expect(none.text[0]).toContain("Aucun article en rayon");
    expect(none.text.join(" ")).not.toMatch(/\d+\s?FCFA/);
  });
  it("paiement et livraison : état réel de la configuration ; suivi des commandes", async () => {
    const p = (await ask(buyer, "Comment se passe le paiement ?")).json as unknown as R;
    expect(p.text[0]).toContain("Paiement en ligne non disponible");
    expect(((await ask(buyer, "Où en sont mes commandes ?")).json as unknown as R).text[0]).toContain("aucune commande");
    const esp = ((await ask(buyer, "ESP32 DevKit V1")).json as unknown as R).items.find((i) => i.title === "Carte ESP32 DevKit V1")!;
    await call(cart.POST as never, "POST", "/x", { session: buyer, body: { items: [{ listing_id: esp.id, qty: 1 }] } });
    await call(checkout.POST as never, "POST", "/x", { session: buyer, body: { delivery_method: "pickup" } });
    const o = (await ask(buyer, "suivi de ma commande")).json as unknown as R;
    expect(o.text.join(" ")).toContain("1 × Carte ESP32 DevKit V1"); expect(o.text.join(" ")).toContain("transmise au vendeur");
  });
  it("étude de dimensionnement : offres pour la nomenclature ; étude d'un autre compte refusée", async () => {
    const s = await call(studies.POST as never, "POST", "/x", { session: buyer, body: { software: "photovoltaique", input: (await import("@/lib/studies/pv")).PV.example, save: true, title: "PV test" } });
    const r = (await ask(buyer, "équipements de mon étude", { study: s.json.id })).json as unknown as R;
    expect(r.intent).toBe("bom"); expect(r.text[0]).toContain("Étude « PV test »");
    expect((await ask(seller, "équipements de mon étude", { study: s.json.id })).status).toBe(404);
    void ELECTRICAL;
  });
});
