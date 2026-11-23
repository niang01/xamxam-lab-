import { ok, endpoint } from "@/server/api";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { aiStatus } from "@/server/ai/core";
import { keySources } from "@/server/keys";
import { adminExists, announceAdminSetup } from "@/server/accounts";
import { mailConfigured } from "@/server/mail";

/** Santé : base, origine des clés, administrateur, mode IA. Aucune valeur secrète renvoyée. */
export const GET = endpoint(async () => {
  const db = await getDb();
  await db.query("SELECT 1");
  await announceAdminSetup();
  const keys = keySources();
  return ok({
    ok: true, db: db.driver, ai: aiStatus().mode,
    // "environment" : variable de l'hébergeur ; "database" : clé aléatoire générée et conservée dans la base du projet.
    session_secret: keys.session === "missing" ? "missing" : keys.session === "development" ? "development-default" : "configured",
    session_key_source: keys.session, encryption_key_source: keys.encryption,
    admins_configured: env.adminEmails.length > 0, admin_exists: await adminExists(), mail_configured: mailConfigured(),
    meteomatics_credentials: !!(env.meteomaticsUser && env.meteomaticsPassword), time: new Date().toISOString(),
  });
});
