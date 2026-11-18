import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";
import { inquiryFor } from "@/server/market";
import { canMoveInquiry, INQUIRY_STATUSES } from "@/lib/market";

type Ctx = { params: Promise<{ id: string }> };

/** Fil d'une demande (réservé aux deux parties). */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const inq = await inquiryFor(await uuidParam(ctx), u);
  const messages = await sql(`SELECT m.id, m.body, m.created_at, m.author_id=$2 AS mine, a.display_name AS author
    FROM market_messages m JOIN users a ON a.id=m.author_id WHERE m.inquiry_id=$1 ORDER BY m.created_at`, [inq.id, u.id]);
  return ok({ inquiry: inq, messages });
});

/** Le vendeur accepte ou décline ; l'une ou l'autre partie clôt. Accepter n'engage aucun paiement via la plateforme. */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const inq = await inquiryFor(await uuidParam(ctx), u);
  const { status } = await readInput(req, z.object({ status: z.enum(INQUIRY_STATUSES) }));
  if (!canMoveInquiry(inq.status, status, inq.role)) throw new ApiFailure(409, "Changement d'état non permis", "market.err.transition");
  await sql("UPDATE market_inquiries SET status=$2, updated_at=now() WHERE id=$1", [inq.id, status]);
  await audit(u.id, "human", "market.inquiry.status", { kind: "market_inquiry", id: inq.id }, { from: inq.status, to: status });
  const other = inq.role === "buyer" ? inq.seller_id : inq.buyer_id;
  await notify(other, "market.inquiry.status", `Demande « ${inq.title} » : ${status}`, null, `/marketplace?demande=${inq.id}`);
  return ok({ status });
});
