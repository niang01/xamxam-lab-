import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";

/** Actions de l'IA en attente d'approbation humaine. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ items: await sql("SELECT id, conversation_id, agent_key, tool, input, error, required_level, created_at FROM ai_steps WHERE user_id=$1 AND status='awaiting_approval' ORDER BY created_at DESC", [u.id]) });
});
