import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as listings from "@/app/api/market/listings/route";
import * as listing from "@/app/api/market/listings/[id]/route";
import * as inquiriesOnListing from "@/app/api/market/listings/[id]/inquiries/route";
import * as favorite from "@/app/api/market/listings/[id]/favorite/route";
import * as report from "@/app/api/market/listings/[id]/report/route";
import * as myInquiries from "@/app/api/market/inquiries/route";
import * as inquiry from "@/app/api/market/inquiries/[id]/route";
import * as messages from "@/app/api/market/inquiries/[id]/messages/route";
import * as adminMarket from "@/app/api/admin/market/route";
import * as adminReport from "@/app/api/admin/market/reports/[id]/route";
import * as adminListing from "@/app/api/admin/market/listings/[id]/route";
import * as notifications from "@/app/api/notifications/route";
import { verifyAuditChain } from "@/server/audit";

const R = registerRoute.POST as never;
let admin: Session, seller: Session, buyer: Session, other: Session;
let listingId = "";
let inquiryId = "";

const create = (s: Session, body: Record<string, unknown>) => call(listings.POST as never, "POST", "/api/market/listings", { session: s, body });
const detail = (s: Session, id: string) => call(listing.GET as never, "GET", `/api/market/listings/${id}`, { session: s, params: { id } });
const browse = (s: Session, q = "") => call(listings.GET as never, "GET", `/api/market/listings${q}`, { session: s });

beforeAll(async () => {
  admin = await register(R, "admin@test.local");
  seller = await register(R, "vendeur@test.local", "technician");
  buyer = await register(R, "acheteur@test.local", "student");
  other = await register(R, "autre@test.local", "engineer");
});

