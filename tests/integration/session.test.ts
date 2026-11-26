/** Reconnexion automatique : session glissante (renouvelée tant que le compte est actif), révocation toujours effective. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as me from "@/app/api/auth/me/route";
import { sql } from "@/server/db";
import { env } from "@/server/env";
import { SESSION_COOKIE, signSession, verifySession } from "@/server/security/session";

const DAY = 24 * 3600;
let user: Session, id: string, ver: number;
const forge = async (expInS: number, v = ver) => ({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(await signSession({ sub: id, exp: Math.floor(Date.now() / 1000) + expInS, ver: v }, env.sessionSecret!))}` });
const renewed = (h: Headers) => (h.get("set-cookie") ?? "").split(/,(?=\s*\w+=)/).map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`) && !c.startsWith(`${SESSION_COOKIE}=;`));

beforeAll(async () => {
  user = await register(registerRoute.POST as never, "session@test.local");
  const r = (await sql<{ id: string; session_version: number }>("SELECT id, session_version FROM users WHERE email='session@test.local'"))[0];
  id = r.id; ver = r.session_version;
});

describe("Session et reconnexion automatique", () => {
  it("session récente : reconnue, pas de nouveau cookie", async () => {
    const r = await call(me.GET as never, "GET", "/api/auth/me", { session: user });
    expect((r.json.user as { id: string }).id).toBe(id);
    expect(renewed(r.headers)).toBeUndefined();
  });
  it("session proche de l'expiration (3 jours) : renouvelée pour 14 jours sans ressaisie du mot de passe", async () => {
    const r = await call(me.GET as never, "GET", "/api/auth/me", { session: await forge(3 * DAY) });
    expect((r.json.user as { id: string }).id).toBe(id);
    const c = renewed(r.headers)!;
    expect(c).toMatch(/Max-Age=1209600/);
    const p = await verifySession(decodeURIComponent(c.split(";")[0].slice(SESSION_COOKIE.length + 1)), env.sessionSecret);
    expect(p!.sub).toBe(id); expect(p!.exp - Date.now() / 1000).toBeGreaterThan(13.9 * DAY);
  });
  it("session expirée ou révoquée (version changée) : non reconnue et jamais renouvelée", async () => {
    const expired = await call(me.GET as never, "GET", "/api/auth/me", { session: await forge(-60) });
    expect(expired.json.user).toBeNull(); expect(renewed(expired.headers)).toBeUndefined();
    const revoked = await call(me.GET as never, "GET", "/api/auth/me", { session: await forge(2 * DAY, ver + 1) });
    expect(revoked.json.user).toBeNull(); expect(renewed(revoked.headers)).toBeUndefined();
  });
});
