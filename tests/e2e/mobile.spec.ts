import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";
import { RUBRICS } from "../../src/lib/catalog";

test("téléphone : menu, aucune page plus large que l'écran", async ({ page }) => {
  await signup(page, `mobile-${Date.now()}@e2e.local`, "student");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.locator("[data-nav=solar]")).toBeVisible();
  // Pages des logiciels de dimensionnement (formulaires larges : tableaux de lignes, 12 mois).
  const extra = ["/dimensionnement/installation-electrique", "/dimensionnement/photovoltaique", "/dimensionnement/pompage"].map((path) => ({ path }));
  for (const r of [...RUBRICS, ...extra]) {
    await page.goto(r.path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(ALERT), r.path).toHaveCount(0);
    // Comparaison avec la largeur de l'ÉCRAN : une page trop large fait « dézoomer » le téléphone (innerWidth grandit aussi).
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - screen.width);
    expect(overflow, r.path).toBeLessThanOrEqual(1);
  }
});
