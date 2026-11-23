import { z } from "zod";
import { ok, readInput, endpoint, throttle } from "@/server/api";
import { sqlOne } from "@/server/db";
import { issueToken } from "@/server/accounts";
import { appUrl, mailConfigured, sendMail } from "@/server/mail";
import { audit } from "@/server/audit";

/**
 * Mot de passe oublié. Réponse identique que l'adresse existe ou non (pas d'énumération des comptes).
 * Sans fournisseur de courriel configuré : `mail: "not_configured"` — l'interface invite à demander un lien à
 * l'administrateur (Administration → Comptes → Lien de réinitialisation).
 */
export const POST = endpoint(async (req) => {
  throttle(req, "pw-forgot", 5, 15 * 60_000);
  const b = await readInput(req, z.object({ email: z.string().trim().toLowerCase().email("Adresse électronique invalide").max(200) }));
  if (!mailConfigured()) return ok({ ok: true, mail: "not_configured" });
  const u = await sqlOne<{ id: string; status: string }>("SELECT id, status FROM users WHERE email=$1", [b.email]);
  if (u && u.status === "active") {
    const { token } = await issueToken("password_reset", u.id);
    try {
      await sendMail({ to: b.email, subject: "XAM-XAM LAB — réinitialisation du mot de passe", text:
        `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, utilisable une seule fois) :\n${appUrl(req)}/reinitialisation?jeton=${encodeURIComponent(token)}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.` });
      await audit(u.id, "system", "account.password_reset.sent", { kind: "user", id: u.id });
    } catch (e) { console.error("[xamxam] envoi de réinitialisation :", (e as Error).message); }
  }
  return ok({ ok: true, mail: "configured" });
});
