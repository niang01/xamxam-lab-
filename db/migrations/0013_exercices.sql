-- Tentatives sur la banque d'exercices (suivi de progression) et épreuves d'entraînement.
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  template TEXT NOT NULL,
  given NUMERIC,
  correct BOOLEAN NOT NULL,
  exam_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exercise_attempts_user ON exercise_attempts(user_id, created_at DESC);
