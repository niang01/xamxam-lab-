/**
 * Maquettes de l'identité proposée, rendues sur les VRAIES pages de l'application (aucune fausse fonctionnalité) :
 * le serveur XAM-XAM LAB tourne normalement ; seuls les jetons (jetons.css) et le logo sont injectés dans le navigateur.
 *
 *   XX_MAQUETTE_URL=http://localhost:3130 node design/identite/maquettes.mjs
 *
 * Captures écrites dans design/identite/maquettes/ (ordinateur et téléphone, modes sombre et clair).
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.XX_MAQUETTE_URL ?? "http://localhost:3130";
const SORTIE = join(ICI, "maquettes");
mkdirSync(SORTIE, { recursive: true });

// Polices intégrées en data: (CSP de l'application : font-src 'self' data:)
const css = readFileSync(join(ICI, "jetons.css"), "utf8").replace(/url\("polices\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ICI, "polices", f)).toString("base64")}")`);
// Grand écran : logo horizontal ; téléphone (< 640 px) : symbole seul, pour ne pas élargir l'en-tête.
const logo = (theme, etroit) => readFileSync(join(ICI, "svg", etroit ? "symbole.svg" : theme === "light" ? "logo-horizontal-transparent.svg" : "logo-horizontal-sombre.svg"), "utf8");

async function habiller(page, theme) {
  await page.addStyleTag({ content: css });
  await page.evaluate(({ theme, svg }) => {
    document.documentElement.dataset.theme = theme;
    for (const a of document.querySelectorAll('a[href="/"]')) {
      if (a.textContent?.trim() !== "XAM-XAM LAB") continue;
      a.innerHTML = svg.replace(/<rect width="[\d.]+" height="[\d.]+" fill="[^"]+"\/>/, "").replace(/width="[\d.]+" height="[\d.]+"/, 'height="34" style="display:block;width:auto"');
      a.setAttribute("aria-label", "XAM-XAM LAB");
    }
  }, { theme, svg: logo(theme, (page.viewportSize()?.width ?? 1440) < 640) });
  await page.waitForTimeout(300);
}

async function session(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/inscription`);
  await page.fill("input[name=display_name]", "Maquette Identité");
  await page.fill("input[name=email]", `maquette-${Date.now()}@xamxam.local`);
  await page.fill("input[name=password]", "maquette-identite-2026");
  await page.click("button[type=submit]");
  await page.waitForSelector("[data-tile]");
  await page.click("button[data-lang=fr]");
  return page;
}

const navigateur = await chromium.launch();
const ordi = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await session(ordi);
for (const theme of ["dark", "light"]) {
  await page.goto(`${BASE}/`); await page.waitForSelector("[data-tile]"); await habiller(page, theme);
  await page.screenshot({ path: join(SORTIE, `tableau-de-bord-${theme === "dark" ? "sombre" : "clair"}.png`) });
  await page.goto(`${BASE}/lab/electronics`);
  await page.locator("select[aria-label='Exemples pédagogiques']").selectOption("rc");
  await page.selectOption("select[name=analysis]", "tran");
  await page.click("[data-testid=simulate]");
  await page.waitForSelector("[data-testid=sim-result] svg", { timeout: 30000 });
  await habiller(page, theme);
  await page.locator("[data-testid=sim-result]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SORTIE, `labo-electronique-${theme === "dark" ? "sombre" : "clair"}.png`) });
  await page.goto(`${BASE}/ai`); await page.waitForLoadState("networkidle"); await habiller(page, theme);
  await page.screenshot({ path: join(SORTIE, `xamxam-ai-${theme === "dark" ? "sombre" : "clair"}.png`) });
}
const cookies = await ordi.cookies();
const tel = await navigateur.newContext({ ...devices["Pixel 7"] });
await tel.addCookies(cookies);
const p2 = await tel.newPage();
for (const theme of ["dark", "light"]) {
  await p2.goto(`${BASE}/`); await p2.waitForSelector("[data-tile]"); await habiller(p2, theme);
  await p2.screenshot({ path: join(SORTIE, `mobile-tableau-de-bord-${theme === "dark" ? "sombre" : "clair"}.png`) });
}
await navigateur.close();
console.log(`Maquettes écrites dans ${SORTIE}`);
