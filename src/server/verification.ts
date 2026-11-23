/** Vérification de l'adresse électronique : lien envoyé seulement si un fournisseur de courriel est configuré. */
import { appUrl, mailConfigured, sendMail } from "./mail";
import { issueToken } from "./accounts";
import { audit } from "./audit";

export type VerificationState = "sent" | "not_configured" | "failed";

export async function sendVerification(userId: string, email: string, req: Request, fetchImpl?: typeof fetch): Promise<VerificationState> {
  if (!mailConfigured()) return "not_configured";
  const { token } = await issueToken("email_verify", userId);
  try {
    await sendMail({ to: email, subject: "XAM-XAM LAB — confirmez votre adresse", text:
      `Bonjour,\n\nConfirmez votre adresse en ouvrant ce lien (valable 48 h) :\n${appUrl(req)}/verification?jeton=${encodeURIComponent(token)}\n\nSi vous n'avez pas créé de compte XAM-XAM LAB, ignorez ce message.` }, fetchImpl);
    await audit(userId, "system", "account.email_verify.sent", { kind: "user", id: userId });
    return "sent";
  } catch (e) {
    console.error("[xamxam] envoi de vérification :", (e as Error).message);
    return "failed";
  }
}
