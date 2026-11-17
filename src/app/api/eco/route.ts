import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { ECO_CAPABILITY, ECO_DATA, ECO_KINDS } from "@/server/eco";
import { can } from "@/lib/profiles";
import { audit } from "@/server/audit";
import { requireProject } from "@/server/access";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  const kind = z.enum(ECO_KINDS).parse(sp.get("kind"));
  const text = (sp.get("q") ?? "").trim();
  const items = await sql(`SELECT i.id, i.kind, i.title, i.data, i.sponsored, i.status, i.created_at, i.owner_id, i.project_id, u.display_name AS owner,
      (SELECT COUNT(*)::int FROM eco_links l WHERE l.item_id=i.id AND l.kind IN ('application','entry','booking','connection')) AS interactions,
      (SELECT json_agg(json_build_object('kind', l.kind, 'status', l.status)) FROM eco_links l WHERE l.item_id=i.id AND l.user_id=$1) AS mine
    FROM eco_items i JOIN users u ON u.id=i.owner_id
    WHERE i.kind=$2 AND (i.status='published' OR i.owner_id=$1 OR $4::boolean) AND ($3='' OR i.title ILIKE '%'||$3||'%' OR i.data::text ILIKE '%'||$3||'%')
    ORDER BY i.created_at DESC LIMIT 200`, [u.id, kind, text, u.is_admin]);
  return ok({ items });
});

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const base = await readInput(req, z.object({ kind: z.enum(ECO_KINDS), title: z.string().trim().min(2).max(160), data: z.unknown(), sponsored: z.boolean().default(false), project_id: z.string().uuid().nullable().optional() }));
  if (!can(u.profile_kind, u.is_admin, ECO_CAPABILITY[base.kind])) throw new ApiFailure(403, "Votre profil ne permet pas de publier ce type de contenu", "err.capability");
  const data = ECO_DATA[base.kind].parse(base.data);
  if (base.project_id) await requireProject(base.project_id, u, "owner");
  const r = (await sql<{ id: string }>("INSERT INTO eco_items(kind, owner_id, title, data, sponsored, project_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [base.kind, u.id, base.title, JSON.stringify(data), base.sponsored, base.project_id ?? null]))[0];
  await audit(u.id, "human", `eco.${base.kind}.create`, { kind: "eco_item", id: r.id }, { sponsored: base.sponsored });
  return ok({ id: r.id }, 201);
});
