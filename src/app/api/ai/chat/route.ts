import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { requireProject } from "@/server/access";
import { askCore } from "@/server/ai/core";

export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "ai", 30);
  const b = await readInput(req, z.object({ question: z.string().trim().min(1).max(8000), conversation_id: z.string().uuid().nullable().optional(), project_id: z.string().uuid().nullable().optional(), lang: z.enum(["wo", "fr", "en"]).optional(), agents: z.array(z.string().max(30)).max(10).optional() }));
  if (b.project_id) await requireProject(b.project_id, u, "viewer");
  return ok(await askCore(b.question, { user: u, conversationId: b.conversation_id, projectId: b.project_id ?? null, lang: b.lang ?? u.locale, agents: b.agents }));
});
