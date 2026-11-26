-- Progression de l'utilisateur sur les projets de la banque (en cours / terminé).
CREATE TABLE IF NOT EXISTS bank_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('en_cours', 'termine')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bank_id)
);
