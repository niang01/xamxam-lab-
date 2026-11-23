import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as meRoute from "@/app/api/me/route";
import * as forgot from "@/app/api/auth/password/forgot/route";
import * as reset from "@/app/api/auth/password/reset/route";
import * as verify from "@/app/api/auth/verify-email/route";
import * as installation from "@/app/api/installation/route";
import * as adminUsers from "@/app/api/admin/users/route";
import * as adminActions from "@/app/api/admin/users/[id]/actions/route";
import * as adminLic from "@/app/api/admin/licences/route";
import * as licence from "@/app/api/licence/route";
import * as projects from "@/app/api/projects/route";
import { sql } from "@/server/db";
import { sendMail } from "@/server/mail";
import { adminSetupCode, issueToken } from "@/server/accounts";
import { forgetEntitlements, generateLicenceKey, keyHash } from "@/server/licensing";

const R = registerRoute.POST as never;
const cookieOf = (h: Headers) => ({ cookie: (h.get("set-cookie") ?? "").split(";")[0] });
const signIn = (email: string, password = "motdepasse-123", ip = "198.51.100.1") => call(login.POST as never, "POST", "/api/auth/login", { body: { email, password }, headers: { "x-forwarded-for": ip } });
const userId = async (email: string) => (await sql<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]))[0].id;

let admin: Session, user: Session;
beforeAll(async () => {
  admin = await register(R, "admin@test.local");
  user = await register(R, "awa@test.local", "student");
});

