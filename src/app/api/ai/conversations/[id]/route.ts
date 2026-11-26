import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const c = await sqlOne("SELECT * FROM ai_conversations WHERE id=$1 AND user_id=$2", [id, u.id]);
  if (!c) throw new ApiFailure(404, "Conversation introuvable", "err.notFound");
  const messages = await sql("SELECT role, content, mode, model, agents, created_at FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at", [id]);
  const steps = await sql("SELECT id, agent_key, tool, status, error, required_level, created_at, duration_ms FROM ai_steps WHERE conversation_id=$1 ORDER BY created_at", [id]);
  return ok({ conversation: c, messages, steps });
});

/** Suppression d'une conversation (messages et étapes associés) par son auteur ; inscrite au journal d'audit. */
export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const r = await sql("DELETE FROM ai_conversations WHERE id=$1 AND user_id=$2 RETURNING id", [id, u.id]);
  if (!r.length) throw new ApiFailure(404, "Conversation introuvable", "err.notFound");
  await audit(u.id, "human", "ai.conversation.delete", { kind: "ai_conversation", id });
  return ok({ ok: true });
});
