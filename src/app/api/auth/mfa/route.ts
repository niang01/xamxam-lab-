import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { sqlOne } from "@/server/db";
import { openSession } from "@/server/auth";
import { audit } from "@/server/audit";
import { endChallenge, useChallenge, verifySecondFactor } from "@/server/mfa";
import { notify } from "@/server/settings";

const schema = z.object({
  challenge: z.string().min(20).max(100),
  code: z.string().trim().max(12).nullable().optional(),
  recovery_code: z.string().trim().max(20).nullable().optional(),
}).refine((v) => !!v.code || !!v.recovery_code, { message: "Code requis" });

/** Seconde étape de connexion : code de l'application d'authentification ou code de secours. */
export const POST = endpoint(async (req) => {
  throttle(req, "mfa", 20, 5 * 60_000);
  const b = await readInput(req, schema);
  const c = await useChallenge(b.challenge);
  if (!c) throw new ApiFailure(401, "Étape expirée ou trop d'essais : reconnectez-vous", "mfa.err.challenge");
  const user = await sqlOne<{ id: string; status: string; session_version: number }>("SELECT id, status, session_version FROM users WHERE id=$1", [c.userId]);
  if (!user || user.status !== "active") throw new ApiFailure(401, "Identifiants incorrects", "err.credentials");
  const how = await verifySecondFactor(user.id, b);
  if (!how) {
    await audit(user.id, "human", "account.mfa.failed", { kind: "user", id: user.id });
    throw new ApiFailure(401, "Code incorrect", "mfa.err.code");
  }
  await endChallenge(c.hash);
  await audit(user.id, "human", "account.login", { kind: "user", id: user.id }, { second_factor: how });
  if (how === "recovery") await notify(user.id, "security", "Code de secours utilisé", "Un code de secours a servi à vous connecter. Régénérez vos codes si ce n'était pas vous.", "/settings");
  const res = ok({ ok: true, second_factor: how });
  await openSession(res, user.id, user.session_version);
  return res;
});
