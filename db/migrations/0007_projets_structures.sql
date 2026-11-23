-- Projets structurés (mémoires, BTS, ingénieurs, R&D, start-up) : sections du dossier et nomenclature chiffrée.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS level TEXT;            -- memoire_technicien, projet_bts, projet_ingenieur, recherche, fin_formation, startup
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_key TEXT;     -- modèle d'origine (src/lib/project-templates.ts)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS methodology TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS architecture TEXT;     -- architecture matérielle et logicielle
ALTER TABLE projects ADD COLUMN IF NOT EXISTS programming TEXT;      -- programmation et configuration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tests TEXT;            -- plan de simulation et de tests
ALTER TABLE projects ADD COLUMN IF NOT EXISTS results TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS conclusion TEXT;

-- Nomenclature (liste des composants) et budget prévisionnel : prix saisis par l'utilisateur, jamais inventés.
CREATE TABLE IF NOT EXISTS project_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price NUMERIC CHECK (unit_price IS NULL OR unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  supplier TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_components_project ON project_components(project_id);
