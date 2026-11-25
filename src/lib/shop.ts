/** Boutique : rayons, transitions de commande autorisées, totaux (fonctions pures, testées). */
export const SHOP_SECTIONS = [
  ["electricite", "Électricité"], ["electronique", "Électronique"], ["enr", "Énergies renouvelables"], ["iot", "Composants IoT"], ["informatique", "Informatique"],
  ["robotique", "Robotique"], ["automatisme", "Automatisme industriel"], ["froid", "Froid et climatisation"], ["mecanique", "Mécanique"], ["genie_civil", "Génie civil"],
  ["telecom", "Télécommunications"], ["drones", "Drones"], ["plomberie", "Plomberie"], ["outillage", "Outillage et équipements techniques"], ["logiciels", "Logiciels et ressources numériques"],
] as const;
export type ShopSection = (typeof SHOP_SECTIONS)[number][0];
export const SECTION_KEYS = SHOP_SECTIONS.map(([k]) => k) as [ShopSection, ...ShopSection[]];

export type OrderStatus = "placed" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refused";
/** Qui peut faire passer une commande d'un état à un autre. */
export const TRANSITIONS: Record<OrderStatus, { to: OrderStatus; by: "seller" | "buyer" }[]> = {
  placed: [{ to: "confirmed", by: "seller" }, { to: "refused", by: "seller" }, { to: "cancelled", by: "buyer" }],
  confirmed: [{ to: "shipped", by: "seller" }, { to: "delivered", by: "seller" }, { to: "cancelled", by: "seller" }],
  shipped: [{ to: "delivered", by: "buyer" }, { to: "delivered", by: "seller" }],
  delivered: [], cancelled: [], refused: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus, role: "seller" | "buyer"): boolean {
  return TRANSITIONS[from].some((t) => t.to === to && t.by === role);
}

/** Total d'une commande : somme des lignes chiffrées ; une ligne « prix sur demande » rend le total incomplet. */
export function orderTotal(lines: { qty: number; unit_price_xof: number | null }[]): { total: number; hasUnpriced: boolean } {
  let total = 0, hasUnpriced = false;
  for (const l of lines) { if (l.unit_price_xof == null) hasUnpriced = true; else total += l.qty * l.unit_price_xof; }
  return { total, hasUnpriced };
}
