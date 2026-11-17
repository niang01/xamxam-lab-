/** Configuration serveur (variables d'environnement). Aucune variable NEXT_PUBLIC_* sensible. */
import path from "node:path";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const env = {
  get dbDriver() { return process.env.DB_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "pglite"); },
  get databaseUrl() { return process.env.DATABASE_URL ?? null; },
  get pgliteDir() { return process.env.PGLITE_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data", "pglite"); },
  /** Secret de signature des sessions. En développement, une valeur locale est utilisée (signalée dans /api/health). */
  get sessionSecret() {
    const s = process.env.SESSION_SECRET;
    if (s && s.length >= 16) return s;
    return process.env.NODE_ENV === "production" ? null : "xamxam-dev-secret-not-for-production";
  },
  /** Comptes administrateurs : adresses listées (aucun compte administrateur créé d'office). */
  get adminEmails() { return list(process.env.XX_ADMIN_EMAILS); },
  get anthropicKey() { return process.env.ANTHROPIC_API_KEY ?? null; },
  get aiModel() { return process.env.AI_MODEL ?? "claude-opus-5-5"; },
  get aiDailyLimit() { return Number(process.env.AI_DAILY_LIMIT ?? 200); },
  get nasaPowerBaseUrl() { return process.env.NASA_POWER_BASE_URL ?? "https://power.larc.nasa.gov"; },
  get meteomaticsUser() { return process.env.METEOMATICS_USERNAME ?? null; },
  get meteomaticsPassword() { return process.env.METEOMATICS_PASSWORD ?? null; },
  get secureCookies() { return process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true"; },
};
