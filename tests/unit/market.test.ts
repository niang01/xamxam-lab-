import { describe, expect, it } from "vitest";
import { canMoveInquiry, canMoveListing, formatXof, inquiryRefusal, listingInput, publiclyVisible } from "@/lib/market";

describe("XAM-XAM MARKETPLACE — règles", () => {
  it("annonce : un matériel exige un état, une prestation n'en a pas", () => {
    expect(listingInput.safeParse({ title: "Relais 5 V", category: "component", condition: "na" }).success).toBe(false);
    expect(listingInput.safeParse({ title: "Relais 5 V", category: "component", condition: "new" }).success).toBe(true);
    expect(listingInput.safeParse({ title: "Formation PCB", category: "training", condition: "used" }).success).toBe(false);
    expect(listingInput.parse({ title: "Formation PCB", category: "training" })).toMatchObject({ condition: "na", price_xof: null, status: "published" });
  });
  it("annonce : prix entier positif, remise sans doublon", () => {
    expect(listingInput.safeParse({ title: "Kit", category: "kit", condition: "new", price_xof: -1 }).success).toBe(false);
    expect(listingInput.safeParse({ title: "Kit", category: "kit", condition: "new", price_xof: 12.5 }).success).toBe(false);
    expect(listingInput.safeParse({ title: "Kit", category: "kit", condition: "new", delivery: ["pickup", "pickup"] }).success).toBe(false);
  });
  it("cycle de vie : vendu et retiré sont définitifs", () => {
    expect(canMoveListing("published", "reserved")).toBe(true);
    expect(canMoveListing("reserved", "published")).toBe(true);
    expect(canMoveListing("reserved", "sold")).toBe(true);
    expect(canMoveListing("sold", "published")).toBe(false);
    expect(canMoveListing("withdrawn", "published")).toBe(false);
    expect(canMoveListing("draft", "sold")).toBe(false);
  });
  it("demandes : seul le vendeur accepte ou décline ; chacun peut clore ; rien après la clôture", () => {
    expect(canMoveInquiry("open", "accepted", "seller")).toBe(true);
    expect(canMoveInquiry("open", "accepted", "buyer")).toBe(false);
    expect(canMoveInquiry("open", "declined", "seller")).toBe(true);
    expect(canMoveInquiry("accepted", "declined", "seller")).toBe(false);
    expect(canMoveInquiry("accepted", "closed", "buyer")).toBe(true);
    expect(canMoveInquiry("closed", "open", "seller")).toBe(false);
    expect(canMoveInquiry("declined", "closed", "buyer")).toBe(false);
  });
  it("visibilité et refus de demande", () => {
    expect(publiclyVisible({ status: "published", moderation: "visible" })).toBe(true);
    expect(publiclyVisible({ status: "published", moderation: "hidden" })).toBe(false);
    expect(publiclyVisible({ status: "draft", moderation: "visible" })).toBe(false);
    const l = { status: "published" as const, moderation: "visible" as const, seller_id: "s", quantity: 3 };
    expect(inquiryRefusal(l, "s", null)).toBe("own");
    expect(inquiryRefusal(l, "b", 4)).toBe("quantity");
    expect(inquiryRefusal(l, "b", 3)).toBeNull();
    expect(inquiryRefusal({ ...l, quantity: 0 }, "b", null)).toBe("unavailable");
    expect(inquiryRefusal({ ...l, status: "reserved" }, "b", null)).toBe("unavailable");
  });
  it("prix en francs CFA entiers, « sur demande » si absent", () => {
    expect(formatXof(125000)).toBe("125 000 FCFA");
    expect(formatXof(0)).toBe("0 FCFA");
    expect(formatXof(1500, "en")).toBe("1,500 FCFA");
    expect(formatXof(null)).toBeNull();
  });
});
