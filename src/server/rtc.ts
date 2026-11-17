/** Signalisation WebRTC (salles de réunion par projet). Le média circule de pair à pair ; la plateforme ne relaie que la signalisation. */
import { sql } from "./db";

export const PEER_TIMEOUT_S = 20;

export async function cleanupRoom(projectId: string) {
  const stale = await sql<{ id: string }>(`DELETE FROM rtc_peers WHERE project_id=$1 AND last_seen < now() - ($2 || ' seconds')::interval RETURNING id`, [projectId, String(PEER_TIMEOUT_S)]);
  if (stale.length) await sql("DELETE FROM rtc_signals WHERE to_peer = ANY($1::uuid[]) OR from_peer = ANY($1::uuid[])", [stale.map((s) => s.id)]);
  await sql("DELETE FROM rtc_signals WHERE project_id=$1 AND created_at < now() - interval '10 minutes'", [projectId]);
}

export const peers = (projectId: string) => sql<{ id: string; user_id: string; display_name: string; joined_at: string }>("SELECT id, user_id, display_name, joined_at FROM rtc_peers WHERE project_id=$1 ORDER BY joined_at", [projectId]);

/** Serveurs ICE (STUN/TURN) fournis par la configuration : sans eux, les appels ne passent qu'au sein d'un même réseau. */
export function iceServers() {
  const list: { urls: string[]; username?: string; credential?: string }[] = [];
  const stun = (process.env.XX_STUN_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (stun.length) list.push({ urls: stun });
  const turn = (process.env.XX_TURN_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (turn.length && process.env.XX_TURN_USERNAME && process.env.XX_TURN_CREDENTIAL) list.push({ urls: turn, username: process.env.XX_TURN_USERNAME, credential: process.env.XX_TURN_CREDENTIAL });
  return list;
}
