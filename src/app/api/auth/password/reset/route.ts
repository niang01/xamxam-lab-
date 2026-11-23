import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { consumeToken } from "@/server/accounts";
import { hashPassword } from "@/server/security/crypto";
import { audit } from "@/server/audit";

/** Nouveau mot de passe à partir d'un lien à usage unique ; toutes les sessions existantes sont révoquées. */
export const POST = endpoint(async (req) => {
  throttle(req, "pw-reset", 10, 15 * 60_000);
  const b = await readInput(req, z.object({ token: z.string().min(20).max(200), password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères").max(200) }));
  const userId = await consumeToken("password_reset", b.token);
  if (!userId) throw new ApiFailure(400, "Lien invalide, expiré ou déjà utilisé : demandez-en un nouveau", "err.tokenInvalid");
  await sql("UPDATE users SET password_hash=$2, session_version=session_version+1, failed_logins=0, locked_until=NULL, updated_at=now() WHERE id=$1", [userId, hashPassword(b.password)]);
  await audit(userId, "human", "account.password_reset", { kind: "user", id: userId });
  return ok({ ok: true });
});
