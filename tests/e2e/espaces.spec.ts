import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

test("espaces : projet depuis un modèle, budget, schéma 2D, scénario 4D, maquette 3D, bibliothèque", async ({ page }) => {
  await signup(page, `espaces-${Date.now()}@e2e.local`, "student");
  await page.click("button[data-lang=fr]");

  // Projet à partir d'un modèle
  await page.goto("/projects?modele=1");
  await page.click("[data-template=irrigation-automatique]");
  await page.selectOption("select[name=level]", "projet_bts");
  await page.fill("input[name=template-title]", "Irrigation BTS e2e");
  await page.click("[data-testid=create-from-template]");
  await page.click("[data-tab=dossier]");
  await expect(page.locator("[data-testid=project-dossier]")).toContainText("Projet de technicien supérieur");
  await expect(page.locator("[data-testid=project-dossier]")).toContainText("dimensionnement par le calcul");
  await page.click("[data-tab=bom]");
  const line = page.locator("[data-bom='Carte ESP32'] input[name=unit-price]");
  await line.fill("6500"); await line.blur();
  await expect(page.locator("[data-testid=bom-total]")).toContainText("6500 XOF");
  await expect(page.locator("[data-testid=bom-total]")).toContainText("sans prix");
  const projectUrl = page.url();

  // Bibliothèque : filtre par discipline et paramètres
  await page.goto("/components");
  await page.selectOption("select[name=discipline]", "hydraulique");
  await page.locator("[data-component='Électrovanne'] button").first().click();
  await expect(page.locator("[data-testid=comp-params]")).toContainText("Tension de bobine");

  // Schéma 2D : deux composants, une liaison, enregistrement, nomenclature
  await page.goto("/schemas");
  await page.selectOption("select[name=palette-discipline]", "cartes");
  await page.click("[data-palette='Carte ESP32']");
  await page.selectOption("select[name=palette-discipline]", "iot");
  await page.click("[data-palette='Module relais']");
  await expect(page.locator("[data-block]")).toHaveCount(2);
  await page.locator("[data-block=K1]").locator("rect").dispatchEvent("pointerdown");
  await page.locator("[data-pin='MCU1.GND']").dispatchEvent("pointerdown");
  await page.locator("[data-pin='K1.GND']").dispatchEvent("pointerdown");
  await expect(page.locator("[data-wire]")).toHaveCount(1);
  await expect(page.locator("[data-testid=diagram-check]")).toContainText("Aucune erreur");
  await page.fill("input[name=diagram-title]", "Commande pompe");
  await page.click("[data-testid=diagram-save]");
  await expect(page.getByText("Enregistré (version 1)")).toBeVisible();

  // Studio 4D : scénario réservoir avec l'exemple, bilan nul, lecture
  await page.goto("/studio");
  await page.selectOption("select[name=scenario-model]", "tank");
  await page.click("[data-testid=scenario-example]");
  await page.click("[data-testid=scenario-run]");
  await expect(page.locator("[data-testid=scenario-balance]")).toContainText("Bilan de volume (doit être nul) : 0 m³");
  await expect(page.locator("[data-testid=scenario-player]")).toBeVisible();

  // Maquette 3D : un bloc, matériau → masse calculée
  await page.click("[data-testid=add-box]");
  await expect(page.locator("[data-testid=assembly-mass]")).toContainText("incomplète");
  await page.selectOption("select[name=part-material]", "2700");
  await expect(page.locator("[data-testid=assembly-mass]")).toContainText("2.700 kg"); // 200 × 100 × 50 mm d'aluminium
  await page.goto(projectUrl);
  await expect(page).toHaveURL(/\/projects\//);
});
