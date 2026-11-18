/**
 * XAM-XAM MARKETPLACE — règles pures (partagées serveur / interface, testées).
 * Aucun paiement : la plateforme met en relation ; le vendeur déclare lui-même « réservé » puis « vendu ».
 */
import { z } from "zod";

export const MARKET_CATEGORIES = ["component", "kit", "equipment", "tool", "service", "software", "training", "project"] as const;
export const MARKET_CONDITIONS = ["new", "used", "refurbished", "na"] as const;
export const MARKET_DELIVERY = ["pickup", "shipping", "digital", "onsite"] as const;
export const LISTING_STATUSES = ["draft", "published", "reserved", "sold", "withdrawn"] as const;
export const INQUIRY_STATUSES = ["open", "accepted", "declined", "closed"] as const;
export const REPORT_REASONS = ["fraud", "prohibited", "misleading", "duplicate", "other"] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export type Category = (typeof MARKET_CATEGORIES)[number];

/** Catégories sans état matériel ni quantité (prestations immatérielles). */
const INTANGIBLE: Category[] = ["service", "software", "training", "project"];
export const isIntangible = (c: Category) => INTANGIBLE.includes(c);

const spec = z.object({ name: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) });

export const listingInput = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(5000).default(""),
  category: z.enum(MARKET_CATEGORIES),
  condition: z.enum(MARKET_CONDITIONS).default("na"),
  price_xof: z.number().int().min(0).max(1_000_000_000_000).nullable().default(null),
  quantity: z.number().int().min(0).max(1_000_000).nullable().default(null),
  location: z.string().trim().max(120).nullable().default(null),
  delivery: z.array(z.enum(MARKET_DELIVERY)).max(4).default([]),
  specs: z.array(spec).max(30).default([]),
  component_id: z.uuid().nullable().default(null),
  project_id: z.uuid().nullable().default(null),
  status: z.enum(["draft", "published"]).default("published"),
}).superRefine((v, ctx) => {
  if (isIntangible(v.category) && v.condition !== "na") ctx.addIssue({ code: "custom", path: ["condition"], message: "Sans objet pour une prestation immatérielle" });
  if (!isIntangible(v.category) && v.condition === "na") ctx.addIssue({ code: "custom", path: ["condition"], message: "Indiquez l'état du matériel (neuf, occasion, reconditionné)" });
  if (new Set(v.delivery).size !== v.delivery.length) ctx.addIssue({ code: "custom", path: ["delivery"], message: "Mode de remise en double" });
});
export type ListingInput = z.output<typeof listingInput>;

/** Mise à jour partielle par le vendeur (les règles de cohérence sont revérifiées sur l'annonce fusionnée). */
export const listingPatch = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  description: z.string().trim().max(5000).optional(),
  condition: z.enum(MARKET_CONDITIONS).optional(),
  price_xof: z.number().int().min(0).max(1_000_000_000_000).nullable().optional(),
  quantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  delivery: z.array(z.enum(MARKET_DELIVERY)).max(4).optional(),
  specs: z.array(spec).max(30).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});

/** Transitions d'état d'une annonce permises au vendeur. Un article vendu ou retiré ne revient pas en vente (nouvelle annonce). */
const LISTING_FLOW: Record<ListingStatus, ListingStatus[]> = {
  draft: ["published", "withdrawn"],
  published: ["reserved", "sold", "withdrawn", "draft"],
  reserved: ["published", "sold", "withdrawn"],
  sold: [],
  withdrawn: [],
};
export function canMoveListing(from: ListingStatus, to: ListingStatus): boolean {
  return from === to || LISTING_FLOW[from].includes(to);
}

/** Transitions d'une demande : le vendeur accepte ou décline une demande ouverte ; chacune des deux parties peut clore. */
export function canMoveInquiry(from: InquiryStatus, to: InquiryStatus, actor: "buyer" | "seller"): boolean {
  if (from === "declined" || from === "closed") return false;
  if (to === "closed") return true;
  if (actor !== "seller") return false;
  return from === "open" && (to === "accepted" || to === "declined");
}

/** Une annonce est visible publiquement si elle est publiée (ou réservée/vendue, pour l'historique) et non masquée par la modération. */
export function publiclyVisible(l: { status: ListingStatus; moderation: "visible" | "hidden" }): boolean {
  return l.moderation === "visible" && (l.status === "published" || l.status === "reserved" || l.status === "sold");
}

/** Une demande ne peut être faite que sur une annonce publiée, visible, d'un autre utilisateur, et dans la limite de la quantité déclarée. */
export function inquiryRefusal(l: { status: ListingStatus; moderation: "visible" | "hidden"; seller_id: string; quantity: number | null }, buyerId: string, quantity: number | null): string | null {
  if (l.seller_id === buyerId) return "own";
  if (l.moderation !== "visible" || l.status !== "published") return "unavailable";
  if (quantity !== null && l.quantity !== null && quantity > l.quantity) return "quantity";
  if (l.quantity === 0) return "unavailable";
  return null;
}

/** Prix affiché : montant entier en francs CFA (XOF) avec séparateur de milliers, ou « sur demande ». */
export function formatXof(amount: number | null, locale: "fr" | "en" | "wo" = "fr"): string | null {
  if (amount === null) return null;
  const n = new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 0 }).format(amount);
  return `${n.replace(/ | /g, " ")} FCFA`;
}
