import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";

test("comptes : profil, déconnexion, mot de passe oublié, lien de réinitialisation administrateur, licence", async ({ browser }) => {
  const stamp = Date.now();
  const adminCtx = await browser.newContext(); const admin = await adminCtx.newPage();
  const userCtx = await browser.newContext(); const page = await userCtx.newPage();
  const email = `compte-${stamp}@e2e.local`;

  // Inscription → configuration du profil → guide
  await page.goto("/inscription");
  await page.click("button[data-lang=fr]");
  await page.fill("input[name=display_name]", "Awa Test");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "court");
  await page.selectOption("select[name=profile_kind]", "student");
  await page.click("button[type=submit]");
  // Validation du navigateur (minLength) : aucune requête ; on corrige
  await page.fill("input[name=password]", "motdepasse-e2e-1");
  await page.click("button[type=submit]");
  await expect(page.locator("[data-testid=onboarding]")).toBeVisible({ timeout: 30_000 });
  await page.fill("input[name=organization]", "Lycée technique");
  await page.fill("input[name=skills]", "électricité, ESP32");
  await page.click("[data-testid=onboarding-save]");
  await expect(page.locator("[data-testid=guide-steps]")).toContainText("Créer un compte");
  await page.goto("/");
  await expect(page.locator("[data-testid=access-banner]")).toContainText("90");

  // Licence : essai visible
  await page.goto("/licence");
  await expect(page.locator("[data-testid=licence-status]")).toContainText("Essai gratuit");

  // Déconnexion puis mot de passe oublié (sans fournisseur de courriel : message explicite)
  await page.click("text=Déconnexion");
  await expect(page).toHaveURL(/connexion/);
  await page.click("[data-testid=forgot-link]");
  await page.fill("input[name=email]", email);
  await page.click("button[type=submit]");
  await expect(page.locator("[data-testid=forgot-nomail]")).toContainText("administrateur");

  // Mauvais mot de passe : message compréhensible
  await page.goto("/connexion");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "mauvais-mot-de-passe");
  await page.click("button[type=submit]");
  await expect(page.locator(ALERT)).toContainText("incorrect");

  // L'administrateur génère un lien de réinitialisation et émet une licence
  await signup(admin, "admin-comptes@e2e.local");
  await admin.goto("/admin");
  await admin.click("button[data-lang=fr]");
  const row = admin.locator(`[data-user="${email}"]`);
  await row.locator("[data-testid=reset-link-btn]").click();
  const link = (await admin.locator("[data-testid=reset-link] code").textContent())!.trim();
  expect(link).toContain("/reinitialisation?jeton=");

  await admin.click("[data-testid=admin-tab-licences]");
  await admin.fill("input[name=plan-code]", `annuel-${stamp}`);
  await admin.fill("input[name=plan-name]", "Annuel e2e");
  await admin.click("[data-testid=plan-create]");
  await admin.selectOption("select[name=issue-plan]", { label: "Annuel e2e" });
  await admin.click("[data-testid=licence-issue]");
  const key = (await admin.locator("[data-testid=issued-keys] code").first().textContent())!.trim();
  expect(key).toMatch(/^XXL(-[A-Z2-9]{5}){5}$/);

  // L'utilisateur choisit un nouveau mot de passe avec le lien, se reconnecte et active la licence
  await page.goto(new URL(link).pathname + new URL(link).search);
  await page.fill("input[name=password]", "nouveau-mdp-e2e-1");
  await page.fill("input[name=password2]", "nouveau-mdp-e2e-1");
  await page.click("button[type=submit]");
  await expect(page.locator("[data-testid=reset-done]")).toBeVisible();
  await page.goto("/connexion");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "nouveau-mdp-e2e-1");
  await page.click("button[type=submit]");
  await expect(page.locator("[data-tile]").first()).toBeVisible({ timeout: 30_000 });
  await page.goto("/licence");
  await page.fill("input[name=licence-key]", key);
  await page.click("[data-testid=licence-activate]");
  await expect(page.locator("[data-testid=licence-active]")).toContainText("Annuel e2e");
  await adminCtx.close(); await userCtx.close();
});
