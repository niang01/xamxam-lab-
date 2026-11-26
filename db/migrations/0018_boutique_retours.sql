-- Boutique : retours après livraison (demande de l'acheteur, acceptation ou refus motivé du vendeur).
ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_status_check;
ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_status_check CHECK (status IN ('placed','confirmed','shipped','delivered','cancelled','refused','return_requested','returned','return_refused'));
