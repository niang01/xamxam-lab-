import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";
import { RUBRICS } from "../../src/lib/catalog";

test("téléphone : menu, aucune page plus large que l'écran", async ({ page }) => {
  await signup(page, `mobile-${Date.now()}@e2e.local`, "student");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.locator("[data-nav=solar]")).toBeVisible();
  for (const r of RUBRICS) {
    await page.goto(r.path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(ALERT), r.path).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, r.path).toBeLessThanOrEqual(1);
  }
});
