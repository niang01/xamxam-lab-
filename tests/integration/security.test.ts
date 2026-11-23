import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { call, register } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";

const API = path.join(import.meta.dirname, "../../src/app/api");
const routes: string[] = [];
const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === "route.ts") routes.push(p); } };
walk(API);

/** Routes publiques assumées (et leur comportement sans session). */
const PUBLIC: Record<string, number[]> = {
  "auth/register": [400], "auth/login": [400, 401], "auth/mfa": [400, 401], "auth/logout": [200], "auth/me": [200], "i18n/catalog": [200], "health": [200],
  "public/certificates/[id]": [404], "public/portfolio/[id]": [404],
  "device/ingest": [401], "device/commands": [401], "device/ack": [401], "device/whoami": [401],
};
const params = { id: "00000000-0000-4000-8000-000000000000", kind: "ohm" };

describe("Sécurité de l'API", () => {
  it(`chacune des ${routes.length} routes refuse l'accès sans session (sauf routes publiques documentées)`, async () => {
    const failures: string[] = [];
    let checked = 0;
    for (const file of routes) {
      const rel = path.relative(API, path.dirname(file)).split(path.sep).join("/");
      const mod = (await import(file)) as Record<string, unknown>;
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        const h = mod[method];
        if (typeof h !== "function") continue;
        checked++;
        const r = await call(h as never, method, `/api/${rel}?kind=startup&fluid=R134a&peer=${params.id}`, { params, body: method === "GET" ? undefined : {} });
        const ok = PUBLIC[rel] ? PUBLIC[rel].includes(r.status) : r.status === 401;
        if (!ok) failures.push(`${method} /api/${rel} → ${r.status}`);
      }
    }
    expect(checked).toBeGreaterThan(90);
    expect(failures).toEqual([]);
  }, 120000);

  it("un compte ordinaire n'atteint aucune fonction d'administration", async () => {
    const eng = await register(registerRoute.POST as never, "ordinaire@test.local");
    const admin: [string, string, unknown?][] = [["GET", "admin/users"], ["PATCH", "admin/users", { id: params.id, status: "disabled" }], ["GET", "admin/backup"], ["GET", "command-center"],
      ["POST", "command-center", { kind: "switch", key: "ai_enabled", value: false }], ["POST", "normative-tables", {}], ["POST", "i18n/import", { lang: "wo", format: "csv", content: "", mode: "validated" }], ["GET", "i18n/export"], ["GET", "i18n/entries"]];
    for (const [m, rel, body] of admin) {
      const mod = (await import(path.join(API, rel, "route.ts"))) as Record<string, unknown>;
      const r = await call(mod[m] as never, m, `/api/${rel}`, { session: eng, body });
      expect([401, 403], `${m} ${rel}`).toContain(r.status);
    }
  });

  it("limitation de débit sur la connexion", async () => {
    const login = (await import(path.join(API, "auth/login/route.ts"))).POST as never;
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await call(login, "POST", "/api/auth/login", { body: { email: "x@y.z", password: "faux" }, headers: { "x-forwarded-for": "203.0.113.9" } })).status);
    expect(statuses).toContain(429);
  });

  it("mot de passe trop court et adresse invalide refusés ; mot de passe jamais renvoyé", async () => {
    const R = registerRoute.POST as never;
    expect((await call(R, "POST", "/x", { body: { email: "a@b.c", password: "court", display_name: "A", profile_kind: "student" } })).status).toBe(400);
    expect((await call(R, "POST", "/x", { body: { email: "pas-une-adresse", password: "motdepasse-123", display_name: "A", profile_kind: "student" } })).status).toBe(400);
    const s = await register(R, "secret@test.local");
    const me = await call((await import(path.join(API, "auth/me/route.ts"))).GET as never, "GET", "/api/auth/me", { session: s });
    expect(JSON.stringify(me.json)).not.toMatch(/password|xxs1/);
  });
});

describe("Configuration incomplète", () => {
  it("sans SESSION_SECRET en production : inscription refusée AVANT toute création de compte", async () => {
    const { sql } = await import("@/server/db");
    const saved = { s: process.env.SESSION_SECRET, n: process.env.NODE_ENV };
    delete process.env.SESSION_SECRET; (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      const reg = (await import(path.join(API, "auth/register/route.ts"))).POST as never;
      const r = await call(reg, "POST", "/api/auth/register", { body: { email: "orphelin@test.local", password: "motdepasse-123", display_name: "Orphelin", profile_kind: "engineer", locale: "fr" }, headers: { "x-forwarded-for": "203.0.113.77" } });
      expect(r.status).toBe(503);
      expect(r.json.key).toBe("err.serverConfig");
      expect((await sql("SELECT 1 FROM users WHERE email='orphelin@test.local'")).length).toBe(0);
    } finally { process.env.SESSION_SECRET = saved.s; (process.env as Record<string, string>).NODE_ENV = saved.n!; }
  });
});
