import { describe, expect, it, vi } from "vitest";
import { call, register } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as meRoute from "@/app/api/me/route";
import { sql } from "@/server/db";

const SECRET = "Mon-Secret-Tres-Particulier-42";

describe("Profil professionnel", () => {
  it("présentation de moi et nom complet dès l'inscription ; tous les champs modifiables ensuite", async () => {
    const r = await call(registerRoute.POST as never, "POST", "/api/auth/register", { body: { email: "profil@test.local", password: "motdepasse-123", display_name: "Awa", profile_kind: "engineer", locale: "fr", full_name: "Awa Ndiaye", bio: "Passionnée d'énergie solaire." } });
    expect(r.status).toBe(201);
    const s = { cookie: (r.headers.get("set-cookie") ?? "").split(";")[0] };
    let u = (await call(me.GET as never, "GET", "/api/auth/me", { session: s })).json.user as Record<string, unknown>;
    expect(u).toMatchObject({ full_name: "Awa Ndiaye", bio: "Passionnée d'énergie solaire." });
    expect((await call(meRoute.PATCH as never, "PATCH", "/api/me", { session: s, body: { job_title: "Ingénieure", specialty: "Photovoltaïque", organization: "Université de Thiès", country: "Sénégal", professional_summary: "5 ans d'expérience.", bio: "Nouvelle présentation." } })).status).toBe(200);
    u = (await call(me.GET as never, "GET", "/api/auth/me", { session: s })).json.user as Record<string, unknown>;
    expect(u).toMatchObject({ job_title: "Ingénieure", specialty: "Photovoltaïque", organization: "Université de Thiès", country: "Sénégal", professional_summary: "5 ans d'expérience.", bio: "Nouvelle présentation." });
    expect((await call(meRoute.PATCH as never, "PATCH", "/api/me", { session: s, body: { professional_summary: "x".repeat(3001) } })).status).toBe(400);
  });
});

describe("Mots de passe : jamais en clair (base, réponses, journaux)", () => {
  it("aucune trace du mot de passe saisi, y compris lors des erreurs", async () => {
    const logs: string[] = [];
    const spies = (["log", "error", "warn", "info"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); }));
    try {
      const bad = await call(registerRoute.POST as never, "POST", "/api/auth/register", { body: { email: "pas-une-adresse", password: SECRET, display_name: "X", profile_kind: "student" } });
      expect(bad.status).toBe(400);
      expect(JSON.stringify(bad.json)).not.toContain(SECRET);
      const short = await call(registerRoute.POST as never, "POST", "/api/auth/register", { body: { email: "a@b.sn", password: "Court-1", display_name: "Xy", profile_kind: "student" } });
      expect(JSON.stringify(short.json)).not.toContain("Court-1");
      const s = await register(registerRoute.POST as never, "secret-clair@test.local");
      void s;
      await sql("UPDATE users SET password_hash=$2 WHERE email=$1", ["secret-clair@test.local", (await import("@/server/security/crypto")).hashPassword(SECRET)]);
      const wrong = await call(login.POST as never, "POST", "/api/auth/login", { body: { email: "secret-clair@test.local", password: SECRET + "x" }, headers: { "x-forwarded-for": "198.51.100.90" } });
      expect(wrong.status).toBe(401); expect(JSON.stringify(wrong.json)).not.toContain(SECRET);
      const ok = await call(login.POST as never, "POST", "/api/auth/login", { body: { email: "secret-clair@test.local", password: SECRET }, headers: { "x-forwarded-for": "198.51.100.91" } });
      expect(ok.status).toBe(200);
    } finally { spies.forEach((x) => x.mockRestore()); }
    expect(logs.join("\n")).not.toContain(SECRET);
    const dump = JSON.stringify([await sql("SELECT * FROM users"), await sql("SELECT * FROM audit_log"), await sql("SELECT * FROM auth_tokens")]);
    expect(dump).not.toContain(SECRET);
    expect((await sql<{ password_hash: string }>("SELECT password_hash FROM users WHERE email='secret-clair@test.local'"))[0].password_hash).toMatch(/^xxs1:16384:/);
  });
});
