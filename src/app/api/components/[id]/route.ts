import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { LISTING_VISIBLE } from "@/server/shop";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Fiche détaillée : brochage complet, photos et sources, modèle 3D, offres réellement en rayon. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const c = await sqlOne<{ name: string; mpn: string | null }>("SELECT * FROM components WHERE id=$1", [id]);
  if (!c) throw new ApiFailure(404, "Composant introuvable", "err.notFound");
  const offers = await sql(`SELECT l.id, l.title, l.price_xof, l.quantity FROM market_listings l WHERE ${LISTING_VISIBLE}
    AND (l.component_id=$1 OR ($2::text IS NOT NULL AND l.title ILIKE '%'||$2||'%')) ORDER BY l.price_xof NULLS LAST LIMIT 10`, [id, c.mpn && c.mpn !== "generic" ? c.mpn : null]);
  return ok({ ...c, offers });
});

/** Vérification d'un composant (administrateur) : contrôle des caractéristiques contre la fiche technique. */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ status: z.enum(["verified", "to_verify"]) }));
  await sql("UPDATE components SET status=$1 WHERE id=$2 AND status<>'generic'", [b.status, id]);
  await audit(u.id, "human", "component.status", { kind: "component", id }, { status: b.status });
  return ok({ ok: true });
});
