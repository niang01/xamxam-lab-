import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { SECTION_KEYS } from "@/lib/shop";

type Ctx = { params: Promise<{ id: string }> };
/** Mise en boutique d'une annonce du vendeur : rayon, fiche technique, stock. Profil vendeur obligatoire. */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ shop_section: z.enum(SECTION_KEYS).nullable().optional(), datasheet_url: z.string().url().max(500).refine((s) => s.startsWith("https://"), "Lien https requis").nullable().optional(), quantity: z.number().int().min(0).max(1_000_000).nullable().optional() }));
  if (!(await sqlOne("SELECT 1 FROM shop_vendors WHERE user_id=$1", [u.id]))) throw new ApiFailure(409, "Créez d'abord votre profil vendeur (onglet Vendeur)", "shop.err.vendor");
  const l = await sqlOne<{ seller_id: string }>("SELECT seller_id FROM market_listings WHERE id=$1", [id]);
  if (!l || l.seller_id !== u.id) throw new ApiFailure(404, "Annonce introuvable", "err.notFound");
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(b)) if (v !== undefined) { vals.push(v); sets.push(`${k}=$${vals.length}`); }
  if (sets.length) { vals.push(id); await sql(`UPDATE market_listings SET ${sets.join(", ")}, updated_at=now() WHERE id=$${vals.length}`, vals); }
  return ok({ ok: true });
});
