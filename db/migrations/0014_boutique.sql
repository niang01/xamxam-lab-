-- Boutique XAM-XAM LAB (sur les annonces de la marketplace) : vendeurs, rayons, images, panier, commandes, suivi.
-- Aucun paiement n'est encaissé par la plateforme tant qu'un prestataire n'est pas configuré : mode « à convenir ».
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS shop_section TEXT;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS datasheet_url TEXT;

CREATE TABLE IF NOT EXISTS shop_vendors (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  description TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_images_listing ON listing_images(listing_id);

CREATE TABLE IF NOT EXISTS shop_cart_items (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  qty INT NOT NULL CHECK (qty BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','shipped','delivered','cancelled','refused')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('pickup','shipping','digital','onsite')),
  delivery_address TEXT,
  phone TEXT,
  note TEXT,
  payment_method TEXT NOT NULL DEFAULT 'a_convenir' CHECK (payment_method IN ('a_convenir')),
  total_xof BIGINT,
  has_unpriced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_buyer ON shop_orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_seller ON shop_orders(seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shop_order_items (
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES market_listings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  unit_price_xof BIGINT
);

CREATE TABLE IF NOT EXISTS shop_order_events (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  by_user UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
