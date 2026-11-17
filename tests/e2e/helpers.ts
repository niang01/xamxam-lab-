import { expect, type Page } from "@playwright/test";

export const ALERT = "[role=alert]:not(#__next-route-announcer__)";

export async function signup(page: Page, email: string, profile = "engineer") {
  await page.goto("/inscription");
  await page.fill("input[name=display_name]", email.split("@")[0]);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "motdepasse-e2e-1");
  await page.selectOption("select[name=profile_kind]", profile);
  await page.click("button[type=submit]");
  await expect(page.locator("[data-tile]").first()).toBeVisible({ timeout: 30_000 });
}
