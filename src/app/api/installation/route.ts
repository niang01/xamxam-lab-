import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle, ApiFailure } from "@/server/api";
import { adminExists, announceAdminSetup, claimAdmin } from "@/server/accounts";
import { env } from "@/server/env";
import { keySources } from "@/server/keys";
import { mailConfigured } from "@/server/mail";

/** État de l'installation (sans aucune valeur secrète). */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  await announceAdminSetup();
  return ok({
    admin_exists: await adminExists(), you_are_admin: u.is_admin, admin_emails_configured: env.adminEmails.length > 0,
    keys: keySources(), mail_configured: mailConfigured(),
  });
});

/** Initialisation du premier administrateur avec le code écrit dans les journaux du serveur. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "admin-setup", 5, 15 * 60_000);
  const b = await readInput(req, z.object({ code: z.string().trim().min(10).max(40) }));
  try { await claimAdmin(u.id, b.code); }
  catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "exists") throw new ApiFailure(409, (e as Error).message, "inst.err.exists");
    if (code === "bad") throw new ApiFailure(403, (e as Error).message, "inst.err.code");
    throw e;
  }
  return ok({ ok: true });
});
