import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { forgetDevices } from "@/server/devices";
import { forgetEntitlements, resumeLicence, suspendLicence, LicenceError, assignLicence, deactivateSeat, issueLicences, renewLicence, revokeLicence } from "@/server/licensing";

/** Tableau de bord des licences : catégories, licences (sans clé), postes, historique. */
export const GET = endpoint(async (req) => {
  await mustBeAdmin(req);
  const plans = await sql("SELECT * FROM licence_plans ORDER BY created_at");
  const licences = await sql(`SELECT l.id, l.max_devices, l.key_hint, l.organization, l.seats, l.duration_days, l.status, l.activated_at, l.expires_at, l.note, l.issued_at, l.revoked_at,
      p.code AS plan_code, p.name AS plan_name,
      COALESCE((SELECT json_agg(json_build_object('user_id', u.id, 'email', u.email, 'activated_at', a.activated_at) ORDER BY a.activated_at)
        FROM licence_activations a JOIN users u ON u.id=a.user_id WHERE a.licence_id=l.id AND a.deactivated_at IS NULL), '[]') AS holders
    FROM licences l JOIN licence_plans p ON p.id=l.plan_id ORDER BY l.issued_at DESC LIMIT 1000`);
  const events = await sql(`SELECT e.id, e.action, e.details, e.created_at, l.key_hint, u.email AS user_email, x.email AS actor_email
    FROM licence_events e LEFT JOIN licences l ON l.id=e.licence_id LEFT JOIN users u ON u.id=e.user_id LEFT JOIN users x ON x.id=e.actor_id
    ORDER BY e.id DESC LIMIT 200`);
  return ok({ plans, licences, events });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_plan"), code: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Code : minuscules, chiffres et tirets"), name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).nullable().default(null), duration_days: z.number().int().min(1).max(3660), seats: z.number().int().min(1).max(10000).default(1),
    price_xof: z.number().int().min(0).nullable().default(null), max_devices: z.number().int().min(1).max(100).nullable().default(null) }),
  z.object({ action: z.literal("suspend"), licence_id: z.string().uuid(), reason: z.string().trim().max(300).nullable().default(null) }),
  z.object({ action: z.literal("resume"), licence_id: z.string().uuid() }),
  z.object({ action: z.literal("set_devices"), licence_id: z.string().uuid(), max_devices: z.number().int().min(1).max(100).nullable() }),
  z.object({ action: z.literal("toggle_plan"), plan_id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("issue"), plan_id: z.string().uuid(), count: z.number().int().min(1).max(100).default(1), organization: z.string().trim().max(120).nullable().default(null),
    seats: z.number().int().min(1).max(10000).nullable().default(null), note: z.string().trim().max(500).nullable().default(null), assign_email: z.string().trim().toLowerCase().email().nullable().default(null) }),
  z.object({ action: z.literal("assign"), licence_id: z.string().uuid(), email: z.string().trim().toLowerCase().email() }),
  z.object({ action: z.literal("revoke"), licence_id: z.string().uuid(), reason: z.string().trim().max(300).nullable().default(null) }),
  z.object({ action: z.literal("deactivate"), licence_id: z.string().uuid(), user_id: z.string().uuid() }),
  z.object({ action: z.literal("renew"), licence_id: z.string().uuid(), days: z.number().int().min(1).max(3660) }),
]);

async function userIdByEmail(email: string): Promise<string> {
  const u = (await sql<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]))[0];
  if (!u) throw new LicenceError(404, `Aucun compte avec l'adresse ${email}`, "lic.err.user");
  return u.id;
}

export const POST = endpoint(async (req) => {
  const a = await mustBeAdmin(req);
  const b = await readInput(req, schema);
  let result: Record<string, unknown> = { ok: true };
  switch (b.action) {
    case "create_plan":
      result.plan = (await sql("INSERT INTO licence_plans(code, name, description, duration_days, seats, price_xof, max_devices) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [b.code, b.name, b.description, b.duration_days, b.seats, b.price_xof, b.max_devices]))[0];
      break;
    case "toggle_plan": await sql("UPDATE licence_plans SET active=$2 WHERE id=$1", [b.plan_id, b.active]); break;
    case "issue": {
      const assignTo = b.assign_email ? await userIdByEmail(b.assign_email) : null;
      const keys = await issueLicences({ plan_id: b.plan_id, count: assignTo ? 1 : b.count, organization: b.organization, seats: b.seats, note: b.note, actorId: a.id });
      if (assignTo) await assignLicence(keys[0].id, assignTo, a.id);
      result = { keys, assigned: !!assignTo };
      break;
    }
    case "assign": await assignLicence(b.licence_id, await userIdByEmail(b.email), a.id); break;
    case "revoke": await revokeLicence(b.licence_id, a.id, b.reason); break;
    case "deactivate": await deactivateSeat(b.licence_id, b.user_id, a.id); break;
    case "renew": await renewLicence(b.licence_id, b.days, a.id); break;
    case "suspend": await suspendLicence(b.licence_id, a.id, b.reason); break;
    case "resume": await resumeLicence(b.licence_id, a.id); break;
    case "set_devices": await sql("UPDATE licences SET max_devices=$2 WHERE id=$1", [b.licence_id, b.max_devices]); forgetEntitlements(); forgetDevices(); break;
  }
  await audit(a.id, "human", `admin.licence.${b.action}`, null, { ...b });
  return ok(result);
});
