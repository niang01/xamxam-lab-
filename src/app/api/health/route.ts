import { ok, endpoint } from "@/server/api";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { aiStatus } from "@/server/ai/core";

/** Santé : base, secrets, mode IA. Aucune valeur secrète renvoyée. */
export const GET = endpoint(async () => {
  const db = await getDb();
  await db.query("SELECT 1");
  return ok({
    ok: true, db: db.driver, ai: aiStatus().mode,
    session_secret: process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16 ? "configured" : env.sessionSecret ? "development-default" : "missing",
    admins_configured: env.adminEmails.length > 0, meteomatics_credentials: !!(env.meteomaticsUser && env.meteomaticsPassword), time: new Date().toISOString(),
  });
});
