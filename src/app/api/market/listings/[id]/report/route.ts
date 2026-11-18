import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure, throttle } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";
import { readableListing } from "@/server/market";
import { REPORT_REASONS } from "@/lib/market";

type Ctx = { params: Promise<{ id: string }> };

/** Signalement d'une annonce à la modération (une fois par utilisateur tant qu'il n'est pas traité). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "market-report", 20, 60 * 60_000);
  const listing = await readableListing(await uuidParam(ctx), u);
  if (listing.seller_id === u.id) throw new ApiFailure(409, "Vous ne pouvez pas signaler votre propre annonce", "market.err.own");
  const b = await readInput(req, z.object({ reason: z.enum(REPORT_REASONS), details: z.string().trim().max(1000).nullable().default(null) }));
  if (await sqlOne("SELECT 1 FROM market_reports WHERE listing_id=$1 AND reporter_id=$2 AND status='open'", [listing.id, u.id])) {
    throw new ApiFailure(409, "Signalement déjà enregistré", "market.err.alreadyReported");
  }
  const r = (await sql<{ id: string }>("INSERT INTO market_reports(listing_id, reporter_id, reason, details) VALUES ($1,$2,$3,$4) RETURNING id", [listing.id, u.id, b.reason, b.details]))[0];
  await audit(u.id, "human", "market.report.create", { kind: "market_listing", id: listing.id }, { reason: b.reason });
  for (const a of await sql<{ id: string }>("SELECT id FROM users WHERE is_admin AND status='active'")) {
    await notify(a.id, "market.report", `Annonce signalée : ${listing.title}`, `Motif : ${b.reason}`, "/marketplace?onglet=moderation");
  }
  return ok({ id: r.id }, 201);
});
