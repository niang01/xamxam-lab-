import { z } from "zod";
import { ok, readInput, endpoint, throttle, ApiFailure } from "@/server/api";
import { getDb, sql, sqlOne } from "@/server/db";
import { verifyPassword } from "@/server/security/crypto";
import { openSession } from "@/server/auth";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { createChallenge, isMfaEnabled } from "@/server/mfa";
import { LOCK_AFTER, LOCK_MINUTES, promoteConfiguredAdmin } from "@/server/accounts";

const schema = z.object({ email: z.string().trim().toLowerCase().min(3, "Adresse électronique requise").max(200), password: z.string().min(1, "Mot de passe requis").max(200) });

export const POST = endpoint(async (req) => {
  throttle(req, "login", 20, 5 * 60000);
  await getDb();
  if (!env.sessionSecret) throw new ApiFailure(503, "Clé de session indisponible sur le serveur : connexion impossible pour le moment", "err.serverConfig");
  const b = await readInput(req, schema);
  const u = await sqlOne<{ id: string; email: string; password_hash: string; status: string; session_version: number; locked_until: string | null }>(
    "SELECT id, email, password_hash, status, session_version, locked_until FROM users WHERE email=$1", [b.email]);
  if (u?.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
    const min = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 60000);
    throw new ApiFailure(423, `Trop d'essais incorrects : compte bloqué temporairement (${min} min). Utilisez « Mot de passe oublié » si besoin.`, "err.locked");
  }
  if (!u || !verifyPassword(b.password, u.password_hash)) {
    if (u) {
      const r = (await sql<{ failed_logins: number }>(
        `UPDATE users SET failed_logins=failed_logins+1, locked_until = CASE WHEN failed_logins+1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END WHERE id=$1 RETURNING failed_logins`,
        [u.id, LOCK_AFTER, String(LOCK_MINUTES)]))[0];
      await audit(u.id, "human", "account.login.failed", { kind: "user", id: u.id }, { attempts: r.failed_logins });
    }
    throw new ApiFailure(401, "Identifiants incorrects", "err.credentials");
  }
  // Statut révélé seulement après un mot de passe correct (pas d'énumération des comptes).
  if (u.status !== "active") throw new ApiFailure(403, "Ce compte est désactivé : contactez l'administrateur", "err.disabled");
  await sql("UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1", [u.id]);
  await promoteConfiguredAdmin(u.id, u.email);
  // Double authentification active : pas de session tant que le second facteur n'est pas vérifié (/api/auth/mfa).
  if (await isMfaEnabled(u.id)) {
    await audit(u.id, "human", "account.login.password_ok", { kind: "user", id: u.id });
    return ok({ mfa_required: true, challenge: await createChallenge(u.id) });
  }
  await sql("UPDATE users SET last_login_at=now() WHERE id=$1", [u.id]);
  await audit(u.id, "human", "account.login", { kind: "user", id: u.id });
  const res = ok({ ok: true });
  await openSession(res, u.id, u.session_version);
  return res;
});
