import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

/** Commandes « Retour » et reconnexion automatique (serveur en veille, session conservée). */
test("navigation : Retour sur chaque page, reconnexion automatique après une indisponibilité du serveur", async ({ page }) => {
  test.setTimeout(120_000);
  await signup(page, `nav-${Date.now()}@e2e.local`);
  await page.click("button[data-lang=fr]");

  // Retour : page précédente de la navigation
  await page.goto("/dimensionnement");
  await page.click("[data-software=pompage]");
  await expect(page).toHaveURL(/\/dimensionnement\/pompage/);
  await page.click("[data-testid=back]");
  await expect(page).toHaveURL(/\/dimensionnement$/);
  // Retour depuis une page ouverte directement : rubrique parente
  await page.goto("/lab/iot");
  await page.waitForLoadState("networkidle");
  await page.click("[data-testid=back]");
  await expect(page).toHaveURL(/\/lab$/);
  // Toutes les rubriques internes proposent « Retour » (sauf le tableau de bord)
  for (const p of ["/projects", "/boutique", "/banque-projets", "/schemas", "/studio", "/settings", "/guide"]) {
    await page.goto(p);
    await expect(page.locator("[data-testid=back]"), p).toBeVisible();
  }

  // Serveur momentanément injoignable (réveil de l'hébergement) : pas de déconnexion
  let failures = 2;
  await page.route("**/api/auth/me", (route) => (failures-- > 0 ? route.fulfill({ status: 502, body: "Bad Gateway" }) : route.continue()));
  await page.goto("/projects");
  await expect(page.locator("[data-testid=session-loading]")).toContainText("Réveil du serveur", { timeout: 10_000 });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/projects$/);
  await page.unroute("**/api/auth/me");

  // Page de connexion avec une session valable : suite directe
  await page.goto("/connexion?suite=/boutique");
  await expect(page).toHaveURL(/\/boutique$/, { timeout: 15_000 });
});
