import { expect, test, type Locator, type Page } from "@playwright/test";
import { ALERT } from "./helpers";

/** Vérifie l'œil d'un champ : masqué → visible → masqué, sans jamais changer la valeur. */
async function checkEye(field: Locator, page: Page) {
  const input = field.locator("input");
  const eye = field.locator("[data-testid=pw-toggle]");
  const value = await input.inputValue();
  await expect(input).toHaveAttribute("type", "password");
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await eye.click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(eye).toHaveAttribute("aria-label", "Masquer le mot de passe");
  await eye.click();
  await expect(input).toHaveAttribute("type", "password");
  expect(await input.inputValue()).toBe(value);
  void page;
}
const box = (page: Page, name: string) => page.locator(`div.relative:has(> input[name=${name}])`).locator("..");

test("mots de passe : œil, robustesse, concordance ; profil professionnel (ordinateur et Android)", async ({ page }) => {
  const email = `oeil-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
  await page.goto("/inscription");
  await page.click("button[data-lang=fr]");
  await page.fill("input[name=display_name]", "Awa");
  await page.fill("input[name=full_name]", "Awa Ndiaye");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "abc");
  await expect(page.locator("[data-testid=pw-strength]")).toContainText("Trop court");
  await page.fill("input[name=password]", "motdepasse12");
  await expect(page.locator("[data-testid=pw-strength]")).toContainText("faible");
  await page.fill("input[name=password]", "Kt4R#w8Yp2-Nb6Vm0Qz");
  await expect(page.locator("[data-testid=pw-strength]")).toContainText("très bonne");
  await checkEye(box(page, "password"), page);
  await page.fill("input[name=password2]", "Kt4R#w8Yp2-Nb6Vm0Q");
  await expect(page.locator("[data-testid=pw-match]")).toHaveAttribute("data-match", "false");
  await checkEye(box(page, "password2"), page);
  await page.fill("textarea[name=bio]", "Étudiante en BTS, passionnée de solaire.");
  await page.selectOption("select[name=profile_kind]", "student");
  await page.click("button[type=submit]");
  await expect(page.locator(ALERT)).toContainText("ne sont pas identiques");
  await page.fill("input[name=password2]", "Kt4R#w8Yp2-Nb6Vm0Qz");
  await expect(page.locator("[data-testid=pw-match]")).toHaveAttribute("data-match", "true");
  // Affichage temporaire : re-masqué à l'envoi du formulaire
  await box(page, "password").locator("[data-testid=pw-toggle]").click();
  await page.click("button[type=submit]");
  await expect(page.locator("[data-testid=onboarding]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("textarea[name=bio]")).toHaveValue("Étudiante en BTS, passionnée de solaire.");
  await page.fill("input[name=specialty]", "Énergie solaire");
  await page.fill("textarea[name=professional_summary]", "Stage de 3 mois en installation PV.");
  await page.click("[data-testid=onboarding-save]");
  await expect(page.locator("[data-testid=guide-steps]")).toBeVisible({ timeout: 30_000 });

  // Profil affiché et modifiable dans Paramètres
  await page.goto("/settings");
  const view = page.locator("[data-testid=profile-view]");
  await expect(view).toContainText("Awa Ndiaye");
  await expect(view).toContainText("Énergie solaire");
  await expect(view).toContainText("Étudiante en BTS, passionnée de solaire.");
  await expect(view).toContainText("Stage de 3 mois en installation PV.");
  await page.click("[data-testid=profile-edit]");
  await page.fill("input[name=profile-job_title]", "Technicienne");
  await page.fill("input[name=profile-country]", "Sénégal");
  await page.fill("textarea[name=profile-bio]", "Présentation mise à jour.");
  await page.click("[data-testid=profile-save]");
  await expect(view).toContainText("Technicienne · Énergie solaire");
  await expect(view).toContainText("Présentation mise à jour.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // Changement de mot de passe : œil sur les trois champs, robustesse, concordance
  await page.fill("input[name=current-password]", "Kt4R#w8Yp2-Nb6Vm0Qz");
  await page.fill("input[name=new-password]", "Nouveau-Mdp-2026!x");
  await page.fill("input[name=new-password2]", "Nouveau-Mdp-2026!");
  for (const n of ["current-password", "new-password", "new-password2"]) await checkEye(box(page, n), page);
  await expect(page.locator("[data-testid=password-card] [data-testid=pw-strength]")).toBeVisible();
  await expect(page.locator("[data-testid=change-password]")).toBeDisabled();
  await page.fill("input[name=new-password2]", "Nouveau-Mdp-2026!x");
  await expect(page.locator("[data-testid=password-card] [data-testid=pw-match]")).toHaveAttribute("data-match", "true");
  await page.click("[data-testid=change-password]");
  await expect(page).toHaveURL(/connexion/);

  // Connexion : œil
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "Nouveau-Mdp-2026!x");
  await checkEye(box(page, "password"), page);
  await page.click("button[type=submit]");
  await expect(page).not.toHaveURL(/connexion/, { timeout: 30_000 }); // retour à la page d'origine (Paramètres)
  await expect(page.locator("[data-testid=profile-view]")).toContainText("Awa Ndiaye");

  // Réinitialisation : œil et concordance (jeton fictif : refus serveur explicite)
  await page.goto("/reinitialisation?jeton=jeton-de-demonstration-invalide-000000");
  await page.fill("input[name=password]", "Encore-Un-Mdp-77");
  await page.fill("input[name=password2]", "Encore-Un-Mdp-77");
  await checkEye(box(page, "password"), page);
  await checkEye(box(page, "password2"), page);
  await expect(page.locator("[data-testid=pw-match]")).toHaveAttribute("data-match", "true");
  await page.click("button[type=submit]");
  await expect(page.locator(ALERT)).toContainText("invalide");
});
