import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { deviceSchema } from "@/server/schemas";
import { randomToken, sha256 } from "@/server/security/crypto";
import { audit } from "@/server/audit";
import { can } from "@/lib/profiles";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const rows = await sql(`SELECT d.id, d.name, d.hardware, d.protocol, d.environment, d.capabilities, d.status, d.firmware_version, d.last_seen, d.project_id, d.owner_id, p.title AS project_title,
      (SELECT json_agg(x) FROM (SELECT DISTINCT ON (metric) metric, value, unit, ts, quality FROM measurements m WHERE m.device_id=d.id ORDER BY metric, ts DESC) x) AS latest
    FROM devices d LEFT JOIN projects p ON p.id=d.project_id
    WHERE d.owner_id=$1 OR d.project_id IN (SELECT project_id FROM project_members WHERE user_id=$1) ORDER BY d.created_at DESC`, [u.id]);
  return ok({ items: rows, now: new Date().toISOString() });
});

/** Enregistrement : le jeton n'est affiché qu'une fois ; seule son empreinte SHA-256 est conservée. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  if (!can(u.profile_kind, u.is_admin, "devices")) throw new ApiFailure(403, "Profil non autorisé", "err.capability");
  const b = await readInput(req, deviceSchema);
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const token = randomToken();
  const d = (await sql<{ id: string }>(`INSERT INTO devices(owner_id, project_id, name, hardware, protocol, environment, capabilities, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [u.id, b.project_id ?? null, b.name, b.hardware, b.protocol, b.environment, JSON.stringify(b.capabilities), sha256(token)]))[0];
  await audit(u.id, "human", "device.register", { kind: "device", id: d.id }, { name: b.name, environment: b.environment });
  return ok({ id: d.id, token }, 201);
});
