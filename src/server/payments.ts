/**
 * Paiements : aucun prestataire n'est intégré à ce jour. L'architecture prévoit un adaptateur par prestataire
 * (mobile money, carte) qui confirmerait le paiement d'une commande par webhook signé ; tant qu'aucun n'est
 * configuré, les commandes sont « à régler directement auprès du vendeur » et cela est affiché partout.
 */
export function paymentStatus() {
  return { online: false as const, mode: "a_convenir" as const, message: "Paiement en ligne non disponible : le règlement se fait directement avec le vendeur (à convenir), hors de la plateforme." };
}
