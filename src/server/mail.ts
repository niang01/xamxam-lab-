/**
 * Envoi de courriels transactionnels (réinitialisation du mot de passe, vérification d'adresse).
 * Fournisseur configurable par variables serveur — aucun n'est imposé :
 *   XX_MAIL_PROVIDER = brevo | resend    XX_MAIL_API_KEY = clé du fournisseur    XX_MAIL_FROM = expéditeur vérifié
 * Sans configuration : `mailConfigured()` = false et aucun envoi n'est simulé (l'interface propose alors le lien
 * généré par l'administrateur). Un envoi n'est déclaré « accepté » que sur réponse 2xx du fournisseur.
 */
import { outboundFetch } from "./outbound";

export interface Mail { to: string; subject: string; text: string }
export type MailResult = { accepted: true; provider: string; id: string | null };

export function mailConfig() {
  const provider = (process.env.XX_MAIL_PROVIDER ?? "").trim().toLowerCase();
  const key = process.env.XX_MAIL_API_KEY ?? "";
  const from = (process.env.XX_MAIL_FROM ?? "").trim();
  return { provider, key, from, ok: (provider === "brevo" || provider === "resend") && key.length > 8 && /@/.test(from) };
}
export const mailConfigured = () => mailConfig().ok;

export async function sendMail(m: Mail, fetchImpl: typeof fetch = outboundFetch): Promise<MailResult> {
  const c = mailConfig();
  if (!c.ok) throw new Error("Envoi de courriel non configuré (XX_MAIL_PROVIDER, XX_MAIL_API_KEY, XX_MAIL_FROM)");
  let r: Response;
  if (c.provider === "brevo") {
    r = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": c.key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { email: c.from, name: "XAM-XAM LAB" }, to: [{ email: m.to }], subject: m.subject, textContent: m.text }),
    });
  } else {
    r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `XAM-XAM LAB <${c.from}>`, to: [m.to], subject: m.subject, text: m.text }),
    });
  }
  if (!r.ok) throw new Error(`Fournisseur de courriel ${c.provider} : HTTP ${r.status}`);
  const body = await r.json().catch(() => ({})) as { messageId?: string; id?: string };
  return { accepted: true, provider: c.provider, id: body.messageId ?? body.id ?? null };
}

/** Adresse publique de l'application pour les liens envoyés (jamais l'en-tête Host, falsifiable). */
export function appUrl(req?: Request): string {
  const configured = process.env.XX_APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return req ? new URL(req.url).origin : "http://localhost:3100";
}
