import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { getDb, sql, sqlOne } from "@/server/db";
import { hashPassword } from "@/server/security/crypto";
import { openSession } from "@/server/auth";
import { SELF_SERVICE_PROFILES } from "@/lib/profiles";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { ensureTrial } from "@/server/licensing";
import { sendVerification } from "@/server/verification";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse électronique invalide").max(200),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères").max(200),
  display_name: z.string().trim().min(2, "Le nom affiché doit contenir au moins 2 caractères").max(80),
  profile_kind: z.enum(SELF_SERVICE_PROFILES as [string, ...string[]]),
  full_name: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(), // « Présentation de moi »
  locale: z.enum(["wo", "fr", "en"]).default("wo"),
  fallback_locale: z.enum(["fr", "en"]).default("fr"),
});

export const POST = endpoint(async (req) => {
  throttle(req, "register", 20, 10 * 60000);
  await getDb(); // charge les clés du serveur (variables d'environnement ou clé conservée en base)
  // Vérifier la configuration AVANT toute écriture : sans clé de session, aucun compte n'est créé.
  if (!env.sessionSecret) throw new ApiFailure(503, "Clé de session indisponible sur le serveur : inscription impossible pour le moment", "err.serverConfig");
  const b = await readInput(req, schema);
  if (await sqlOne("SELECT 1 FROM users WHERE email=$1", [b.email])) throw new ApiFailure(409, "Adresse déjà utilisée", "err.emailTaken");
  // Administrateur : uniquement les adresses déclarées par l'exploitant (XX_ADMIN_EMAILS). Aucune élévation par formulaire.
  const isAdmin = env.adminEmails.includes(b.email);
  const u = (await sql<{ id: string; session_version: number }>(
    `INSERT INTO users(email, password_hash, display_name, profile_kind, is_admin, locale, fallback_locale, last_login_at, full_name, bio) VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8, $9) RETURNING id, session_version`,
    [b.email, hashPassword(b.password), b.display_name, isAdmin ? "administrator" : b.profile_kind, isAdmin, b.locale, b.fallback_locale, b.full_name || null, b.bio || null]))[0];
  await ensureTrial(u.id);
  await audit(u.id, "human", "account.create", { kind: "user", id: u.id }, { profile: b.profile_kind, admin: isAdmin });
  const verification = await sendVerification(u.id, b.email, req);
  const res = ok({ ok: true, admin: isAdmin, verification }, 201);
  await openSession(res, u.id, u.session_version);
  return res;
});
