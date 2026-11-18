import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { readableListing } from "@/server/market";

type Ctx = { params: Promise<{ id: string }> };

/** Ajoute ou retire une annonce des favoris de l'utilisateur. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const listing = await readableListing(await uuidParam(ctx), u);
  const { on } = await readInput(req, z.object({ on: z.boolean() }));
  if (on) await sql("INSERT INTO market_favorites(user_id, listing_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [u.id, listing.id]);
  else await sql("DELETE FROM market_favorites WHERE user_id=$1 AND listing_id=$2", [u.id, listing.id]);
  return ok({ favorite: on });
});
