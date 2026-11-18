-- XAM-XAM MARKETPLACE : annonces techniques (composants, kits, équipements, services, logiciels, formations, offres de projet),
-- demandes acheteur → vendeur avec messagerie, favoris, signalements et modération.
-- Aucun paiement n'est traité par la plateforme : la transaction se conclut entre les parties ; le vendeur déclare
-- lui-même « réservé » ou « vendu ». Les caractéristiques sont DÉCLARÉES par le vendeur (non vérifiées).

CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('component','kit','equipment','tool','service','software','training','project')),
  condition TEXT NOT NULL DEFAULT 'na' CHECK (condition IN ('new','used','refurbished','na')),
  price_xof BIGINT CHECK (price_xof IS NULL OR price_xof >= 0),          -- NULL = prix sur demande
  quantity INT CHECK (quantity IS NULL OR quantity >= 0),               -- NULL = sans objet (service…)
  location TEXT,
  delivery JSONB NOT NULL DEFAULT '[]',                                 -- ["pickup","shipping","digital","onsite"]
  specs JSONB NOT NULL DEFAULT '[]',                                    -- [{ "name": "...", "value": "..." }] déclarés par le vendeur
  component_id UUID REFERENCES components(id) ON DELETE SET NULL,       -- lien facultatif vers la bibliothèque de composants
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','reserved','sold','withdrawn')),
  moderation TEXT NOT NULL DEFAULT 'visible' CHECK (moderation IN ('visible','hidden')),
  moderation_note TEXT,
  sponsored BOOLEAN NOT NULL DEFAULT false,                             -- accordé par un administrateur uniquement, toujours affiché
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_listings_browse ON market_listings (status, moderation, category, created_at DESC);
CREATE INDEX IF NOT EXISTS market_listings_seller ON market_listings (seller_id);

-- Demande d'un acheteur sur une annonce (une demande ouverte au plus par acheteur et par annonce).
CREATE TABLE IF NOT EXISTS market_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity INT CHECK (quantity IS NULL OR quantity > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','declined','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS market_inquiries_one_open ON market_inquiries (listing_id, buyer_id) WHERE status IN ('open','accepted');

CREATE TABLE IF NOT EXISTS market_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES market_inquiries(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_messages_thread ON market_messages (inquiry_id, created_at);

CREATE TABLE IF NOT EXISTS market_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS market_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('fraud','prohibited','misleading','duplicate','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','upheld','dismissed')),
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS market_reports_once ON market_reports (listing_id, reporter_id) WHERE status = 'open';
