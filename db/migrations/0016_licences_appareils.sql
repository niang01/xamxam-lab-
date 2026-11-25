-- Licences : suspension réversible et limite d'appareils autorisés par licence.
ALTER TABLE licences DROP CONSTRAINT IF EXISTS licences_status_check;
ALTER TABLE licences ADD CONSTRAINT licences_status_check CHECK (status IN ('issued', 'active', 'suspended', 'revoked'));
ALTER TABLE licence_plans ADD COLUMN IF NOT EXISTS max_devices INT CHECK (max_devices IS NULL OR max_devices BETWEEN 1 AND 100);
ALTER TABLE licences ADD COLUMN IF NOT EXISTS max_devices INT CHECK (max_devices IS NULL OR max_devices BETWEEN 1 AND 100);

-- Appareils utilisés par chaque compte (identifiant aléatoire dans un cookie ; seule son empreinte est stockée).
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  label TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, device_hash)
);