describe("Comptes", () => {
  it("administrateur : adresse déclarée dans XX_ADMIN_EMAILS → administrateur ; essai de 90 jours créé à l'inscription", async () => {
    const a = (await call(me.GET as never, "GET", "/api/auth/me", { session: admin })).json.user as { is_admin: boolean; access: { state: string } };
    expect(a.is_admin).toBe(true); expect(a.access.state).toBe("admin");
    const u = (await call(me.GET as never, "GET", "/api/auth/me", { session: user })).json.user as { is_admin: boolean; onboarded_at: string | null; access: { state: string; days_left: number } };
    expect(u.is_admin).toBe(false); expect(u.onboarded_at).toBeNull();
    expect(u.access.state).toBe("trial"); expect(u.access.days_left).toBe(90);
  });

  it("configuration du profil après inscription", async () => {
    const r = await call(meRoute.PATCH as never, "PATCH", "/api/me", { session: user, body: { organization: "Lycée technique de Thiès", job_title: "BTS électrotechnique", profile_kind: "technician", skills: ["électricité", "ESP32"], onboarded: true } });
    expect(r.status).toBe(200);
    const u = (await call(me.GET as never, "GET", "/api/auth/me", { session: user })).json.user as Record<string, unknown>;
    expect(u).toMatchObject({ organization: "Lycée technique de Thiès", job_title: "BTS électrotechnique", profile_kind: "technician" });
    expect(u.onboarded_at).toBeTruthy();
    // Le profil « administrator » ne peut pas être choisi par formulaire.
    expect((await call(meRoute.PATCH as never, "PATCH", "/api/me", { session: user, body: { profile_kind: "administrator" } })).status).toBe(400);
  });

  it("verrouillage après 5 mots de passe incorrects, sans révéler l'existence d'un compte", async () => {
    await register(R, "bloque@test.local");
    for (let i = 0; i < 5; i++) expect((await signIn("bloque@test.local", "mauvais-mot-de-passe", `198.51.100.${10 + i}`)).status).toBe(401);
    const locked = await signIn("bloque@test.local", "motdepasse-123", "198.51.100.30");
    expect(locked.status).toBe(423);
    expect((await signIn("inconnu@test.local", "x", "198.51.100.31")).status).toBe(401);
    // Déblocage par l'administrateur
    expect((await call(adminActions.POST as never, "POST", "/x", { session: admin, params: { id: await userId("bloque@test.local") }, body: { action: "unlock" } })).status).toBe(200);
    expect((await signIn("bloque@test.local", "motdepasse-123", "198.51.100.32")).status).toBe(200);
  });

  it("mot de passe oublié sans fournisseur de courriel : réponse identique, aucun envoi simulé", async () => {
    const a = await call(forgot.POST as never, "POST", "/api/auth/password/forgot", { body: { email: "awa@test.local" }, headers: { "x-forwarded-for": "198.51.100.40" } });
    const b = await call(forgot.POST as never, "POST", "/api/auth/password/forgot", { body: { email: "personne@test.local" }, headers: { "x-forwarded-for": "198.51.100.41" } });
    expect(a.json).toEqual({ ok: true, mail: "not_configured" }); expect(b.json).toEqual(a.json);
    expect((await sql("SELECT 1 FROM auth_tokens WHERE kind='password_reset'")).length).toBe(0);
  });

  it("lien de réinitialisation généré par l'administrateur : usage unique, anciennes sessions révoquées", async () => {
    const id = await userId("awa@test.local");
    expect((await call(adminActions.POST as never, "POST", "/x", { session: user, params: { id }, body: { action: "reset_link" } })).status).toBe(403);
    const r = await call(adminActions.POST as never, "POST", "/x", { session: admin, params: { id }, body: { action: "reset_link" } });
    const link = String(r.json.link);
    expect(link).toMatch(/\/reinitialisation\?jeton=/);
    const token = decodeURIComponent(link.split("jeton=")[1]);
    expect((await sql<{ token_hash: string }>("SELECT token_hash FROM auth_tokens WHERE kind='password_reset'"))[0].token_hash).not.toBe(token);
    expect((await call(reset.POST as never, "POST", "/x", { body: { token, password: "court" } })).status).toBe(400);
    expect((await call(reset.POST as never, "POST", "/x", { body: { token, password: "nouveau-mot-de-passe-1" } })).status).toBe(200);
    expect((await call(reset.POST as never, "POST", "/x", { body: { token, password: "encore-un-autre-1" } })).json.key).toBe("err.tokenInvalid");
    expect((await call(me.GET as never, "GET", "/api/auth/me", { session: user })).json.user).toBeNull();
    const again = await signIn("awa@test.local", "nouveau-mot-de-passe-1", "198.51.100.50");
    expect(again.status).toBe(200);
    user = cookieOf(again.headers);
  });

  it("vérification d'adresse par jeton (usage unique)", async () => {
    const id = await userId("awa@test.local");
    const { token } = await issueToken("email_verify", id);
    expect((await call(verify.POST as never, "POST", "/x", { body: { token } })).status).toBe(200);
    expect((await call(verify.POST as never, "POST", "/x", { body: { token } })).status).toBe(400);
    expect((await sql<{ v: string | null }>("SELECT email_verified_at AS v FROM users WHERE id=$1", [id]))[0].v).toBeTruthy();
  });

  it("courriel : envoi déclaré accepté seulement sur réponse 2xx du fournisseur", async () => {
    const saved = { ...process.env };
    Object.assign(process.env, { XX_MAIL_PROVIDER: "brevo", XX_MAIL_API_KEY: "cle-de-test-brevo", XX_MAIL_FROM: "lab@exemple.sn" });
    try {
      const seen: { url: string; body: string }[] = [];
      const okFetch = (async (url: string, init: RequestInit) => { seen.push({ url, body: String(init.body) }); return new Response(JSON.stringify({ messageId: "<m1>" }), { status: 201 }); }) as unknown as typeof fetch;
      expect(await sendMail({ to: "a@b.sn", subject: "s", text: "t" }, okFetch)).toEqual({ accepted: true, provider: "brevo", id: "<m1>" });
      expect(seen[0].url).toBe("https://api.brevo.com/v3/smtp/email");
      const ko = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
      await expect(sendMail({ to: "a@b.sn", subject: "s", text: "t" }, ko)).rejects.toThrow(/HTTP 401/);
    } finally { for (const k of ["XX_MAIL_PROVIDER", "XX_MAIL_API_KEY", "XX_MAIL_FROM"]) if (!(k in saved)) delete process.env[k]; }
  });

  it("code d'initialisation : refusé dès qu'un administrateur existe ; accepté sinon", async () => {
    const code = adminSetupCode()!;
    expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){4}$/);
    expect((await call(installation.POST as never, "POST", "/api/installation", { session: user, body: { code } })).status).toBe(409);
    await sql("UPDATE users SET is_admin=false WHERE email='admin@test.local'");
    try {
      expect((await call(installation.POST as never, "POST", "/api/installation", { session: user, body: { code: "AAAA-BBBB-CCCC-DDDD-EEEE" }, headers: { "x-forwarded-for": "198.51.100.60" } })).status).toBe(403);
      const ok = await call(installation.POST as never, "POST", "/api/installation", { session: user, body: { code }, headers: { "x-forwarded-for": "198.51.100.61" } });
      expect(ok.status).toBe(200);
      expect((await sql<{ is_admin: boolean }>("SELECT is_admin FROM users WHERE email='awa@test.local'"))[0].is_admin).toBe(true);
    } finally {
      await sql("UPDATE users SET is_admin=true WHERE email='admin@test.local'");
      await sql("UPDATE users SET is_admin=false, profile_kind='technician' WHERE email='awa@test.local'");
      forgetEntitlements();
    }
  });
});

