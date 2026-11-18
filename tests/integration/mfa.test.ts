import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as mfaStep from "@/app/api/auth/mfa/route";
import * as mfa from "@/app/api/me/mfa/route";
import * as me from "@/app/api/auth/me/route";
import { base32Decode, totp } from "@/lib/totp";
import { sql } from "@/server/db";

const R = registerRoute.POST as never;
let s: Session;
let secret: Buffer;
let recovery: string[] = [];
const EMAIL = "double@test.local";
const now = () => Math.floor(Date.now() / 1000);
const cookieOf = (h: Headers) => (h.get("set-cookie") ?? "").split(";")[0];
const signIn = () => call(login.POST as never, "POST", "/api/auth/login", { body: { email: EMAIL, password: "motdepasse-123" } });

beforeAll(async () => { s = await register(R, EMAIL); });

describe("Double authentification (TOTP)", () => {
  it("activation : secret chiffré en base, premier code exigé, codes de secours hachés", async () => {
    expect((await call(mfa.GET as never, "GET", "/api/me/mfa", { session: s })).json).toMatchObject({ enabled: false });
    const setup = await call(mfa.POST as never, "POST", "/api/me/mfa", { session: s, body: { action: "setup" } });
    expect(setup.status).toBe(200);
    expect(String(setup.json.uri)).toMatch(/^otpauth:\/\/totp\/XAM-XAM%20LAB:double%40test\.local\?secret=/);
    expect(String(setup.json.qr)).toContain("<svg");
    secret = base32Decode(String(setup.json.secret));
    const stored = await sql<{ secret_enc: string }>("SELECT secret_enc FROM user_mfa");
    expect(stored[0].secret_enc.startsWith("xxe1:")).toBe(true);

    expect((await call(mfa.POST as never, "POST", "/api/me/mfa", { session: s, body: { action: "enable", code: "000000" } })).status).toBe(400);
    const on = await call(mfa.POST as never, "POST", "/api/me/mfa", { session: s, body: { action: "enable", code: totp(secret, now()) } });
    expect(on.status).toBe(200);
    recovery = on.json.recovery_codes as string[];
    expect(recovery).toHaveLength(10);
    const hashes = await sql<{ code_hash: string }>("SELECT code_hash FROM user_recovery_codes");
    expect(hashes.map((h) => h.code_hash)).not.toContain(recovery[0]);
  });

  it("connexion : aucune session après le mot de passe seul ; code exigé ; un code ne sert qu'une fois", async () => {
    const first = await signIn();
    expect(first.json).toMatchObject({ mfa_required: true });
    expect(first.headers.get("set-cookie")).toBeNull();
    const challenge = first.json.challenge as string;
    expect((await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge, code: "123456" } })).status).toBe(401);

    // Le code de l'activation (même pas de 30 s) a déjà servi : refusé (anti-rejeu). On attend le pas suivant.
    const step = Math.floor(now() / 30);
    const replay = await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge, code: totp(secret, now()) } });
    const lastStep = Number((await sql<{ last_step: string }>("SELECT last_step FROM user_mfa"))[0].last_step);
    if (lastStep >= step) expect(replay.status).toBe(401);
    const next = replay.status === 200 ? replay : await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge, code: totp(secret, (lastStep + 1) * 30) } });
    expect(next.status).toBe(200);
    const session = { cookie: cookieOf(next.headers) };
    expect(((await call(me.GET as never, "GET", "/api/auth/me", { session })).json.user as { email: string }).email).toBe(EMAIL);
    // Le défi est consommé
    expect((await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge, code: "000000" } })).status).toBe(401);
  });

  it("défi limité à 5 essais", async () => {
    const challenge = (await signIn()).json.challenge as string;
    for (let i = 0; i < 5; i++) expect((await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge, code: "000000" } })).status).toBe(401);
    const blocked = await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge, recovery_code: recovery[0] } });
    expect(blocked.json.key).toBe("mfa.err.challenge");
  });

  it("code de secours : accepté une seule fois", async () => {
    const c1 = (await signIn()).json.challenge as string;
    const ok = await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge: c1, recovery_code: recovery[1].toLowerCase() } });
    expect(ok.json).toMatchObject({ ok: true, second_factor: "recovery" });
    const c2 = (await signIn()).json.challenge as string;
    expect((await call(mfaStep.POST as never, "POST", "/api/auth/mfa", { body: { challenge: c2, recovery_code: recovery[1] } })).status).toBe(401);
    expect((await call(mfa.GET as never, "GET", "/api/me/mfa", { session: s })).json).toMatchObject({ enabled: true, recovery_remaining: 9 });
  });

  it("désactivation : mot de passe ET second facteur exigés", async () => {
    expect((await call(mfa.POST as never, "POST", "/api/me/mfa", { session: s, body: { action: "disable", password: "faux-mot-de-passe", code: recovery[2] } })).status).toBe(401);
    expect((await call(mfa.POST as never, "POST", "/api/me/mfa", { session: s, body: { action: "disable", password: "motdepasse-123", code: "ZZZZZ-ZZZZZ" } })).status).toBe(400);
    expect((await call(mfa.POST as never, "POST", "/api/me/mfa", { session: s, body: { action: "disable", password: "motdepasse-123", code: recovery[2] } })).status).toBe(200);
    const plain = await signIn();
    expect(plain.json).toMatchObject({ ok: true });
    expect(cookieOf(plain.headers)).toMatch(/^xx_session=/);
    expect((await sql("SELECT 1 FROM user_recovery_codes")).length).toBe(0);
  });
});
