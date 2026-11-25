-- Projets de la banque enregistrés par l'utilisateur (favoris) et projets personnels créés à partir de la banque.
CREATE TABLE IF NOT EXISTS bank_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bank_id)
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bank_id TEXT;
