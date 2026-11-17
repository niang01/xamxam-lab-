import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { ranking } from "@/server/eco";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const item = await sqlOne<{ id: string; kind: string; owner_id: string; status: string }>("SELECT i.*, u.display_name AS owner FROM eco_items i JOIN users u ON u.id=i.owner_id WHERE i.id=$1", [id]);
  if (!item || (item.status !== "published" && item.owner_id !== u.id && !u.is_admin)) throw new ApiFailure(404, "Élément introuvable", "err.notFound");
  const owner = item.owner_id === u.id || u.is_admin;
  const jury = (await sql<{ user_id: string }>("SELECT user_id FROM eco_links WHERE item_id=$1 AND kind='jury' AND status='accepted'", [id])).map((r) => r.user_id);
  const isJury = jury.includes(u.id);
  // Propriétaire : toutes les interactions ; jury : les dossiers ; autres : leurs propres liens.
  const links = await sql(`SELECT l.id, l.kind, l.data, l.status, l.created_at, l.user_id, u.display_name AS user FROM eco_links l JOIN users u ON u.id=l.user_id
    WHERE l.item_id=$1 AND ($2::boolean OR l.user_id=$3 OR ($4::boolean AND l.kind='entry') OR (l.kind IN ('entry','score') AND $5::boolean)) ORDER BY l.created_at`, [id, owner, u.id, isJury, item.kind === "challenge"]);
  let rank = null;
  if (item.kind === "challenge") {
    const entries = await sql<{ id: string; user: string }>("SELECT l.id, u.display_name AS user FROM eco_links l JOIN users u ON u.id=l.user_id WHERE l.item_id=$1 AND l.kind='entry'", [id]);
    const scores = await sql<{ entry_id: string; score: number }>("SELECT data->>'entry_id' AS entry_id, (data->>'score')::float AS score FROM eco_links WHERE item_id=$1 AND kind='score'", [id]);
    rank = ranking(entries, scores);
  }
  return ok({ item, links, is_owner: owner, is_jury: isJury, ranking: rank });
});

/** Propriétaire : publier / clore ; administrateur : modération (masquer / rétablir). */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ status: z.enum(["published", "hidden", "closed"]) }));
  const item = await sqlOne<{ owner_id: string }>("SELECT owner_id FROM eco_items WHERE id=$1", [id]);
  if (!item) throw new ApiFailure(404, "Élément introuvable", "err.notFound");
  if (!u.is_admin && (item.owner_id !== u.id || b.status === "hidden")) throw new ApiFailure(403, "Droits insuffisants", "err.forbidden");
  await sql("UPDATE eco_items SET status=$2 WHERE id=$1", [id, b.status]);
  await audit(u.id, "human", "eco.status", { kind: "eco_item", id }, b);
  return ok({ ok: true });
});
