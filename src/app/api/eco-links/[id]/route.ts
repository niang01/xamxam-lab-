import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { notify } from "@/server/settings";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Réponse du propriétaire à une candidature, réservation ou mise en relation. Acceptée : coordonnées échangées (double consentement). */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ status: z.enum(["accepted", "declined"]) }));
  const l = await sqlOne<{ item_id: string; user_id: string; kind: string; owner_id: string; title: string; owner_email: string; user_email: string; owner_name: string }>(
    `SELECT l.item_id, l.user_id, l.kind, i.owner_id, i.title, o.email AS owner_email, o.display_name AS owner_name, p.email AS user_email
     FROM eco_links l JOIN eco_items i ON i.id=l.item_id JOIN users o ON o.id=i.owner_id JOIN users p ON p.id=l.user_id WHERE l.id=$1`, [id]);
  if (!l || l.owner_id !== u.id) throw new ApiFailure(404, "Élément introuvable", "err.notFound");
  if (!["application", "booking", "connection"].includes(l.kind)) throw new ApiFailure(400, "Action non prévue", "err.invalid");
  await sql("UPDATE eco_links SET status=$2 WHERE id=$1", [id, b.status]);
  await notify(l.user_id, `eco.${l.kind}.${b.status}`, `${l.title} : ${b.status === "accepted" ? "acceptée" : "déclinée"}`,
    b.status === "accepted" ? `Contact : ${l.owner_name} <${l.owner_email}>` : null, null);
  await audit(u.id, "human", `eco.link.${b.status}`, { kind: "eco_link", id });
  return ok({ ok: true, contact: b.status === "accepted" ? l.user_email : null });
});
