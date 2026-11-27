-- Catalogue de références réelles (fabricant, modèle) : photographies sous licence libre avec auteur et source,
-- brochage détaillé, empreinte, modèle 3D du boîtier, sources et variantes. Les références du catalogue sont
-- identifiées par une clé stable : un nouveau chargement les met à jour sans supprimer les références ajoutées par
-- les utilisateurs ou l'administrateur.
ALTER TABLE components ADD COLUMN IF NOT EXISTS catalogue_key TEXT UNIQUE;
ALTER TABLE components ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE components ADD COLUMN IF NOT EXISTS footprint TEXT;
ALTER TABLE components ADD COLUMN IF NOT EXISTS model3d TEXT;
ALTER TABLE components ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE components ADD COLUMN IF NOT EXISTS pinout JSONB;
ALTER TABLE components ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]';
ALTER TABLE components ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';
ALTER TABLE components DROP CONSTRAINT IF EXISTS components_status_check;
ALTER TABLE components ADD CONSTRAINT components_status_check CHECK (status IN ('generic','verified','to_verify','catalogue'));
CREATE INDEX IF NOT EXISTS components_manufacturer ON components(manufacturer);
