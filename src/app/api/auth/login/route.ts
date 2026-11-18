import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { sqlOne } from "@/server/db";
import { verifyPassword } from "@/server/security/crypto";
import { openSession } from "@/server/auth";
import { audit } from "@/server/audit";
import { createChallenge, isMfaEnabled } from "@/server/mfa";

const schema = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) });

export const POST = endpoint(async (req) => {
  throttle(req, "login", 20, 5 * 60000);
  const b = await readInput(req, schema);
  const u = await sqlOne<{ id: string; password_hash: string; status: string; session_version: number }>("SELECT id, password_hash, status, session_version FROM users WHERE email=$1", [b.email]);
  if (!u || u.status !== "active" || !verifyPassword(b.password, u.password_hash)) throw new ApiFailure(401, "Identifiants incorrects", "err.credentials");
  // Double authentification active : pas de session tant que le second facteur n'est pas vérifié (/api/auth/mfa).
  if (await isMfaEnabled(u.id)) {
    await audit(u.id, "human", "account.login.password_ok", { kind: "user", id: u.id });
    return ok({ mfa_required: true, challenge: await createChallenge(u.id) });
  }
  await audit(u.id, "human", "account.login", { kind: "user", id: u.id });
  const res = ok({ ok: true });
  await openSession(res, u.id, u.session_version);
  return res;
});
