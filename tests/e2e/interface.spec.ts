import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";

test("identité : logo, thème sombre par défaut puis clair mémorisé, barre d'état réelle, panneau XAM-XAM AI", async ({ page }) => {
  await signup(page, `interface-${Date.now()}@e2e.local`);
  await page.click("button[data-lang=fr]");

  // Logo vectoriel (et non plus un simple texte), favicon déclaré
  await expect(page.locator('header img[alt="XAM-XAM LAB"]:visible')).toHaveCount(1);
  expect(await page.locator('link[rel="icon"][href="/icon.svg"]').count()).toBe(1);
  for (const f of ["/icon.svg", "/favicon.ico", "/brand/logo-sombre.svg", "/brand/logo-clair.svg", "/fonts/inter-latin-400-normal.woff2"]) {
    expect((await page.request.get(f)).status(), f).toBe(200);
  }

  // Thème : sombre par défaut ; le choix « clair » change les couleurs et survit au rechargement
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg()).toBe("rgb(8, 13, 27)");
  await page.selectOption("[data-testid=theme]", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bg()).toBe("rgb(248, 250, 252)");
  await expect(page.locator(".logo-clair")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.selectOption("[data-testid=theme]", "dark");

  // Barre d'état : états mesurés (serveur, base, IA en moteur de règles faute de clé, appareils)
  const db = ((await (await page.request.get("/api/health")).json()) as { db: string }).db;
  await expect(page.locator("[data-testid=status-server]")).toContainText(`Serveur opérationnel · ${db === "postgres" ? "PostgreSQL" : "PGlite"}`);
  await expect(page.locator("[data-testid=status-ai]")).toContainText("moteur de règles");
  await expect(page.locator("[data-testid=status-devices]")).toContainText("0 vus / 0");
  await expect(page.locator("[data-testid=status-network]")).toContainText("En ligne");

  // Panneau XAM-XAM AI depuis un laboratoire : même route et même gouvernance qu'AI CORE
  await page.goto("/lab/electrical");
  await page.click("[data-testid=ai-panel-toggle]");
  await expect(page.locator("[data-testid=ai-panel]")).toContainText("Electrical Lab");
  await page.fill("[data-testid=ai-panel] textarea", "Courant pour 12 V et 6 ohms");
  await page.click("[data-testid=ai-panel-send]");
  const thread = page.locator("[data-testid=ai-panel-thread]");
  await expect(thread).toContainText("Moteur de règles", { timeout: 20_000 });
  await expect(thread).toContainText("2");
  await expect(page.locator(ALERT)).toHaveCount(0);
});