describe("Essai gratuit et licences (contrôle côté serveur)", () => {
  it("clés : format, unicité, jamais stockées en clair", () => {
    const keys = new Set(Array.from({ length: 2000 }, generateLicenceKey));
    expect(keys.size).toBe(2000);
    for (const k of [...keys].slice(0, 20)) expect(k).toMatch(/^XXL(-[A-HJ-NP-Z2-9]{5}){5}$/);
    const k = [...keys][0];
    expect(keyHash(k)).toBe(keyHash(k.toLowerCase().replace(/-/g, " ")));
    expect(keyHash(k)).not.toContain(k.slice(4, 9));
  });

  it("essai terminé → fonctions bloquées (402), compte et licence toujours accessibles", async () => {
    const id = await userId("awa@test.local");
    expect((await call(projects.GET as never, "GET", "/api/projects", { session: user })).status).toBe(200);
    // Fin d'essai simulée en déplaçant la date de création ET en recréant l'essai par le serveur (étiquette valide).
    await sql("DELETE FROM trials WHERE user_id=$1", [id]);
    await sql("UPDATE users SET created_at = now() - interval '91 days' WHERE id=$1", [id]);
    forgetEntitlements();
    const blocked = await call(projects.GET as never, "GET", "/api/projects", { session: user });
    expect(blocked.status).toBe(402); expect(blocked.json.key).toBe("err.licence");
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: user })).json.state).toBe("expired");
    expect((await call(me.GET as never, "GET", "/api/auth/me", { session: user })).status).toBe(200);
  });

  it("modification frauduleuse de la date d'essai détectée", async () => {
    const id = await userId("awa@test.local");
    await sql("UPDATE trials SET ends_at = now() + interval '5 years' WHERE user_id=$1", [id]);
    forgetEntitlements();
    const r = await call(projects.GET as never, "GET", "/api/projects", { session: user });
    expect(r.status).toBe(402); expect(r.json.key).toBe("err.licenceTampered");
    // Rétablissement par l'administrateur (prolongation journalisée, étiquette recalculée)
    await sql("DELETE FROM trials WHERE user_id=$1", [id]);
    forgetEntitlements();
  });

  it("catégorie, émission, activation, postes, renouvellement, révocation, historique", async () => {
    expect((await call(adminLic.POST as never, "POST", "/x", { session: user, body: { action: "create_plan", code: "x", name: "x", duration_days: 1 } })).status).toBe(403);
    const plan = await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "create_plan", code: "etudiant-annuel", name: "Étudiant annuel", duration_days: 365, seats: 1, price_xof: 15000 } });
    expect(plan.status).toBe(200);
    const planId = (plan.json.plan as { id: string }).id;
    const issued = await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "issue", plan_id: planId, count: 2 } });
    const [k1, k2] = (issued.json.keys as { key: string }[]).map((k) => k.key);
    expect(JSON.stringify(await sql("SELECT * FROM licences"))).not.toContain(k1);

    expect((await call(licence.POST as never, "POST", "/api/licence", { session: user, body: { key: "XXL-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE" } })).status).toBe(404);
    const act = await call(licence.POST as never, "POST", "/api/licence", { session: user, body: { key: k1 } });
    expect(act.status).toBe(200); expect(act.json.state).toBe("licensed");
    expect((await call(projects.GET as never, "GET", "/api/projects", { session: user })).status).toBe(200);
    expect((await call(licence.POST as never, "POST", "/api/licence", { session: user, body: { key: k1 } })).json.key).toBe("lic.err.already");
    // Partage abusif : un second compte ne peut pas utiliser le poste unique
    const other = await register(R, "partage@test.local");
    expect((await call(licence.POST as never, "POST", "/api/licence", { session: other, body: { key: k1 } })).json.key).toBe("lic.err.seats");

    // Modification frauduleuse de l'échéance détectée
    const lic = (await sql<{ id: string; expires_at: string }>("SELECT id, expires_at FROM licences WHERE status='active'"))[0];
    await sql("UPDATE licences SET expires_at = expires_at + interval '10 years' WHERE id=$1", [lic.id]);
    forgetEntitlements();
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: user })).json.state).toBe("tampered");
    await sql("UPDATE licences SET expires_at=$2 WHERE id=$1", [lic.id, lic.expires_at]);
    forgetEntitlements();
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: user })).json.state).toBe("licensed");

    // Renouvellement : +30 jours
    const before = new Date(lic.expires_at).getTime();
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "renew", licence_id: lic.id, days: 30 } })).status).toBe(200);
    const after = new Date((await sql<{ expires_at: string }>("SELECT expires_at FROM licences WHERE id=$1", [lic.id]))[0].expires_at).getTime();
    expect(Math.round((after - before) / 86400_000)).toBe(30);
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: user })).json.state).toBe("licensed");

    // Attribution manuelle de la seconde clé par l'administrateur
    const second = (await sql<{ id: string }>("SELECT id FROM licences WHERE status='issued'"))[0].id;
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "assign", licence_id: second, email: "partage@test.local" } })).status).toBe(200);
    expect((await call(licence.GET as never, "GET", "/api/licence", { session: other })).json.state).toBe("licensed");
    void k2;

    // Révocation → accès refusé (essai de 'awa' terminé)
    expect((await call(adminLic.POST as never, "POST", "/x", { session: admin, body: { action: "revoke", licence_id: lic.id, reason: "test" } })).status).toBe(200);
    expect((await call(projects.GET as never, "GET", "/api/projects", { session: user })).status).toBe(402);
    expect((await call(licence.POST as never, "POST", "/api/licence", { session: user, body: { key: k1 } })).json.key).toBe("lic.err.revoked");

    const board = await call(adminLic.GET as never, "GET", "/x", { session: admin });
    expect((board.json.events as { action: string }[]).map((e) => e.action)).toEqual(expect.arrayContaining(["licence.issue", "licence.activate", "licence.renew", "licence.revoke"]));
    const users = await call(adminUsers.GET as never, "GET", "/x", { session: admin });
    const awa = (users.json.items as { email: string; access: { state: string } }[]).find((u) => u.email === "awa@test.local")!;
    expect(awa.access.state).toBe("expired");
  });

  it("prolongation de l'essai par l'administrateur", async () => {
    const id = await userId("awa@test.local");
    expect((await call(adminActions.POST as never, "POST", "/x", { session: admin, params: { id }, body: { action: "extend_trial", days: 30 } })).status).toBe(200);
    const l = (await call(licence.GET as never, "GET", "/api/licence", { session: user })).json as { state: string; trial: { days_left: number } };
    expect(l.state).toBe("trial"); expect(l.trial.days_left).toBe(30);
  });
});
