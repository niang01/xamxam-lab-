import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";

test("marketplace : publication, recherche, demande, échange, acceptation, vente déclarée", async ({ browser }) => {
  const stamp = Date.now();
  const sellerCtx = await browser.newContext(); const buyerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage(); const buyer = await buyerCtx.newPage();
  await signup(seller, `vendeur-${stamp}@e2e.local`, "technician");
  await signup(buyer, `acheteur-${stamp}@e2e.local`, "student");
  for (const p of [seller, buyer]) await p.click("button[data-lang=fr]");

  // Le vendeur publie un composant avec prix, quantité et caractéristiques déclarées
  await seller.goto("/marketplace");
  await seller.click("[data-tab=new]");
  const title = `Capteur DHT22 ${stamp}`;
  await seller.fill("input[name=title]", title);
  await seller.selectOption("select[name=category]", "component");
  await seller.selectOption("select[name=condition]", "new");
  await seller.fill("input[name=price]", "3500");
  await seller.fill("input[name=quantity]", "10");
  await seller.fill("input[name=location]", "Thiès");
  await seller.fill("textarea[name=description]", "Capteur de température et d'humidité, lot neuf.");
  await seller.fill("textarea[name=specs]", "Plage = -40 à 80 °C\nAlimentation = 3,3 à 6 V");
  await seller.check("input[name=delivery-pickup]");
  await seller.click("[data-testid=publish]");
  await expect(seller.locator("[data-testid=listing-detail]")).toContainText("3 500 FCFA");
  await expect(seller.locator("[data-testid=listing-detail]")).toContainText("Déclarées par le vendeur");

  // L'acheteur la trouve par la recherche et envoie une demande
  await buyer.goto("/marketplace");
  await buyer.fill("input[aria-label^='Rechercher']", String(stamp));
  await buyer.locator("[data-testid=listing-card]", { hasText: title }).click();
  await buyer.fill("textarea[name=message]", "Bonjour, 4 pièces disponibles cette semaine ?");
  await buyer.fill("input[name=quantity]", "4");
  await buyer.click("[data-testid=send-inquiry]");
  await expect(buyer.locator("[data-testid=inquiry-thread]")).toContainText("4 pièces");

  // Le vendeur répond et accepte depuis l'onglet Demandes
  await seller.goto("/marketplace?onglet=inquiries");
  await seller.locator("[data-testid=inquiry-list] button", { hasText: title }).click();
  await seller.fill("textarea[name=reply]", "Oui, retrait possible jeudi.");
  await seller.click("[data-testid=reply]");
  await expect(seller.locator("[data-testid=inquiry-thread]")).toContainText("retrait possible jeudi");
  await seller.click("[data-testid=inq-accepted]");
  await expect(seller.locator("[data-testid=inquiry-thread]")).toContainText("Acceptée");

  // L'acheteur voit la réponse ; le vendeur déclare la vente (aucun paiement via la plateforme)
  await buyer.reload();
  await buyer.locator("[data-testid=inquiry-list] button", { hasText: title }).click();
  await expect(buyer.locator("[data-testid=inquiry-thread]")).toContainText("retrait possible jeudi");
  await expect(buyer.locator("[data-testid=inquiry-thread]")).toContainText("Aucun paiement en ligne");
  await seller.click("[data-tab=mine]");
  await seller.locator("[data-testid=listing-card]", { hasText: title }).click();
  await seller.click("[data-testid=status-sold]");
  await expect(seller.locator("[data-testid=listing-detail]")).toContainText("Vendue");
  await buyer.reload();
  await buyer.locator("[data-testid=inquiry-list] button", { hasText: title }).click();
  await expect(buyer.locator("[data-testid=inquiry-thread]")).toContainText("Close");
  for (const p of [seller, buyer]) await expect(p.locator(ALERT)).toHaveCount(0);
  await sellerCtx.close(); await buyerCtx.close();
});
