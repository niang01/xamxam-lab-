import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure, throttle } from "@/server/api";
import { sqlOne } from "@/server/db";
import { verifyPassword } from "@/server/security/crypto";
import { audit } from "@/server/audit";
import { beginSetup, disable, enable, mfaState, regenerateRecovery, verifySecondFactor } from "@/server/mfa";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  return ok(await mfaState(u.id));
});

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup") }),
  z.object({ action: z.literal("enable"), code: z.string().trim().min(6).max(12) }),
  z.object({ action: z.literal("disable"), password: z.string().min(1).max(200), code: z.string().trim().max(20) }),
  z.object({ action: z.literal("recovery"), password: z.string().min(1).max(200), code: z.string().trim().max(20) }),
]);

/** Activation (préparation puis vérification d'un premier code), désactivation et nouveaux codes de secours (mot de passe + code). */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "mfa-settings", 20, 10 * 60_000);
  const b = await readInput(req, action);
  if (b.action === "setup") return ok(await beginSetup(u.id, u.email));
  if (b.action === "enable") {
    const codes = await enable(u.id, b.code);
    await audit(u.id, "human", "account.mfa.enable", { kind: "user", id: u.id });
    return ok({ enabled: true, recovery_codes: codes });
  }
  const row = await sqlOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [u.id]);
  if (!verifyPassword(b.password, row?.password_hash)) throw new ApiFailure(401, "Mot de passe incorrect", "err.credentials");
  if (!(await mfaState(u.id)).enabled) throw new ApiFailure(409, "Double authentification inactive", "mfa.err.inactive");
  const factor = /^\d{6}$/.test(b.code.replace(/\s/g, "")) ? { code: b.code } : { recovery_code: b.code };
  if (!(await verifySecondFactor(u.id, factor))) throw new ApiFailure(400, "Code incorrect", "mfa.err.code");
  if (b.action === "disable") {
    await disable(u.id);
    await audit(u.id, "human", "account.mfa.disable", { kind: "user", id: u.id });
    return ok({ enabled: false });
  }
  const codes = await regenerateRecovery(u.id);
  await audit(u.id, "human", "account.mfa.recovery_regenerated", { kind: "user", id: u.id });
  return ok({ recovery_codes: codes });
});
