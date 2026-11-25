import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { addToCart, cart } from "@/server/shop";

export const GET = endpoint(async (req) => ok(await cart(await mustBeSignedIn(req))));

/** Ajout ou mise à jour d'une ligne (quantité contrôlée contre le stock déclaré). */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ items: z.array(z.object({ listing_id: z.string().uuid(), qty: z.number().int().min(1).max(10000) })).min(1).max(50) }));
  for (const i of b.items) await addToCart(u, i.listing_id, i.qty);
  return ok(await cart(u));
});

export const DELETE = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const id = new URL(req.url).searchParams.get("listing");
  if (id) await sql("DELETE FROM shop_cart_items WHERE user_id=$1 AND listing_id=$2", [u.id, id]); else await sql("DELETE FROM shop_cart_items WHERE user_id=$1", [u.id]);
  return ok(await cart(u));
});
