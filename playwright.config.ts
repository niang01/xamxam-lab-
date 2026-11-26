import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const PORT = 3123;
/** XX_E2E_BASE_URL : exécuter les parcours contre un déploiement existant (ex. docker compose) au lieu d'un serveur local. */
const EXTERNAL = process.env.XX_E2E_BASE_URL;
// Vérification d'un déploiement distant derrière un proxy sortant : le client HTTP des tests (page.request) l'utilise aussi.
const PROXY = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const DB = path.join(os.tmpdir(), `xamxam-e2e-${process.pid}`);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // XX_E2E_IGNORE_TLS=1 : déploiement d'essai avec certificat local (ex. Caddy, XX_DOMAIN=localhost) — jamais en production.
  use: { baseURL: EXTERNAL ?? `http://localhost:${PORT}`, ...(EXTERNAL && PROXY ? { proxy: { server: PROXY } } : {}), ignoreHTTPSErrors: process.env.XX_E2E_IGNORE_TLS === "1", trace: "off", launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" } },
  projects: [
    { name: "bureau", testIgnore: /mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"], permissions: ["camera", "microphone"], launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } } },
    { name: "telephone", use: { ...devices["Pixel 7"], launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" } }, testMatch: /(mobile|mot-de-passe|rubriques|dimensionnement|navigation)\.spec\.ts/ },
  ],
  webServer: EXTERNAL ? undefined : {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
    env: { PGLITE_DIR: DB, XX_ADMIN_EMAILS: "admin@e2e.local,admin-comptes@e2e.local", SESSION_SECRET: "e2e-secret-0123456789-abcdef", INSECURE_COOKIES: "true", XX_RATE_LIMIT_FACTOR: "5", NODE_ENV: "production" },
  },
});
