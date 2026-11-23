-- Comptes (clés serveur, jetons à usage unique, profil, vérification d'adresse), essai gratuit et licences.

-- Clés du serveur générées aléatoirement à la première ouverture lorsque l'hébergeur ne fournit pas
-- SESSION_SECRET / XX_ENCRYPTION_KEY. Les variables d'environnement restent prioritaires.
CREATE TABLE IF NOT EXISTS server_keys (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
-- Comptes existants : considérés comme configurés.
UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL;

-- Jetons à usage unique (réinitialisation du mot de passe, vérification d'adresse, initialisation administrateur).
-- Seule l'empreinte SHA-256 du jeton est stockée.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('password_reset', 'email_verify', 'admin_setup')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens(user_id, kind);

-- Essai gratuit : une seule ligne par compte, dates fixées par le serveur, étiquette d'intégrité (HMAC).
CREATE TABLE IF NOT EXISTS trials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  integrity TEXT NOT NULL
);

-- Catégories de licences configurables par l'administrateur.
CREATE TABLE IF NOT EXISTS licence_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INT NOT NULL CHECK (duration_days BETWEEN 1 AND 3660),
  seats INT NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 10000),
  price_xof INT,               -- prix indicatif, facultatif (aucun paiement n'est encaissé par la plateforme)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Licences : la clé n'est jamais stockée en clair (empreinte SHA-256 + 4 derniers caractères pour l'identifier).
CREATE TABLE IF NOT EXISTS licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES licence_plans(id),
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  organization TEXT,
  seats INT NOT NULL CHECK (seats >= 1),
  duration_days INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'active', 'revoked')),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  integrity TEXT,
  note TEXT,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS licence_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id UUID NOT NULL REFERENCES licences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  by_user UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS licence_activation_open ON licence_activations(licence_id, user_id) WHERE deactivated_at IS NULL;

CREATE TABLE IF NOT EXISTS licence_events (
  id BIGSERIAL PRIMARY KEY,
  licence_id UUID REFERENCES licences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
