/** Session XAM-XAM LAB : cookie httpOnly signé posé sur une réponse standard, et vue publique de l'utilisateur. */
import { randomBytes } from "node:crypto";
import { env } from "./env";
import { SESSION_COOKIE, signSession } from "./security/session";
import { ApiFailure, type User } from "./api";
import { PROFILE_CAPABILITIES, type Profile } from "@/lib/profiles";

const SESSION_LIFETIME_S = 14 * 24 * 3600;

function cookieHeader(value: string, maxAge: number): string {
  const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (env.secureCookies) attrs.push("Secure");
  return attrs.join("; ");
}

export const DEVICE_COOKIE = "xx_device";
/** Identifiant aléatoire d'appareil (cookie httpOnly d'un an) : sert à la gestion des appareils autorisés. */
export function ensureDeviceCookie(res: Response, req?: Request) {
  const has = (req?.headers.get("cookie") ?? "").split(";").some((c) => c.trim().startsWith(`${DEVICE_COOKIE}=`));
  if (has) return;
  const attrs = [`${DEVICE_COOKIE}=${randomBytes(24).toString("base64url")}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${365 * 24 * 3600}`];
  if (env.secureCookies) attrs.push("Secure");
  res.headers.append("Set-Cookie", attrs.join("; "));
}

/** Ouvre une session pour `userId` (version courante de ses sessions) sur la réponse `res`. */
export async function openSession(res: Response, userId: string, version: number, req?: Request): Promise<Response> {
  const secret = env.sessionSecret;
  if (!secret) throw new ApiFailure(503, "SESSION_SECRET n'est pas configuré sur le serveur");
  const token = await signSession({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_S, ver: version }, secret);
  res.headers.append("Set-Cookie", cookieHeader(token, SESSION_LIFETIME_S));
  ensureDeviceCookie(res, req);
  return res;
}

/** Ferme la session du navigateur (le cookie expire immédiatement). */
export function closeSession(res: Response): Response {
  res.headers.append("Set-Cookie", cookieHeader("", 0));
  return res;
}

export function publicUser(user: User) {
  const capabilities = user.is_admin ? [...new Set(Object.values(PROFILE_CAPABILITIES).flat())] : PROFILE_CAPABILITIES[user.profile_kind as Profile] ?? [];
  return { ...user, capabilities };
}
