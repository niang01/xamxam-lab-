-- Profil professionnel : nom complet, spécialité, présentation professionnelle.
-- (« Présentation de moi » = colonne bio existante ; fonction = job_title ; organisation, pays : déjà présents.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_summary TEXT;
