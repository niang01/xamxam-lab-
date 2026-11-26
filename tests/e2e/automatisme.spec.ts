import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

/** Automatisme : Ladder simulé (démarrage direct), Grafcet (vérin), trame Modbus, enregistrement du programme. */
test("automatisme : Ladder en marche, Grafcet, Modbus, enregistrement", async ({ page }) => {
  test.setTimeout(120_000);
  await signup(page, `plc-${Date.now()}@e2e.local`);
  await page.click("button[data-lang=fr]");
  await page.goto("/lab/automatisme");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-rung]")).toHaveCount(3);
  await page.click("[data-testid=ladder-run]");
  // Arrêt et thermique câblés NF : à 1 au repos (cases cochées au chargement)
  await expect(page.locator("[data-input=I2]")).toBeChecked();
  await expect(page.locator("[data-output=Q1]")).toHaveAttribute("data-state", "0");
  await page.check("[data-input=I1]");
  await expect(page.locator("[data-output=Q1]")).toHaveAttribute("data-state", "1");
  await page.uncheck("[data-input=I1]");
  await page.waitForTimeout(300);
  await expect(page.locator("[data-output=Q1]")).toHaveAttribute("data-state", "1");   // auto-maintien
  await expect(page.locator("[data-rung='1']")).toHaveAttribute("data-power", "1");
  await page.uncheck("[data-input=I2]");
  await expect(page.locator("[data-output=Q1]")).toHaveAttribute("data-state", "0");   // arrêt
  // Édition : ajout d'un échelon, erreur signalée pour une variable invalide
  await page.click("[data-testid=rung-add]");
  await expect(page.locator("[data-testid=rung-editor]")).toBeVisible();
  await page.locator("[data-testid=rung-editor] input[aria-label=Variable]").first().fill("X9");
  await expect(page.locator("[data-testid=ladder-errors]")).toContainText("X9");
  await page.locator("[data-testid=rung-editor] input[aria-label=Variable]").first().fill("I1");
  await expect(page.locator("[data-testid=ladder-errors]")).toHaveCount(0);
  // Enregistrement
  await page.fill("input[name=ladder-title]", "Démarrage atelier e2e");
  await page.click("[data-testid=ladder-save]");
  await expect(page.locator("[data-testid=ladder-saved]")).toContainText("version 1");

  // Grafcet : cycle du vérin
  await page.click("[data-tab=grafcet]");
  await page.click("[data-testid=grafcet-run]");
  await expect(page.locator("[data-step='0']")).toHaveAttribute("data-active", "1");
  await page.check("[data-input=I2]"); await page.check("[data-input=I1]");
  await expect(page.locator("[data-step='1']")).toHaveAttribute("data-active", "1");
  await expect(page.locator("[data-testid=grafcet-outputs] [data-output=Q1]")).toHaveAttribute("data-state", "1");
  await page.uncheck("[data-input=I1]"); await page.uncheck("[data-input=I2]"); await page.check("[data-input=I3]");
  await expect(page.locator("[data-step='2']")).toHaveAttribute("data-active", "1");

  // Modbus : trame de référence
  await page.click("[data-tab=modbus]");
  await expect(page.locator("[data-testid=mb-frame]")).toContainText("01 03 00 00 00 0A C5 CD");
  await page.fill("textarea[name=mb-response]", "01 83 02 C0 F1");
  await expect(page.locator("[data-testid=mb-decoded]")).toContainText("Adresse de donnée invalide");
});
