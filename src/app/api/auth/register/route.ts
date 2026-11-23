import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { hashPassword } from "@/server/security/crypto";
import { openSession } from "@/server/auth";
import { SELF_SERVICE_PROFILES } from "@/lib/profiles";
import { env } from "@/server/env";
import { audit } from "@/server/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
  display_name: z.string().trim().min(2).max(80),
  profile_kind: z.enum(SELF_SERVICE_PROFILES as [string, ...string[]]),
  locale: z.enum(["wo", "fr", "en"]).default("wo"),
  fallback_locale: z.enum(["fr", "en"]).default("fr"),
});

export const POST = endpoint(async (req) => {
  throttle(req, "register", 20, 10 * 60000);
  // Vérifier la configuration AVANT toute écriture : sans secret de session, aucun compte n'est créé.
  if (!env.sessionSecret) throw new ApiFailure(503, "SESSION_SECRET n'est pas configuré sur le serveur : inscription impossible pour le moment", "err.serverConfig");
  const b = await readInput(req, schema);
  if (await sqlOne("SELECT 1 FROM users WHERE email=$1", [b.email])) throw new ApiFailure(409, "Adresse déjà utilisée", "err.emailTaken");
  // Administrateur : uniquement les adresses déclarées par l'exploitant (XX_ADMIN_EMAILS). Aucune élévation par formulaire.
  const isAdmin = env.adminEmails.includes(b.email);
  const u = (await sql<{ id: string; session_version: number }>(
    `INSERT INTO users(email, password_hash, display_name, profile_kind, is_admin, locale, fallback_locale) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, session_version`,
    [b.email, hashPassword(b.password), b.display_name, isAdmin ? "administrator" : b.profile_kind, isAdmin, b.locale, b.fallback_locale]))[0];
  await audit(u.id, "human", "account.create", { kind: "user", id: u.id }, { profile: b.profile_kind, admin: isAdmin });
  const res = ok({ ok: true }, 201);
  await openSession(res, u.id, u.session_version);
  return res;
});
