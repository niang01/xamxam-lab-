import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { issueToken } from "@/server/accounts";
import { appUrl } from "@/server/mail";
import { extendTrial, forgetEntitlements } from "@/server/licensing";
import { PROFILES } from "@/lib/profiles";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_link") }),
  z.object({ action: z.literal("verify_email") }),
  z.object({ action: z.literal("unlock") }),
  z.object({ action: z.literal("extend_trial"), days: z.number().int().min(1).max(365) }),
  z.object({ action: z.literal("set_profile"), profile_kind: z.enum(PROFILES as unknown as [string, ...string[]]) }),
  z.object({ action: z.literal("set_admin"), is_admin: z.boolean() }),
  z.object({ action: z.literal("delete_account"), confirm_email: z.string().trim().toLowerCase() }),
]);

/** Actions d'administration sur un compte (toutes journalisées). */
export const POST = endpoint(async (req, ctx: { params: Promise<Record<string, string>> }) => {
  const a = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, schema);
  const target = await sqlOne<{ id: string; email: string }>("SELECT id, email FROM users WHERE id=$1", [id]);
  if (!target) throw new ApiFailure(404, "Compte introuvable", "err.notFound");
  let result: Record<string, unknown> = { ok: true };
  switch (b.action) {
    case "reset_link": {
      // Lien à transmettre par un canal sûr ; valable 24 h, usage unique ; affiché une seule fois.
      const { token, expires_at } = await issueToken("password_reset", id, a.id, 24);
      result = { link: `${appUrl(req)}/reinitialisation?jeton=${encodeURIComponent(token)}`, expires_at };
      break;
    }
    case "verify_email": await sql("UPDATE users SET email_verified_at=COALESCE(email_verified_at, now()) WHERE id=$1", [id]); break;
    case "unlock": await sql("UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1", [id]); break;
    case "extend_trial": await extendTrial(id, b.days, a.id); break;
    case "set_profile": await sql("UPDATE users SET profile_kind=$2, updated_at=now() WHERE id=$1", [id, b.profile_kind]); break;
    case "set_admin": {
      if (id === a.id && !b.is_admin) throw new ApiFailure(400, "Impossible de retirer vos propres droits d'administrateur", "err.forbidden");
      await sql("UPDATE users SET is_admin=$2, session_version=session_version+1, updated_at=now() WHERE id=$1", [id, b.is_admin]);
      forgetEntitlements();
      break;
    }
    case "delete_account": {
      if (id === a.id) throw new ApiFailure(400, "Supprimez votre propre compte depuis Paramètres", "err.forbidden");
      if (b.confirm_email !== target.email) throw new ApiFailure(400, "L'adresse de confirmation ne correspond pas", "err.invalid");
      await audit(a.id, "human", "admin.user.delete_account", { kind: "user", id }, { email_hash: (await import("@/server/security/crypto")).sha256(target.email) });
      await sql("DELETE FROM users WHERE id=$1", [id]);
      forgetEntitlements();
      return ok({ ok: true, deleted: true });
    }
  }
  await audit(a.id, "human", `admin.user.${b.action}`, { kind: "user", id }, b.action === "reset_link" ? {} : { ...b });
  return ok(result);
});
