import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

/** Logiciels de dimensionnement : exemple chargé, calcul serveur, résultats, enregistrement, export, schéma. */
test("dimensionnement : photovoltaïque et pompage (calcul, enregistrement, export Word, schéma 2D)", async ({ page }) => {
  test.setTimeout(180_000);
  await signup(page, `dim-${Date.now()}@e2e.local`);
  await page.click("button[data-lang=fr]");
  await page.goto("/dimensionnement");
  await expect(page.locator("[data-software]")).toHaveCount(27);

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
  // Maquette 3D générée depuis l'étude (dimensions du module saisies)
  await page.click("[data-testid=study-3d]");
  await expect(page).toHaveURL(/\/studio\?maquette=[0-9a-f-]{36}/);
  await expect(page.getByRole("button", { name: "Module 1", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid=assembly-stl]")).toBeEnabled();
  await page.goBack();
  await page.waitForLoadState("networkidle");
  await page.click("[data-testid=study-run]");
  await expect(page.locator("[data-testid=study-diagram]")).toBeVisible({ timeout: 30_000 });
  await page.click("[data-testid=study-diagram]");
  await expect(page).toHaveURL(/\/schemas\?generer=unifilaire_pv/);
  await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
  // Planche imprimable : enregistrer le schéma, puis PDF A3 avec cartouche et DXF
  await page.fill("input[name=diagram-title]", "Unifilaire PV e2e");
  // Cotation : deux points sur la planche, échelle 10 mm par unité ; calques
  await page.fill("input[name=dia-scale]", "10");
  await page.click("[data-testid=dim-mode]");
  const canvas = page.locator("[data-testid=diagram-canvas]");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 30, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("[data-dim='0']")).toContainText("mm");
  await page.click("[data-testid=dim-mode]");
  await page.click("[data-testid=diagram-save]");
  await page.locator("[data-testid=print-panel] summary").click();
  await page.fill("input[name=print-number]", "PV-01");
  const pdfHref = await page.locator("[data-testid=print-pdf]").getAttribute("href");
  const pdf = await page.request.get(pdfHref!);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).toString("latin1")).toContain("(PV-01)");
  const dxf = await page.request.get((await page.locator("[data-testid=export-dxf]").getAttribute("href"))!);
  const dxfText = await dxf.text();
  expect(dxfText).toContain("AC1009");
  expect(dxfText).toContain("COTES");

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
