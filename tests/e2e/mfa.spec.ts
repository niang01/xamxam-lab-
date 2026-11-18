import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";
import { base32Decode, totp } from "../../src/lib/totp";

test("double authentification : activation par QR code, connexion en deux étapes, code de secours", async ({ page }) => {
  const email = `mfa-${Date.now()}@e2e.local`;
  await signup(page, email);
  await page.click("button[data-lang=fr]");
  await page.goto("/settings");
  await page.click("[data-testid=mfa-setup]");
  await expect(page.locator("[data-testid=mfa] img")).toBeVisible();
  const secret = base32Decode((await page.locator("[data-testid=mfa-secret]").textContent()) ?? "");
  // L'application d'authentification est simulée par le calcul RFC 6238 du test lui-même.
  await page.fill("input[name=mfa-code]", totp(secret, Date.now() / 1000));
  await page.click("[data-testid=mfa-enable]");
  const codes = (await page.locator("[data-testid=recovery-codes] li").allTextContents()).map((c) => c.trim());
  expect(codes).toHaveLength(10);
  await expect(page.locator("[data-testid=mfa]")).toContainText("Activée");

  // Déconnexion puis connexion : le mot de passe seul ne suffit pas
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await page.waitForURL("**/connexion**");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "motdepasse-e2e-1");
  await page.click("button[type=submit]");
  await expect(page.locator("[data-testid=mfa-step]")).toBeVisible();
  expect((await page.request.get("/api/auth/me")).ok()).toBeTruthy();
  expect(((await (await page.request.get("/api/auth/me")).json()) as { user: unknown }).user).toBeNull();

  await page.fill("input[name=code]", "000000");
  await page.click("[data-testid=mfa-step] button[type=submit]");
  await expect(page.locator("[data-testid=mfa-step]")).toContainText("Code incorrect");

  // Code de secours (le code TOTP de l'activation ne peut pas resservir dans le même pas de 30 s)
  await page.getByRole("button", { name: "Utiliser un code de secours" }).click();
  await page.fill("input[name=code]", codes[0]);
  await page.click("[data-testid=mfa-step] button[type=submit]");
  // Connecté : retour à la page d'où l'on venait (Paramètres), double authentification toujours active, 9 codes restants
  await page.waitForURL("**/settings", { timeout: 20_000 });
  await expect(page.locator("[data-testid=mfa]")).toContainText("9 code(s) de secours restant(s)");
  await expect(page.locator(ALERT)).toHaveCount(0);
});
