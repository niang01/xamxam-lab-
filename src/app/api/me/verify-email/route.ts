import { ok, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { sendVerification } from "@/server/verification";

/** Renvoi du lien de vérification de l'adresse. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, `verify-resend-${u.id}`, 3, 60 * 60_000);
  if (u.email_verified_at) return ok({ verification: "already" });
  return ok({ verification: await sendVerification(u.id, u.email, req) });
});
