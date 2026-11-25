import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { orders } from "@/server/shop";

/** Mes commandes (acheteur) ou mes ventes (vendeur), avec lignes et historique. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ items: await orders(u, new URL(req.url).searchParams.get("role") === "seller" ? "seller" : "buyer") });
});
