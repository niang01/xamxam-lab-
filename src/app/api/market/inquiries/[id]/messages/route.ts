import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure, throttle } from "@/server/api";
import { sql } from "@/server/db";
import { notify } from "@/server/settings";
import { inquiryFor } from "@/server/market";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "market-message", 120, 60 * 60_000);
  const inq = await inquiryFor(await uuidParam(ctx), u);
  if (inq.status === "declined" || inq.status === "closed") throw new ApiFailure(409, "Demande close", "market.err.closed");
  const { body } = await readInput(req, z.object({ body: z.string().trim().min(1).max(4000) }));
  const m = (await sql<{ id: string }>("INSERT INTO market_messages(inquiry_id, author_id, body) VALUES ($1,$2,$3) RETURNING id", [inq.id, u.id, body]))[0];
  await sql("UPDATE market_inquiries SET updated_at=now() WHERE id=$1", [inq.id]);
  await notify(inq.role === "buyer" ? inq.seller_id : inq.buyer_id, "market.message", `Message : ${inq.title}`, `${u.display_name} : ${body.slice(0, 140)}`, `/marketplace?demande=${inq.id}`);
  return ok({ id: m.id }, 201);
});
