-- Double authentification (TOTP, RFC 6238). Le secret est chiffré (AES-256-GCM) ; les codes de secours et les
-- jetons de défi ne sont conservés que sous forme d'empreinte SHA-256.
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  last_step BIGINT,                         -- dernier pas TOTP accepté (un code ne sert qu'une fois)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_recovery_codes_user ON user_recovery_codes (user_id);

-- Étape intermédiaire de connexion : mot de passe vérifié, code attendu (5 minutes, 5 essais).
CREATE TABLE IF NOT EXISTS mfa_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
