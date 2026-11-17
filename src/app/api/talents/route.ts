import { ok, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { can } from "@/lib/profiles";

/**
 * Recherche de talents : uniquement les profils rendus publics par leur titulaire (consentement), sur les compétences
 * et réalisations. Aucun critère personnel sensible (âge, sexe, origine…) n'est stocké ni filtrable.
 */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  if (!can(u.profile_kind, u.is_admin, "search_talents")) throw new ApiFailure(403, "Profil non autorisé", "err.capability");
  const text = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const items = await sql(`SELECT u.id, u.display_name, u.profile_kind, u.country, u.bio, u.skills,
      (SELECT COUNT(*)::int FROM certificates c WHERE c.user_id=u.id) AS certificates,
      (SELECT COUNT(*)::int FROM projects p WHERE p.owner_id=u.id AND p.visibility='public') AS public_projects
    FROM users u WHERE u.public_profile AND u.status='active' AND ($1='' OR u.skills::text ILIKE '%'||$1||'%' OR COALESCE(u.bio,'') ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
    ORDER BY certificates DESC, public_projects DESC LIMIT 100`, [text]);
  return ok({ items });
});
