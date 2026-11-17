import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";

/** Vue d'ensemble de l'utilisateur : uniquement des comptages réels de ses données. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const one = async (statement: string) => (await sql<{ n: number }>(statement, [u.id]))[0]?.n ?? 0;
  const projectsSql = "SELECT p.id FROM projects p WHERE p.owner_id=$1 OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1)";
  const [projects, sims, simsFailed, devices, devicesLive, pendingCmd, approvals, tasks, courses] = await Promise.all([
    one(`SELECT COUNT(*)::int n FROM (${projectsSql}) x`),
    one("SELECT COUNT(*)::int n FROM simulations WHERE user_id=$1"),
    one("SELECT COUNT(*)::int n FROM simulations WHERE user_id=$1 AND status='failed'"),
    one("SELECT COUNT(*)::int n FROM devices WHERE owner_id=$1 AND status='active'"),
    one("SELECT COUNT(*)::int n FROM devices WHERE owner_id=$1 AND status='active' AND last_seen > now() - interval '15 minutes'"),
    one("SELECT COUNT(*)::int n FROM device_commands c JOIN devices d ON d.id=c.device_id WHERE d.owner_id=$1 AND c.status='proposed' AND c.expires_at > now()"),
    one("SELECT COUNT(*)::int n FROM ai_steps WHERE user_id=$1 AND status='awaiting_approval'"),
    one(`SELECT COUNT(*)::int n FROM project_tasks t WHERE t.status<>'done' AND (t.assignee_id=$1 OR t.created_by=$1)`),
    one("SELECT COUNT(*)::int n FROM enrollments WHERE user_id=$1"),
  ]);
  const recentProjects = await sql(`SELECT id, title, kind, updated_at FROM projects WHERE id IN (${projectsSql}) ORDER BY updated_at DESC LIMIT 5`, [u.id]);
  const recentSims = await sql("SELECT id, engine, analysis, status, created_at FROM simulations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5", [u.id]);
  return ok({ counts: { projects, sims, simsFailed, devices, devicesLive, devicesOffline: devices - devicesLive, pendingCmd, approvals, tasks, courses }, recentProjects, recentSims });
});
