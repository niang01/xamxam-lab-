import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

/** Rubriques livrées par l'audit : documents, banque de projets, exercices, boutique (commande réelle), FAD, appareils. */
test("rubriques : document analysé et exporté, projet de la banque réalisé, exercice corrigé, commande en boutique, FAD, appareils", async ({ page, browser }) => {
  test.setTimeout(180_000);
  // Vendeur (contexte séparé, par l'API) : annonce placée dans un rayon de la boutique.
  const sellerCtx = await browser.newContext();
  const s = sellerCtx.request;
  const stamp = Date.now();
  expect((await s.post("/api/auth/register", { data: { email: `vendeur-${stamp}@e2e.local`, password: "motdepasse-e2e-1", display_name: "Vendeur e2e", profile_kind: "entrepreneur", locale: "fr" } })).status()).toBe(201);
  const listing = await s.post("/api/market/listings", { data: { title: `Capteur DHT22 e2e ${stamp}`, category: "component", condition: "new", price_xof: 2500, quantity: 4, delivery: ["pickup"] } });
  expect(listing.status(), await listing.text()).toBeLessThan(300);
  const listingId = ((await listing.json()) as { id: string }).id;
  expect((await s.put("/api/shop/vendor", { data: { business_name: "Électro e2e", phone: "+221 00 000 00 00" } })).status()).toBe(200);
  expect((await s.patch(`/api/shop/listings/${listingId}`, { data: { shop_section: "iot" } })).status()).toBe(200);

  await signup(page, `rubriques-${stamp}@e2e.local`, "student");
  await page.click("button[data-lang=fr]");

  // Documents : dépôt, analyse, export Word réel
  await page.goto("/documents");
  await page.setInputFiles("input[name=document]", "tests/fixtures/exercice.txt");
  await page.click("[data-testid=doc-send]");
  await expect(page.locator("[data-testid=doc-report]")).toContainText("Exercice", { timeout: 60_000 });
  const href = await page.locator("[data-testid=doc-export-docx]").getAttribute("href");
  const docx = await page.request.get(href!);
  expect(docx.status()).toBe(200);
  expect((await docx.body()).subarray(0, 2).toString()).toBe("PK");

  // Banque de projets : recherche puis réalisation en projet personnel
  await page.goto("/banque-projets");
  await page.fill("input[name=bank-q]", "irrigation");
  await page.locator("[data-bank]").first().click();
  await page.click("[data-testid=bank-realise]");
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30_000 });

  // Exercices : réponse corrigée par le serveur
  await page.goto("/exercices");
  await page.locator("[data-template]").first().click();
  await page.fill("input[name=ex-answer]", "1");
  await page.click("[data-testid=ex-check]");
  await expect(page.locator("[data-testid=ex-result]")).toBeVisible();

  // Boutique : recherche, panier, commande ; confirmation par le vendeur ; paiement annoncé hors ligne
  await page.goto("/boutique");
  await expect(page.locator("[data-testid=payment-status]")).toContainText("Paiement en ligne non disponible");
  await page.fill("input[name=shop-q]", `DHT22 e2e ${stamp}`);
  await page.locator(`[data-product="Capteur DHT22 e2e ${stamp}"] [data-testid=add-to-cart]`).click();
  await page.click("[data-tab=panier]");
  await page.selectOption("select[name=delivery_method]", "pickup");
  await page.fill("input[name=phone]", "77 000 00 00");
  await page.click("[data-testid=checkout]");
  await page.click("[data-tab=commandes]");
  await expect(page.locator("[data-order=placed]")).toHaveCount(1, { timeout: 30_000 });
  const sales = (await (await s.get("/api/shop/orders?role=seller")).json()) as { items: { id: string }[] };
  expect((await s.post(`/api/shop/orders/${sales.items[0].id}`, { data: { status: "confirmed" } })).status()).toBe(200);
  await page.reload(); await page.click("[data-tab=commandes]");
  await expect(page.locator("[data-order=confirmed]")).toHaveCount(1, { timeout: 30_000 });
  const stock = (await (await s.get("/api/shop/vendor")).json()) as { listings: { id: string; quantity: number }[] };
  expect(stock.listings.find((l) => l.id === listingId)!.quantity).toBe(3);

  // Marème IA : l'article réellement en rayon est proposé, avec son prix déclaré
  await page.goto("/boutique");
  await page.fill("input[name=mareme-q]", `DHT22 e2e ${stamp}`);
  await page.click("[data-testid=mareme-send]");
  await expect(page.locator("[data-testid=mareme-log]")).toContainText(`Capteur DHT22 e2e ${stamp}`);
  await expect(page.locator("[data-testid=mareme-log]")).toContainText("FCFA");

  // FAD et appareils
  await page.goto("/fad");
  await expect(page.getByRole("heading", { name: "Mes cours" })).toBeVisible();
  await page.goto("/licence");
  await expect(page.locator("[data-testid=my-devices]")).toContainText("cet appareil");
  await sellerCtx.close();
});
