import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

/** Logiciels de dimensionnement : exemple chargé, calcul serveur, résultats, enregistrement, export, schéma. */
test("dimensionnement : photovoltaïque et pompage (calcul, enregistrement, export Word, schéma 2D)", async ({ page }) => {
  test.setTimeout(180_000);
  await signup(page, `dim-${Date.now()}@e2e.local`);
  await page.click("button[data-lang=fr]");
  await page.goto("/dimensionnement");
  await expect(page.locator("[data-software]")).toHaveCount(3);

  // Photovoltaïque : champ vide → données manquantes ; exemple → résultats
  await page.click("[data-software=photovoltaique]");
  await page.click("[data-testid=study-run]");
  await expect(page.locator("[data-testid=study-missing]")).toContainText("latitude");
  await page.click("[data-testid=study-example]");
  await expect(page.locator("input[name='ghi.0']")).toHaveValue("5.4");
  await page.click("[data-testid=study-run]");
  await expect(page.locator("[data-summary='Puissance crête installée']")).toContainText("kWc");
  await expect(page.locator("[data-testid=study-bom]")).toContainText("Module photovoltaïque");
  await page.fill("input[name=study-title]", "PV maison e2e");
  await page.click("[data-testid=study-save]");
  await expect(page).toHaveURL(/etude=[0-9a-f-]{36}/);
  const docx = await page.request.get((await page.locator("[data-testid=study-export-docx]").getAttribute("href"))!);
  expect(docx.status()).toBe(200);
  expect((await docx.body()).subarray(0, 2).toString()).toBe("PK");
  await page.click("[data-testid=study-diagram]");
  await expect(page).toHaveURL(/\/schemas\?generer=unifilaire_pv/);
  await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });

  // Pompage
  await page.goto("/dimensionnement/pompage");
  await page.click("[data-testid=study-example]");
  await page.click("[data-testid=study-run]");
  await expect(page.locator("[data-summary='HMT']")).toContainText("m");
  await expect(page.locator("[data-testid=study-bom]")).toContainText("Pompe immergée de forage");

  // Mes études
  await page.goto("/dimensionnement");
  await expect(page.getByText("PV maison e2e")).toBeVisible();
});
