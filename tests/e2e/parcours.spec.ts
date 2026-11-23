import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";
import { RUBRICS } from "../../src/lib/catalog";

test.describe.configure({ mode: "serial" });

test("parcours complet : inscription, langues, toutes les rubriques, labos, simulation, IoT, IA, Command Center", async ({ page }) => {
  await signup(page, process.env.XX_E2E_ADMIN ?? "admin@e2e.local");

  // Wolof par défaut : textes non validés affichés en repli, signalés.
  await expect(page.getByTestId("wolof-banner")).toBeVisible();
  await page.click("button[data-lang=en]");
  await expect(page.locator("[data-nav=dashboard]")).toHaveText(/Dashboard/);
  await expect(page.getByTestId("wolof-banner")).toHaveCount(0);
  await page.click("button[data-lang=fr]");
  await expect(page.locator("[data-nav=dashboard]")).toHaveText(/Tableau de bord/);

  // Chaque rubrique s'ouvre sans erreur.
  for (const r of [...RUBRICS, { path: "/admin" }, { path: "/notifications" }]) {
    await page.goto(r.path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(ALERT), r.path).toHaveCount(0);
  }

  // Electrical Lab : loi d'Ohm.
  await page.goto("/lab/electrical");
  const ohm = page.getByTestId("calc-ohm");
  await ohm.locator("input[name=u]").fill("12");
  await ohm.locator("input[name=r]").fill("470");
  await ohm.getByTestId("run-ohm").click();
  await expect(ohm.locator("[data-out=i]")).toContainText("0,0255319");

  // Electronics Lab : exemple + simulation ngspice réelle.
  await page.goto("/lab/electronics");
  await page.locator("select[aria-label='Exemples pédagogiques']").selectOption("divider");
  await expect(page.getByTestId("erc")).toContainText("Aucune erreur");
  await page.getByTestId("simulate").click();
  await expect(page.getByTestId("op-table")).toContainText("3.33333", { timeout: 30_000 });
  await expect(page.getByTestId("sim-result")).toContainText("ngspice-");
  await page.fill("input[name=schema-title]", "Pont diviseur");
  await page.getByTestId("save-schematic").click();
  await expect(page.getByText("Enregistré.")).toBeVisible();

  // Projet.
  await page.goto("/projects?nouveau=1");
  await page.fill("input[name=title]", "Station de pompage");
  await page.click("form button[type=submit]");
  await expect(page.locator("h1")).toHaveText("Station de pompage");

  // IoT Gateway : jeton affiché une seule fois.
  await page.goto("/iot");
  await page.getByTestId("add-device").click();
  await page.fill("input[name=device-name]", "Nœud banc");
  await page.getByTestId("create-device").click();
  await expect(page.getByTestId("device-token")).toBeVisible();

  // IA : moteur de règles signalé, calcul exécuté via l'outil.
  await page.goto("/ai");
  await expect(page.getByTestId("ai-mode")).toContainText("sans clé");
  await page.fill("textarea[name=question]", "Sous-réseau 192.168.1.0/24");
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-answer")).toContainText("254 hôtes");
  await expect(page.getByTestId("ai-steps")).toContainText("run_calculation");

  // Sauvegarde téléchargeable par l'administrateur.
  const bk = await page.request.get("/api/admin/backup");
  expect(bk.status()).toBe(200);
  expect((await bk.json()).format).toBe("xamxam-backup-v1");

  // Command Center : journal d'audit intègre.
  await page.goto("/command-center");
  await expect(page.getByText(/Chaîne intègre/)).toBeVisible();
  await expect(page.getByTestId("audit-log")).toContainText("account.create");
});

test("un élève n'accède pas au Command Center ni à la publication de cours", async ({ page }) => {
  await signup(page, "eleve@e2e.local", "pupil");
  await page.goto("/command-center");
  await expect(page.getByText("Accès administrateur requis.")).toBeVisible();
  await page.goto("/academy");
  await expect(page.getByTestId("new-course")).toHaveCount(0);
});

test("API protégées sans session", async ({ request }) => {
  expect((await request.get("/api/projects")).status()).toBe(401);
  expect((await request.get("/api/command-center")).status()).toBe(401);
  const h = await request.get("/api/health");
  expect((await h.json()).ok).toBe(true);
  const page = await request.get("/connexion");
  const hd = page.headers();
  expect(hd["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(hd["x-frame-options"]).toBe("DENY");
  expect(hd["x-content-type-options"]).toBe("nosniff");
  expect(hd["strict-transport-security"]).toContain("max-age=");
  expect(hd["x-powered-by"]).toBeUndefined();
});
