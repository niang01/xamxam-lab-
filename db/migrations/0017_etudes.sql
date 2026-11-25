-- Études des logiciels de dimensionnement (installation électrique, photovoltaïque, pompage, séchage, biomasse,
-- compostage, solaire thermique…) : données saisies, résultat du moteur, lien facultatif avec un projet.
CREATE TABLE IF NOT EXISTS studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  software TEXT NOT NULL,
  title TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  table_id UUID REFERENCES normative_tables(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studies_user ON studies(user_id, updated_at DESC);
