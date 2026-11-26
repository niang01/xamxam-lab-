import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { catalog } from "@/server/shop";
import { SHOP_SECTIONS } from "@/lib/shop";
import { paymentStatus } from "@/server/payments";

/** Catalogue de la boutique (articles publiés dans un rayon par leurs vendeurs ; prix et stocks DÉCLARÉS par eux). */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  const max = Number(sp.get("max"));
  return ok({ sections: SHOP_SECTIONS.map(([key, label]) => ({ key, label })), payment: paymentStatus(),
    items: await catalog({ q: (sp.get("q") ?? "").trim().slice(0, 100), section: sp.get("section") || null, maxPrice: Number.isFinite(max) && max > 0 ? max : null, sort: sp.get("tri") === "prix" ? "price_asc" : sp.get("tri") === "prix_desc" ? "price_desc" : "recent" }) });
});
