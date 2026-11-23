import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { consumeToken } from "@/server/accounts";
import { audit } from "@/server/audit";

export const POST = endpoint(async (req) => {
  throttle(req, "verify-email", 20, 15 * 60_000);
  const b = await readInput(req, z.object({ token: z.string().min(20).max(200) }));
  const userId = await consumeToken("email_verify", b.token);
  if (!userId) throw new ApiFailure(400, "Lien invalide, expiré ou déjà utilisé", "err.tokenInvalid");
  await sql("UPDATE users SET email_verified_at=now() WHERE id=$1", [userId]);
  await audit(userId, "human", "account.email_verified", { kind: "user", id: userId });
  return ok({ ok: true });
});
