/**
 * Garde d'entrée des API de XAM-XAM LAB.
 * Première barrière seulement : un jeton de session signé est exigé sur /api/** hors des préfixes ouverts ci-dessous.
 * Chaque route revérifie ensuite l'utilisateur en base (`mustBeSignedIn`, src/server/api.ts) ; les pages, elles,
 * redirigent vers /connexion côté client.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./server/security/session";

/** Préfixes ouverts : authentification, catalogue des traductions validées, appareils (jeton propre), santé, pages publiques. */
export const OPEN_API_PREFIXES = ["/api/auth/", "/api/i18n/catalog", "/api/device/", "/api/health", "/api/public/"] as const;

const DEV_SECRET = "xamxam-dev-secret-not-for-production";

function sessionSecret(): string | null {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  return process.env.NODE_ENV === "production" ? null : DEV_SECRET;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const open = OPEN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (open) return NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySession(token, sessionSecret());
  return valid ? NextResponse.next() : Response.json({ error: "Connexion requise", key: "err.login" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export const config = { matcher: ["/api/:path*"] };
