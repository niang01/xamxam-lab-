-- Centre de commande des drones : profil constructeur/exploitation, dernier état reçu de l'autopilote, missions.
CREATE TABLE IF NOT EXISTS drone_profiles (
  device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  profile JSONB NOT NULL,                   -- limites saisies (src/lib/drone.ts : droneProfile)
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drone_state (
  device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  state JSONB NOT NULL,                     -- télémétrie MAVLink (mesures de l'autopilote)
  home_lat DOUBLE PRECISION,
  home_lon DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drone_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  home_lat DOUBLE PRECISION NOT NULL,
  home_lon DOUBLE PRECISION NOT NULL,
  waypoints JSONB NOT NULL,
  check_result JSONB NOT NULL,              -- validation (plafond, géorepérage, autonomie)
  weather JSONB,                            -- évaluation des conditions au moment de la préparation (PRÉVISION)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','simulated','flown','aborted')),
  simulated_on UUID REFERENCES devices(id) ON DELETE SET NULL,   -- drone virtuel (SITL) sur lequel la mission a été jouée
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drone_missions_device ON drone_missions (device_id, created_at DESC);
