import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { aiStatus, governanceState, levelFor } from "@/server/ai/core";
import { AGENTS } from "@/server/ai/agents";
import { sql } from "@/server/db";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const g = await governanceState();
  const projectId = new URL(req.url).searchParams.get("project");
  // Activité réelle de chaque agent pour ce compte (étapes exécutées, inscrites au journal).
  const act = new Map((await sql<{ agent_key: string; n: number }>("SELECT agent_key, COUNT(*)::int AS n FROM ai_steps WHERE user_id=$1 AND status IN ('done','approved') GROUP BY agent_key", [u.id])).map((r) => [r.agent_key, r.n]));
  return ok({ ...aiStatus(), aiEnabled: g.aiEnabled, level: await levelFor(u, projectId && /^[0-9a-f-]{36}$/.test(projectId) ? projectId : null),
    agents: AGENTS.map((a) => ({ key: a.key, name: a.name, domain: a.domain, tools: a.tools, limits: a.limits, enabled: !g.disabled.has(a.key), runs: act.get(a.key) ?? 0 })) });
});
