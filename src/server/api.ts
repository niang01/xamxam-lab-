/**
 * Couche API de XAM-XAM LAB.
 *
 *   export const POST = endpoint(async (req, ctx) => { … return ok(data, 201); });
 *
 * - `endpoint` exécute le gestionnaire, applique un quota aux écritures et convertit toute exception en réponse JSON
 *   `{ error, key, details }` (statut issu d'`ApiFailure`, 400 pour une validation, 500 sinon — détail journalisé).
 * - `readInput` lit et valide le corps (zod) ; `uuidParam` lit un paramètre d'URL et vérifie que c'est un UUID.
 * - `sessionUser` / `mustBeSignedIn` / `mustBeAdmin` : identité revérifiée en base à chaque requête (compte actif,
 *   version de session) — un jeton valide d'un compte désactivé est refusé.
 */
import { ZodError, z } from "zod";
import { SESSION_COOKIE, verifySession } from "./security/session";
import { callerAddress, rateLimit } from "./security/rateLimit";
import { ConfigError } from "./security/crypto";
import { env } from "./env";
import { sqlOne } from "./db";

/** Échec métier : statut HTTP, message (journal / repli) et clé de message traduisible pour l'interface. */
export class ApiFailure extends Error {
  constructor(readonly status: number, message: string, readonly key?: string, readonly details?: unknown) {
    super(message);
    this.name = "ApiFailure";
  }
}

const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };

/** Réponse JSON non mise en cache. */
export function ok(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...NO_STORE, ...headers } });
}

function failure(status: number, error: string, key?: string, details?: unknown) {
  return ok({ error, ...(key ? { key } : {}), ...(details !== undefined ? { details } : {}) }, status);
}

/** Quota par compartiment et par adresse ; dépassement → 429. */
export function throttle(req: Request, scope: string, max: number, windowMs = 60_000) {
  const verdict = rateLimit(`${scope}|${callerAddress(req)}`, max, windowMs);
  if (!verdict.ok) throw new ApiFailure(429, `Trop de requêtes — nouvel essai possible dans ${verdict.retryAfterS} s`, "err.rate");
}

export async function readInput<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const text = await req.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; } catch { throw new ApiFailure(400, "Le corps de la requête n'est pas du JSON valide", "err.badJson"); }
  return schema.parse(data);
}

const UUID = z.uuid();
export const uuid = UUID;

/** Paramètre d'URL `name` (par défaut « id ») obligatoirement au format UUID. */
export async function uuidParam(ctx: { params: Promise<Record<string, string>> }, name = "id"): Promise<string> {
  const value = (await ctx.params)[name];
  const parsed = UUID.safeParse(value);
  if (!parsed.success) throw new ApiFailure(400, `Paramètre « ${name} » invalide`, "err.badId");
  return parsed.data;
}

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export interface User {
  id: string; email: string; display_name: string; profile_kind: string; is_admin: boolean; locale: string; fallback_locale: string;
  autonomy_level: number; public_profile: boolean; country: string | null; bio: string | null; skills: string[]; clearances: string[];
}

/** Utilisateur de la session, ou null (jeton absent, invalide, expiré, compte désactivé ou session révoquée). */
export async function sessionUser(req: Request): Promise<User | null> {
  const token = await verifySession(readCookie(req, SESSION_COOKIE), env.sessionSecret);
  if (!token) return null;
  const row = await sqlOne<User & { status: string; session_version: number }>(
    `SELECT u.id, u.email, u.display_name, u.profile_kind, u.is_admin, u.locale, u.fallback_locale, u.autonomy_level, u.public_profile,
            u.country, u.bio, u.skills, u.status, u.session_version,
            COALESCE((SELECT json_agg(c.kind) FROM clearances c WHERE c.user_id = u.id AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_DATE)), '[]') AS clearances
       FROM users u WHERE u.id = $1`, [token.sub]);
  if (!row || row.status !== "active" || row.session_version !== token.ver) return null;
  const { status, session_version, ...user } = row;
  void status; void session_version;
  return user;
}

export async function mustBeSignedIn(req: Request): Promise<User> {
  const user = await sessionUser(req);
  if (!user) throw new ApiFailure(401, "Connexion requise", "err.login");
  return user;
}

export async function mustBeAdmin(req: Request): Promise<User> {
  const user = await mustBeSignedIn(req);
  if (!user.is_admin) throw new ApiFailure(403, "Réservé aux administrateurs", "err.admin");
  return user;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Enveloppe d'un gestionnaire de route : quota d'écriture et conversion uniforme des erreurs. */
export function endpoint<C = unknown>(handler: Handler<C>): Handler<C> {
  return async function run(req, ctx) {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") throttle(req, "writes", 240);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiFailure) return failure(err.status, err.message, err.key, err.details);
      if (err instanceof ZodError) return failure(400, "Données invalides", "err.invalid", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      if (err instanceof ConfigError) return failure(503, err.message);
      console.error(`[xamxam-api] ${req.method} ${new URL(req.url).pathname} —`, err);
      return failure(500, "Erreur interne du serveur", "err.internal");
    }
  };
}
