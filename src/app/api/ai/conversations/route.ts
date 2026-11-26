import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok({ items: await sql("SELECT id, title, project_id, created_at FROM ai_conversations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [u.id]) });
});

/** Suppression de tout l'historique d'Aláji IA de l'utilisateur (conversations, messages, étapes, mémoire). */
export const DELETE = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const r = await sql("DELETE FROM ai_conversations WHERE user_id=$1 RETURNING id", [u.id]);
  await sql("DELETE FROM ai_memory WHERE user_id=$1", [u.id]);
  await audit(u.id, "human", "ai.history.delete", { kind: "user", id: u.id }, { conversations: r.length });
  return ok({ deleted: r.length });
});
