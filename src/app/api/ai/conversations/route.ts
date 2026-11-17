import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ items: await sql("SELECT id, title, project_id, created_at FROM ai_conversations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [u.id]) });
});
