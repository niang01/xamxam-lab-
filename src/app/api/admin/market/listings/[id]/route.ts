import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";

type Ctx = { params: Promise<{ id: string }> };

/** Actions d'administration sur une annonce : masquer / rétablir (motif obligatoire), marquer sponsorisée (toujours affiché). */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const admin = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ moderation: z.enum(["visible", "hidden"]).optional(), sponsored: z.boolean().optional(), note: z.string().trim().min(3).max(500) }));
  const l = await sqlOne<{ seller_id: string; title: string }>("SELECT seller_id, title FROM market_listings WHERE id=$1", [id]);
  if (!l) throw new ApiFailure(404, "Annonce introuvable", "err.notFound");
  if (b.moderation) await sql("UPDATE market_listings SET moderation=$2, moderation_note=$3, updated_at=now() WHERE id=$1", [id, b.moderation, b.note]);
  if (b.sponsored !== undefined) await sql("UPDATE market_listings SET sponsored=$2, updated_at=now() WHERE id=$1", [id, b.sponsored]);
  await audit(admin.id, "human", "market.listing.admin", { kind: "market_listing", id }, { moderation: b.moderation, sponsored: b.sponsored, note: b.note });
  if (b.moderation) await notify(l.seller_id, "market.moderation", `Annonce ${b.moderation === "hidden" ? "masquée" : "rétablie"} : ${l.title}`, b.note, `/marketplace?annonce=${id}`);
  return ok({ ok: true });
});
