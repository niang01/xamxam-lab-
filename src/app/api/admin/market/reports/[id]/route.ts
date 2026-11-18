import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";

type Ctx = { params: Promise<{ id: string }> };

/** Décision humaine sur un signalement : retenu (annonce masquée, vendeur prévenu avec le motif) ou rejeté. */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const admin = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ decision: z.enum(["upheld", "dismissed"]), note: z.string().trim().min(3).max(500) }));
  const r = await sqlOne<{ listing_id: string; status: string; seller_id: string; title: string }>(`SELECT r.listing_id, r.status, l.seller_id, l.title
    FROM market_reports r JOIN market_listings l ON l.id=r.listing_id WHERE r.id=$1`, [id]);
  if (!r) throw new ApiFailure(404, "Signalement introuvable", "err.notFound");
  if (r.status !== "open") throw new ApiFailure(409, "Signalement déjà traité", "market.err.handled");
  await sql("UPDATE market_reports SET status=$2, handled_by=$3, handled_at=now() WHERE id=$1", [id, b.decision, admin.id]);
  if (b.decision === "upheld") {
    await sql("UPDATE market_listings SET moderation='hidden', moderation_note=$2, updated_at=now() WHERE id=$1", [r.listing_id, b.note]);
    await sql("UPDATE market_reports SET status='upheld', handled_by=$2, handled_at=now() WHERE listing_id=$1 AND status='open'", [r.listing_id, admin.id]);
    await notify(r.seller_id, "market.moderation", `Annonce masquée : ${r.title}`, b.note, `/marketplace?annonce=${r.listing_id}`);
  }
  await audit(admin.id, "human", `market.report.${b.decision}`, { kind: "market_listing", id: r.listing_id }, { report: id, note: b.note });
  return ok({ ok: true });
});
