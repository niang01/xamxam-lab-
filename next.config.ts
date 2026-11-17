/**
 * Configuration Next.js de XAM-XAM LAB.
 * Les en-têtes de sécurité sont générés depuis `SECURITY_POLICY` : une seule source, vérifiée par le parcours e2e « sécurité ».
 */
import type { NextConfig } from "next";

const development = process.env.NODE_ENV !== "production";

/** Directives CSP : aucune ressource tierce ; WebAssembly permis (ngspice côté serveur, Three.js côté client). */
const CONTENT_POLICY: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(development ? ["'unsafe-eval'"] : [])],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'"],
  "media-src": ["'self'", "blob:"],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

/** Fonctions matérielles du navigateur utilisées par les laboratoires (réunions, Web Serial, BLE, localisation). */
const DEVICE_FEATURES = ["camera", "microphone", "geolocation", "serial", "bluetooth"];

const SECURITY_POLICY: Record<string, string> = {
  "Content-Security-Policy": Object.entries(CONTENT_POLICY).map(([directive, sources]) => `${directive} ${sources.join(" ")}`).join("; "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": DEVICE_FEATURES.map((feature) => `${feature}=(self)`).join(", "),
};

const asHeaders = (map: Record<string, string>) => Object.entries(map).map(([key, value]) => ({ key, value }));

const config: NextConfig = {
  poweredByHeader: false,
  // Base embarquée (WebAssembly), pilote PostgreSQL et agent HTTP : chargés tels quels par Node.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "undici"],
  turbopack: {
    root: __dirname,
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  async headers() {
    return [
      { source: "/:path*", headers: asHeaders(SECURITY_POLICY) },
      { source: "/sw.js", headers: asHeaders({ "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" }) },
    ];
  },
};

export default config;