describe("XAM-XAM MARKETPLACE", () => {
  it("publication, brouillon invisible, prix en FCFA, caractéristiques déclarées", async () => {
    const r = await create(seller, { title: "Module XIAO ESP32-S3", description: "Carte neuve, jamais soudée.", category: "component", condition: "new", price_xof: 7500, quantity: 3,
      location: "Dakar", delivery: ["pickup", "shipping"], specs: [{ name: "Wi-Fi", value: "2,4 GHz" }] });
    expect(r.status).toBe(201);
    listingId = r.json.id as string;
    const draft = await create(seller, { title: "Brouillon d'annonce", category: "kit", condition: "used", status: "draft" });
    expect(draft.status).toBe(201);
    expect((await create(seller, { title: "Incohérente", category: "service", condition: "used" })).status).toBe(400);

    const seen = await browse(buyer);
    const titles = (seen.json.items as { title: string }[]).map((x) => x.title);
    expect(titles).toContain("Module XIAO ESP32-S3");
    expect(titles).not.toContain("Brouillon d'annonce");
    expect((await detail(buyer, draft.json.id as string)).status).toBe(404);
    const mine = await browse(seller, "?scope=mine");
    expect((mine.json.items as unknown[]).length).toBe(2);

    const filtered = await browse(buyer, "?category=component&max=5000");
    expect((filtered.json.items as unknown[]).length).toBe(0);
    const d = await detail(buyer, listingId);
    expect(d.json.listing).toMatchObject({ price_xof: 7500, quantity: 3, seller_name: "vendeur", specs: [{ name: "Wi-Fi", value: "2,4 GHz" }] });
  });

  it("seul le vendeur modifie ; transitions contrôlées", async () => {
    const id = listingId;
    expect((await call(listing.PATCH as never, "PATCH", "/x", { session: buyer, params: { id }, body: { price_xof: 1 } })).status).toBe(404);
    expect((await call(listing.PATCH as never, "PATCH", "/x", { session: seller, params: { id }, body: { price_xof: 7000 } })).status).toBe(200);
    expect((await call(listing.PATCH as never, "PATCH", "/x", { session: seller, params: { id }, body: { status: "draft" } })).status).toBe(200);
    expect((await call(listing.PATCH as never, "PATCH", "/x", { session: seller, params: { id }, body: { status: "published" } })).status).toBe(200);
  });

  it("demande + messagerie entre les deux seules parties, notifications, refus attendus", async () => {
    const id = listingId;
    const own = await call(inquiriesOnListing.POST as never, "POST", "/x", { session: seller, params: { id }, body: { message: "moi" } });
    expect(own.status).toBe(409);
    const tooMany = await call(inquiriesOnListing.POST as never, "POST", "/x", { session: buyer, params: { id }, body: { message: "4 svp", quantity: 4 } });
    expect(tooMany.status).toBe(400);
    const r = await call(inquiriesOnListing.POST as never, "POST", "/x", { session: buyer, params: { id }, body: { message: "Disponible samedi ?", quantity: 2 } });
    expect(r.status).toBe(201);
    inquiryId = r.json.id as string;
    expect((await call(inquiriesOnListing.POST as never, "POST", "/x", { session: buyer, params: { id }, body: { message: "encore" } })).status).toBe(409);

    const notif = await call(notifications.GET as never, "GET", "/api/notifications", { session: seller });
    expect(JSON.stringify(notif.json)).toContain("Nouvelle demande");

    const iid = inquiryId;
    expect((await call(inquiry.GET as never, "GET", "/x", { session: other, params: { id: iid } })).status).toBe(404);
    expect((await call(messages.POST as never, "POST", "/x", { session: seller, params: { id: iid }, body: { body: "Oui, retrait à Dakar." } })).status).toBe(201);
    const thread = await call(inquiry.GET as never, "GET", "/x", { session: buyer, params: { id: iid } });
    expect((thread.json.messages as { body: string }[]).map((m) => m.body)).toEqual(["Disponible samedi ?", "Oui, retrait à Dakar."]);

    expect((await call(inquiry.PATCH as never, "PATCH", "/x", { session: buyer, params: { id: iid }, body: { status: "accepted" } })).status).toBe(409);
    expect((await call(inquiry.PATCH as never, "PATCH", "/x", { session: seller, params: { id: iid }, body: { status: "accepted" } })).status).toBe(200);
    const list = await call(myInquiries.GET as never, "GET", "/api/market/inquiries", { session: seller });
    expect(list.json.items).toMatchObject([{ id: iid, role: "seller", status: "accepted", counterpart: "acheteur" }]);
  });

  it("favoris ; vendu clôt les demandes et prévient l'acheteur ; plus de modification ni de suppression", async () => {
    const id = listingId;
    await call(favorite.POST as never, "POST", "/x", { session: buyer, params: { id }, body: { on: true } });
    const favs = await browse(buyer, "?scope=favorites");
    expect((favs.json.items as { id: string; favorite: boolean }[])[0]).toMatchObject({ id, favorite: true });

    expect((await call(listing.DELETE as never, "DELETE", "/x", { session: seller, params: { id } })).status).toBe(409);
    expect((await call(listing.PATCH as never, "PATCH", "/x", { session: seller, params: { id }, body: { status: "sold" } })).status).toBe(200);
    const thread = await call(inquiry.GET as never, "GET", "/x", { session: buyer, params: { id: inquiryId } });
    expect((thread.json.inquiry as { status: string }).status).toBe("closed");
    expect((await call(messages.POST as never, "POST", "/x", { session: buyer, params: { id: inquiryId }, body: { body: "?" } })).status).toBe(409);
    expect(JSON.stringify((await call(notifications.GET as never, "GET", "/api/notifications", { session: buyer })).json)).toContain("vendue");
    expect((await call(listing.PATCH as never, "PATCH", "/x", { session: seller, params: { id }, body: { status: "published" } })).status).toBe(409);
    expect((await browse(other)).json.items).toEqual(expect.not.arrayContaining([expect.objectContaining({ id })]));
  });

  it("signalement → décision humaine de l'administrateur → annonce masquée et vendeur informé ; tracé dans le journal", async () => {
    const s = await create(seller, { title: "Chargeur suspect", category: "equipment", condition: "used", price_xof: 1000 });
    const id = s.json.id as string;
    expect((await call(report.POST as never, "POST", "/x", { session: seller, params: { id }, body: { reason: "fraud" } })).status).toBe(409);
    const rep = await call(report.POST as never, "POST", "/x", { session: other, params: { id }, body: { reason: "misleading", details: "Photo d'un autre modèle" } });
    expect(rep.status).toBe(201);
    expect((await call(report.POST as never, "POST", "/x", { session: other, params: { id }, body: { reason: "fraud" } })).status).toBe(409);

    expect((await call(adminMarket.GET as never, "GET", "/api/admin/market", { session: buyer })).status).toBe(403);
    const queue = await call(adminMarket.GET as never, "GET", "/api/admin/market", { session: admin });
    expect(queue.json.reports).toMatchObject([{ status: "open", reason: "misleading", title: "Chargeur suspect" }]);
    const rid = rep.json.id as string;
    expect((await call(adminReport.PATCH as never, "PATCH", "/x", { session: admin, params: { id: rid }, body: { decision: "upheld", note: "" } })).status).toBe(400);
    expect((await call(adminReport.PATCH as never, "PATCH", "/x", { session: admin, params: { id: rid }, body: { decision: "upheld", note: "Description trompeuse confirmée" } })).status).toBe(200);
    expect((await call(adminReport.PATCH as never, "PATCH", "/x", { session: admin, params: { id: rid }, body: { decision: "dismissed", note: "deuxième décision" } })).status).toBe(409);

    expect((await detail(buyer, id)).status).toBe(404);
    const own = await detail(seller, id);
    expect(own.json.listing).toMatchObject({ moderation: "hidden", moderation_note: "Description trompeuse confirmée" });
    expect(JSON.stringify((await call(notifications.GET as never, "GET", "/api/notifications", { session: seller })).json)).toContain("Annonce masquée");

    expect((await call(adminListing.PATCH as never, "PATCH", "/x", { session: other, params: { id }, body: { sponsored: true, note: "pub" } })).status).toBe(403);
    expect((await call(adminListing.PATCH as never, "PATCH", "/x", { session: admin, params: { id }, body: { moderation: "visible", sponsored: true, note: "Corrigée par le vendeur" } })).status).toBe(200);
    expect((await detail(buyer, id)).json.listing).toMatchObject({ sponsored: true, moderation: "visible" });
    expect((await verifyAuditChain()).ok).toBe(true);
  });
});
