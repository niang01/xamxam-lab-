/** Licences : suspension / réactivation, limite d'appareils autorisés, retrait d'un appareil (contrôle serveur). */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as adminLic from "@/app/api/admin/licences/route";
import * as adminActions from "@/app/api/admin/users/[id]/actions/route";
import * as licence from "@/app/api/licence/route";
import * as projects from "@/app/api/projects/route";
import { sql } from "@/server/db";
import { forgetEntitlements } from "@/server/licensing";

const R = registerRoute.POST as never;
const dev = (s: Session, d: string): Session => ({ cookie: `${s.cookie}; xx_device=${d}` });
const A = "appareil-aaaaaaaaaaaaaaaaaaaa", B = "appareil-bbbbbbbbbbbbbbbbbbbb", C = "appareil-cccccccccccccccccccc";
const get = (s: Session) => call(projects.GET as never, "GET", "/api/projects", { session: s });
let admin: Session, user: Session, userId: string, licenceId: string;

beforeAll(async () => {
  admin = await register(R, "admin@test.local");
  user = await register(R, "fatou@test.local", "student");
  userId = (await sql<{ id: string }>("SELECT id FROM users WHERE email='fatou@test.local'"))[0].id;
  // Fin de l'essai : seul l'accès par licence compte.
  await sql("UPDATE users SET created_at = now() - interval '91 days' WHERE id=$1", [userId]);
  await sql("DELETE FROM trials WHERE user_id=$1", [userId]);
  forgetEntitlements();
  expect((await get(dev(user, A))).status).toBe(402);
  const plan = await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "create_plan", code: "deux-appareils", name: "Deux appareils", duration_days: 365, seats: 1, max_devices: 2 } });
  expect(plan.status).toBe(200);
  const issued = await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "issue", plan_id: (plan.json.plan as { id: string }).id, count: 1 } });
  const key = (issued.json.keys as { key: string }[])[0].key;
  expect((await call(licence.POST as never, "POST", "/api/licence", { session: dev(user, A), body: { key } })).status).toBe(200);
  licenceId = (await sql<{ id: string }>("SELECT id FROM licences WHERE status='active'"))[0].id;
});

describe("Appareils autorisés", () => {
  it("la connexion attribue un identifiant d'appareil (cookie httpOnly), la session reste le premier cookie", async () => {
    const r = await call(R, "POST", "/api/auth/register", { body: { email: "cookie@test.local", password: "motdepasse-123", display_name: "Cookie", profile_kind: "engineer", locale: "fr" } });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const c = r.headers.get("set-cookie") ?? "";
    expect(c).toMatch(/xx_device=[\w-]{20,}; Path=\/; HttpOnly/);
    expect(c.split(";")[0]).not.toContain("xx_device");
  });

  it("limite de 2 appareils : le 3e est refusé (402), retirer un appareil libère une place", async () => {
    expect((await get(dev(user, A))).status).toBe(200);
    expect((await get(dev(user, B))).status).toBe(200);
    const third = await get(dev(user, C));
    expect(third.status).toBe(402); expect(third.json.key).toBe("err.devices");
    // Sans identifiant d'appareil : refusé quand la licence est limitée.
    expect((await get(user)).status).toBe(402);
    const l = (await call(licence.GET as never, "GET", "/api/licence", { session: dev(user, A) })).json as { devices: { id: string }[]; this_device: string; licence: { max_devices: number } };
    expect(l.devices).toHaveLength(2); expect(l.licence.max_devices).toBe(2);
    expect(JSON.stringify(l)).not.toContain(A); // seule l'empreinte est stockée, jamais l'identifiant
    const other = l.devices.find((d) => d.id !== l.this_device)!;
    expect((await call(licence.DELETE as never, "DELETE", `/api/licence?device=${other.id}`, { session: dev(user, A) })).status).toBe(200);
    expect((await get(dev(user, C))).status).toBe(200);
    expect((await get(dev(user, B))).status).toBe(402);
  });

  it("l'administrateur change la limite et réinitialise les appareils", async () => {
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "set_devices", licence_id: licenceId, max_devices: 3 } })).status).toBe(200);
    expect((await get(dev(user, B))).status).toBe(200);
    expect((await call(adminActions.POST as never, "POST", "/x", { session: admin, params: { id: userId }, body: { action: "reset_devices" } })).status).toBe(200);
    expect((await sql("SELECT 1 FROM user_devices WHERE user_id=$1 AND revoked_at IS NULL", [userId])).length).toBe(0);
    expect((await get(dev(user, A))).status).toBe(200);
    // Un compte non administrateur ne peut pas modifier la limite.
    expect((await call(adminLic.POST as never, "POST", "/x", { session: user, body: { action: "set_devices", licence_id: licenceId, max_devices: 100 } })).status).toBe(403);
  });
});

describe("Suspension", () => {
  it("suspendre bloque l'accès (402), réactiver le rétablit ; intégrité conservée ; journal", async () => {
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "suspend", licence_id: licenceId, reason: "impayé" } })).status).toBe(200);
    expect((await get(dev(user, A))).status).toBe(402);
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: dev(user, A) })).json.state).not.toBe("licensed");
    // Une licence déjà suspendue ne peut pas l'être de nouveau.
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "suspend", licence_id: licenceId, reason: null } })).status).toBe(409);
    // Modifier le statut en base sans passer par l'API : détecté comme altéré.
    await sql("UPDATE licences SET status='active' WHERE id=$1", [licenceId]); forgetEntitlements();
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: dev(user, A) })).json.state).toBe("tampered");
    await sql("UPDATE licences SET status='suspended' WHERE id=$1", [licenceId]); forgetEntitlements();
    // Échéance modifiée en base pendant la suspension : la réactivation est refusée.
    const exp = (await sql<{ expires_at: string }>("SELECT expires_at FROM licences WHERE id=$1", [licenceId]))[0].expires_at;
    await sql("UPDATE licences SET expires_at = expires_at + interval '5 years' WHERE id=$1", [licenceId]);
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "resume", licence_id: licenceId } })).json.key).toBe("lic.err.tampered");
    await sql("UPDATE licences SET expires_at=$2 WHERE id=$1", [licenceId, exp]);
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "resume", licence_id: licenceId } })).status).toBe(200);
    expect((await get(dev(user, A))).status).toBe(200);
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: dev(user, A) })).json.state).toBe("licensed");
    const board = await call(adminLic.GET as never, "GET", "/x", { session: admin });
    expect((board.json.events as { action: string }[]).map((e) => e.action)).toEqual(expect.arrayContaining(["licence.suspend", "licence.resume"]));
  });
});
