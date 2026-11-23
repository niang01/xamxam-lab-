-- Bibliothèque de composants par discipline : paramètres configurables, symbole 2D, documentation.
ALTER TABLE components ADD COLUMN IF NOT EXISTS discipline TEXT;
ALTER TABLE components ADD COLUMN IF NOT EXISTS params JSONB NOT NULL DEFAULT '[]';
ALTER TABLE components ADD COLUMN IF NOT EXISTS symbol2d TEXT;
ALTER TABLE components ADD COLUMN IF NOT EXISTS doc TEXT;
CREATE INDEX IF NOT EXISTS components_discipline ON components(discipline);
