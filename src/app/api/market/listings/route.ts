import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure, throttle } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";
import { audit } from "@/server/audit";
import { listingSelect, marketCounts } from "@/server/market";
import { MARKET_CATEGORIES, listingInput } from "@/lib/market";

const browse = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.enum(MARKET_CATEGORIES).optional(),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  scope: z.enum(["all", "mine", "favorites"]).default("all"),
  sort: z.enum(["recent", "price_asc", "price_desc"]).default("recent"),
});

/** Parcours des annonces (visibles), de mes annonces (tous états) ou de mes favoris. Le sponsorisé est signalé, jamais caché. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = browse.parse(sp);
  const where = ["($1='' OR l.title ILIKE '%'||$1||'%' OR l.description ILIKE '%'||$1||'%' OR l.specs::text ILIKE '%'||$1||'%')",
    "($2::text IS NULL OR l.category=$2)", "($3::bigint IS NULL OR l.price_xof >= $3)", "($4::bigint IS NULL OR l.price_xof <= $4)"];
  if (f.scope === "mine") where.push("l.seller_id=$5");
  else if (f.scope === "favorites") where.push("EXISTS (SELECT 1 FROM market_favorites fv WHERE fv.listing_id=l.id AND fv.user_id=$5)", "(l.moderation='visible' OR l.seller_id=$5)");
  else where.push("l.moderation='visible' AND l.status='published'");
  const order = { recent: "l.sponsored DESC, l.created_at DESC", price_asc: "l.price_xof ASC NULLS LAST, l.created_at DESC", price_desc: "l.price_xof DESC NULLS LAST, l.created_at DESC" }[f.sort];
  const items = await sql(`${listingSelect("$5")} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 200`, [f.q, f.category ?? null, f.min ?? null, f.max ?? null, u.id]);
  return ok({ items, counts: await marketCounts(u.id) });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "market-create", 30, 60 * 60_000);
  const b = await readInput(req, listingInput);
  if (b.project_id) await requireProject(b.project_id, u, "owner");
  if (b.component_id && !(await sqlOne("SELECT 1 FROM components WHERE id=$1", [b.component_id]))) throw new ApiFailure(400, "Composant inconnu", "err.invalid");
  const r = (await sql<{ id: string }>(`INSERT INTO market_listings(seller_id, title, description, category, condition, price_xof, quantity, location, delivery, specs, component_id, project_id, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [u.id, b.title, b.description, b.category, b.condition, b.price_xof, b.quantity, b.location, JSON.stringify(b.delivery), JSON.stringify(b.specs), b.component_id, b.project_id, b.status]))[0];
  await audit(u.id, "human", "market.listing.create", { kind: "market_listing", id: r.id }, { category: b.category, status: b.status });
  return ok({ id: r.id }, 201);
});
