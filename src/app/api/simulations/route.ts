import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const rows = await sql(`SELECT s.id, s.engine, s.engine_version, s.kind, s.analysis, s.status, s.initiated_by, s.created_at, s.duration_ms, p.title AS project_title
    FROM simulations s LEFT JOIN projects p ON p.id=s.project_id
    WHERE s.user_id=$1 OR s.project_id IN (SELECT project_id FROM project_members WHERE user_id=$1) ORDER BY s.created_at DESC LIMIT 200`, [u.id]);
  return ok({ items: rows });
});
