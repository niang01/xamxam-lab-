import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";
import { getSetting, setSetting } from "@/server/settings";
import { audit, verifyAuditChain } from "@/server/audit";
import { AGENTS } from "@/server/ai/agents";
import { expireCommands } from "@/server/iot";

/** AI Command Center (administrateurs) : état réel de la plateforme, coupe-circuits, révocations, audit. */
export const GET = endpoint(async (req) => {
  await mustBeAdmin(req);
  await expireCommands();
  const disabled = new Set((await sql<{ key: string }>("SELECT key FROM ai_agents WHERE enabled=false")).map((r) => r.key));
  const stepStats = await sql<{ agent_key: string; status: string; n: number }>("SELECT agent_key, status, COUNT(*)::int n FROM ai_steps WHERE created_at > now() - interval '7 days' GROUP BY agent_key, status");
  const [ops, sims, devices, automations, sessions, pendingCmds, audits, users, usage, perms] = await Promise.all([
    sql("SELECT s.id, s.agent_key, s.tool, s.status, s.error, s.created_at, u.display_name FROM ai_steps s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 40"),
    sql("SELECT s.id, s.engine_version, s.analysis, s.status, s.duration_ms, s.created_at, u.display_name FROM simulations s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 20"),
    sql("SELECT d.id, d.name, d.environment, d.status, d.last_seen, u.display_name AS owner FROM devices d JOIN users u ON u.id=d.owner_id ORDER BY d.last_seen DESC NULLS LAST LIMIT 100"),
    sql("SELECT a.id, a.name, a.enabled, a.preauthorized, a.last_fired_at, u.display_name AS owner FROM automations a JOIN users u ON u.id=a.owner_id ORDER BY a.created_at DESC LIMIT 100"),
    sql("SELECT s.id, s.mode, s.status, s.started_at, d.name AS device, u.display_name AS pilot FROM rc_sessions s JOIN devices d ON d.id=s.device_id JOIN users u ON u.id=s.pilot_id ORDER BY s.started_at DESC LIMIT 30"),
    sql("SELECT c.id, c.action, c.status, c.proposed_by, c.created_at, d.name AS device FROM device_commands c JOIN devices d ON d.id=c.device_id WHERE c.status IN ('proposed','confirmed','sent') ORDER BY c.created_at DESC LIMIT 50"),
    sql("SELECT id, actor_kind, action, object_kind, object_id, details, created_at FROM audit_log ORDER BY id DESC LIMIT 100"),
    sql("SELECT COUNT(*)::int n FROM users"),
    sql(`SELECT (SELECT COUNT(*)::int FROM ai_messages WHERE role='assistant' AND mode='llm' AND created_at > now() - interval '24 hours') AS llm_24h,
      (SELECT COUNT(*)::int FROM ai_messages WHERE role='assistant' AND created_at > now() - interval '24 hours') AS answers_24h,
      (SELECT COALESCE(SUM(duration_ms),0)::int FROM simulations WHERE created_at > now() - interval '24 hours') AS sim_ms_24h,
      (SELECT COUNT(*)::int FROM measurements WHERE received_at > now() - interval '24 hours') AS readings_24h`),
    sql("SELECT u.id, u.display_name, u.autonomy_level FROM users u WHERE u.autonomy_level >= 4 ORDER BY u.autonomy_level DESC"),
  ]);
  return ok({
    switches: { ai_enabled: await getSetting("ai_enabled", true), automations_enabled: await getSetting("automations_enabled", true), devices_enabled: await getSetting("devices_enabled", true) },
    agents: AGENTS.map((a) => ({ key: a.key, name: a.name, enabled: !disabled.has(a.key), stats: Object.fromEntries(stepStats.filter((s) => s.agent_key === a.key).map((s) => [s.status, s.n])) })),
    ops, sims, devices, automations, sessions, pendingCmds, audits, users: users[0], usage: usage[0], highAutonomy: perms, auditChain: await verifyAuditChain(), now: new Date().toISOString(),
  });
});

const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("switch"), key: z.enum(["ai_enabled", "automations_enabled", "devices_enabled"]), value: z.boolean() }),
  z.object({ kind: z.literal("agent"), key: z.string().max(30), enabled: z.boolean() }),
  z.object({ kind: z.literal("revoke_device"), device_id: z.string().uuid() }),
  z.object({ kind: z.literal("disable_automation"), automation_id: z.string().uuid() }),
  z.object({ kind: z.literal("cancel_command"), command_id: z.string().uuid() }),
  z.object({ kind: z.literal("reset_autonomy"), user_id: z.string().uuid() }),
  z.object({ kind: z.literal("end_session"), session_id: z.string().uuid() }),
]);

export const POST = endpoint(async (req) => {
  const u = await mustBeAdmin(req);
  const b = await readInput(req, action);
  switch (b.kind) {
    case "switch": await setSetting(b.key, b.value, u.id); if (b.key === "devices_enabled" && !b.value) await sql("UPDATE device_commands SET status='cancelled' WHERE status IN ('proposed','confirmed') AND action NOT IN ('stop','off','estop')"); break;
    case "agent": await sql("INSERT INTO ai_agents(key, enabled) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now()", [b.key, b.enabled]); break;
    case "revoke_device": await sql("UPDATE devices SET status='disabled' WHERE id=$1", [b.device_id]); await sql("UPDATE device_commands SET status='cancelled' WHERE device_id=$1 AND status IN ('proposed','confirmed')", [b.device_id]); break;
    case "disable_automation": await sql("UPDATE automations SET enabled=false, preauthorized=false, preauthorized_by=NULL WHERE id=$1", [b.automation_id]); break;
    case "cancel_command": await sql("UPDATE device_commands SET status='cancelled' WHERE id=$1 AND status IN ('proposed','confirmed')", [b.command_id]); break;
    case "reset_autonomy": await sql("UPDATE users SET autonomy_level=2 WHERE id=$1", [b.user_id]); await sql("UPDATE automations SET preauthorized=false, preauthorized_by=NULL WHERE preauthorized_by=$1", [b.user_id]); break;
    case "end_session": await sql("UPDATE rc_sessions SET status='ended', ended_at=now() WHERE id=$1 AND status='active'", [b.session_id]); break;
  }
  await audit(u.id, "human", `command_center.${b.kind}`, null, b);
  return ok({ ok: true });
});
