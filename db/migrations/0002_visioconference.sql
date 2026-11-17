-- Visioconférence WebRTC : participants présents et messages de signalisation (offres, réponses, candidats ICE).
CREATE TABLE IF NOT EXISTS rtc_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rtc_peers_project ON rtc_peers(project_id, last_seen);
CREATE TABLE IF NOT EXISTS rtc_signals (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_peer UUID NOT NULL,
  to_peer UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('offer','answer','ice')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rtc_signals_to ON rtc_signals(to_peer, id);
