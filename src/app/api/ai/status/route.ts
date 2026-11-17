import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { aiStatus, governanceState, levelFor } from "@/server/ai/core";
import { AGENTS } from "@/server/ai/agents";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const g = await governanceState();
  const projectId = new URL(req.url).searchParams.get("project");
  return ok({ ...aiStatus(), aiEnabled: g.aiEnabled, level: await levelFor(u, projectId && /^[0-9a-f-]{36}$/.test(projectId) ? projectId : null),
    agents: AGENTS.map((a) => ({ key: a.key, name: a.name, domain: a.domain, tools: a.tools, limits: a.limits, enabled: !g.disabled.has(a.key) })) });
});
