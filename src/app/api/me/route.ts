import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/security/crypto";
import { audit } from "@/server/audit";
import { closeSession } from "@/server/auth";
import { SELF_SERVICE_PROFILES } from "@/lib/profiles";

const schema = z.object({
  display_name: z.string().trim().min(2).max(80).optional(),
  locale: z.enum(["wo", "fr", "en"]).optional(),
  fallback_locale: z.enum(["fr", "en"]).optional(),
  country: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  public_profile: z.boolean().optional(),
  autonomy_level: z.number().int().min(1).max(5).optional(),
  organization: z.string().trim().max(120).nullable().optional(),
  job_title: z.string().trim().max(120).nullable().optional(),
  full_name: z.string().trim().max(120).nullable().optional(),
  specialty: z.string().trim().max(120).nullable().optional(),
  professional_summary: z.string().trim().max(3000).nullable().optional(),
  profile_kind: z.enum(SELF_SERVICE_PROFILES as [string, ...string[]]).optional(),
  onboarded: z.literal(true).optional(),
  password: z.object({ current: z.string(), next: z.string().min(10).max(200) }).optional(),
});

export const PATCH = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, schema);
  const sets: string[] = []; const vals: unknown[] = [];
  for (const k of ["display_name", "locale", "fallback_locale", "country", "bio", "public_profile", "autonomy_level", "organization", "job_title", "full_name", "specialty", "professional_summary"] as const) {
    if (b[k] !== undefined) { vals.push(b[k]); sets.push(`${k}=$${vals.length}`); }
  }
  // Un administrateur garde son profil « administrator » ; les autres choisissent parmi les profils libres.
  if (b.profile_kind && !u.is_admin) { vals.push(b.profile_kind); sets.push(`profile_kind=$${vals.length}`); }
  if (b.onboarded) sets.push("onboarded_at=COALESCE(onboarded_at, now())");
  if (b.skills) { vals.push(JSON.stringify(b.skills)); sets.push(`skills=$${vals.length}`); }
  if (b.password) {
    const row = (await sql<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [u.id]))[0];
    if (!verifyPassword(b.password.current, row.password_hash)) throw new ApiFailure(400, "Mot de passe actuel incorrect", "err.credentials");
    vals.push(hashPassword(b.password.next)); sets.push(`password_hash=$${vals.length}`);
    sets.push("session_version=session_version+1");
  }
  if (sets.length) {
    vals.push(u.id);
    await sql(`UPDATE users SET ${sets.join(", ")}, updated_at=now() WHERE id=$${vals.length}`, vals);
  }
  if (b.autonomy_level !== undefined) await audit(u.id, "human", "autonomy.set", { kind: "user", id: u.id }, { level: b.autonomy_level });
  const res = ok({ ok: true, relogin: !!b.password });
  if (b.password) { await audit(u.id, "human", "account.password", { kind: "user", id: u.id }); closeSession(res); }
  return res;
});

/** Export de toutes les données personnelles (portabilité). */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const tables: [string, string][] = [
    ["projects", "SELECT * FROM projects WHERE owner_id=$1"], ["schematics", "SELECT * FROM schematics WHERE owner_id=$1"],
    ["calc_runs", "SELECT * FROM calc_runs WHERE user_id=$1"], ["simulations", "SELECT id, engine, engine_version, analysis, status, created_at FROM simulations WHERE user_id=$1"],
    ["devices", "SELECT id, name, hardware, protocol, environment, capabilities, created_at FROM devices WHERE owner_id=$1"],
    ["ai_messages", "SELECT m.* FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id WHERE c.user_id=$1"],
    ["eco_items", "SELECT * FROM eco_items WHERE owner_id=$1"],
    ["market_listings", "SELECT * FROM market_listings WHERE seller_id=$1"], ["market_inquiries", "SELECT * FROM market_inquiries WHERE buyer_id=$1"],
    ["market_messages", "SELECT * FROM market_messages WHERE author_id=$1"], ["market_favorites", "SELECT * FROM market_favorites WHERE user_id=$1"], ["enrollments", "SELECT * FROM enrollments WHERE user_id=$1"], ["certificates", "SELECT * FROM certificates WHERE user_id=$1"],
  ];
  const out: Record<string, unknown> = { user: u, exported_at: new Date().toISOString() };
  for (const [k, statement] of tables) out[k] = await sql(statement, [u.id]);
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="xamxam-mes-donnees.json"', "Cache-Control": "no-store" } });
});

/** Suppression du compte et de ses données (cascade). */
export const DELETE = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  await audit(u.id, "human", "account.delete", { kind: "user", id: u.id });
  await sql("DELETE FROM users WHERE id=$1", [u.id]);
  const res = ok({ ok: true });
  closeSession(res);
  return res;
});
