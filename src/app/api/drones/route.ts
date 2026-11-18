import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { randomToken, sha256 } from "@/server/security/crypto";
import { audit } from "@/server/audit";
import { can } from "@/lib/profiles";
import { DRONE_CAPABILITIES } from "@/server/drones";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const items = await sql(`SELECT d.id, d.name, d.environment, d.status, d.last_seen, s.state, s.updated_at AS state_at, s.home_lat, s.home_lon,
      (p.device_id IS NOT NULL) AS has_profile
    FROM devices d LEFT JOIN drone_state s ON s.device_id=d.id LEFT JOIN drone_profiles p ON p.device_id=d.id
    WHERE d.hardware='drone' AND d.protocol='mavlink' AND (d.owner_id=$1 OR d.project_id IN (SELECT project_id FROM project_members WHERE user_id=$1))
    ORDER BY d.created_at DESC`, [u.id]);
  return ok({ items, now: new Date().toISOString() });
});

/** Enregistre un drone MAVLink : jeton affiché une seule fois (à donner au pont services/drone_bridge.py). */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  if (!can(u.profile_kind, u.is_admin, "devices")) throw new ApiFailure(403, "Profil non autorisé", "err.capability");
  const b = await readInput(req, z.object({ name: z.string().trim().min(2).max(80), environment: z.enum(["virtual", "bench", "real"]), project_id: z.uuid().nullable().optional() }));
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const token = randomToken();
  const d = (await sql<{ id: string }>(`INSERT INTO devices(owner_id, project_id, name, hardware, protocol, environment, capabilities, token_hash) VALUES ($1,$2,$3,'drone','mavlink',$4,$5,$6) RETURNING id`,
    [u.id, b.project_id ?? null, b.name, b.environment, JSON.stringify(DRONE_CAPABILITIES), sha256(token)]))[0];
  await audit(u.id, "human", "drone.register", { kind: "device", id: d.id }, { name: b.name, environment: b.environment });
  return ok({ id: d.id, token }, 201);
});
