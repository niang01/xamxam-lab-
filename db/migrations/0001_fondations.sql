-- XAM-XAM LAB — schéma initial (PostgreSQL 16 / PGlite). Idempotent.

-- ===== Identité, profils, droits =====
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_kind TEXT NOT NULL,              -- 15 profils (src/lib/profiles.ts)
  is_admin BOOLEAN NOT NULL DEFAULT false,
  locale TEXT NOT NULL DEFAULT 'wo',
  fallback_locale TEXT NOT NULL DEFAULT 'fr',
  country TEXT,
  bio TEXT,
  skills JSONB NOT NULL DEFAULT '[]',
  public_profile BOOLEAN NOT NULL DEFAULT false,   -- consentement explicite à la visibilité (Talents, Portfolio)
  autonomy_level INT NOT NULL DEFAULT 2 CHECK (autonomy_level BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active',
  session_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                      -- operation_reelle, banc_essai, telepilote_drone, validateur_traduction_wo, jury
  evidence TEXT,
  valid_until DATE,
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

-- ===== Projets =====
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  objectives TEXT,
  problem TEXT,
  specs TEXT,
  kind TEXT NOT NULL DEFAULT 'engineering', -- engineering, thesis, research, startup, course
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','members','public')),
  autonomy_level INT CHECK (autonomy_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','editor','commenter','viewer')),
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_kind TEXT NOT NULL DEFAULT 'human' CHECK (author_kind IN ('human','ai')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Objets techniques (schémas, calculs, simulations, rapports) : nature obligatoire.
CREATE TABLE IF NOT EXISTS schematics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab TEXT NOT NULL,
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  graph JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schematic_versions (
  schematic_id UUID NOT NULL REFERENCES schematics(id) ON DELETE CASCADE,
  version INT NOT NULL,
  graph JSONB NOT NULL,
  message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (schematic_id, version)
);
CREATE TABLE IF NOT EXISTS calc_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  calc_kind TEXT NOT NULL,
  inputs JSONB NOT NULL,
  outputs JSONB,
  missing JSONB NOT NULL DEFAULT '[]',
  nature TEXT NOT NULL DEFAULT 'calculation',
  initiated_by TEXT NOT NULL DEFAULT 'human' CHECK (initiated_by IN ('human','ai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  schematic_id UUID REFERENCES schematics(id) ON DELETE SET NULL,
  engine TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('visual_animation','physics_realtime','numerical_solver')),
  analysis TEXT,
  input TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
  result JSONB,
  errors JSONB NOT NULL DEFAULT '[]',
  duration_ms INT,
  initiated_by TEXT NOT NULL DEFAULT 'human',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tableaux normatifs (jamais inventés : saisis depuis la norme achetée, validés).
CREATE TABLE IF NOT EXISTS normative_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard TEXT NOT NULL,
  table_ref TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB NOT NULL,
  entered_by UUID REFERENCES users(id),
  validated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Bibliothèque de composants =====
CREATE TABLE IF NOT EXISTS components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol_kind TEXT,                         -- type de symbole de l'éditeur (R, C, L, V, D…) ; null = non simulable
  description TEXT NOT NULL,
  function TEXT,
  manufacturer TEXT,
  mpn TEXT,
  datasheet_url TEXT,
  specs JSONB NOT NULL DEFAULT '{}',
  pins JSONB NOT NULL DEFAULT '[]',
  precautions TEXT,
  spice_model TEXT,
  status TEXT NOT NULL DEFAULT 'to_verify' CHECK (status IN ('generic','verified','to_verify')),
  source TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, name, mpn)
);

-- ===== IA =====
CREATE TABLE IF NOT EXISTS ai_agents (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  mode TEXT,                                -- llm / rules
  model TEXT,
  agents JSONB NOT NULL DEFAULT '[]',
  lang TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Chaque appel d'outil par l'IA (journal d'exécution : source unique du compte rendu).
CREATE TABLE IF NOT EXISTS ai_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  agent_key TEXT NOT NULL,
  tool TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  required_level INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done','failed','awaiting_approval','approved','rejected','blocked')),
  error TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL,                     -- user_statement / decision
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== IoT Gateway =====
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  hardware TEXT NOT NULL,                   -- esp32, xiao_esp32s3, arduino, raspberry_pi, other
  protocol TEXT NOT NULL,                   -- https, web_serial, mqtt, ble, lora, modbus
  environment TEXT NOT NULL DEFAULT 'bench' CHECK (environment IN ('virtual','bench','real')),
  capabilities JSONB NOT NULL DEFAULT '{"metrics":[],"commands":[]}',
  token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  firmware_version TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS measurements (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT,
  quality TEXT NOT NULL DEFAULT 'valid' CHECK (quality IN ('valid','suspect','simulated')),
  source TEXT NOT NULL DEFAULT 'device',    -- device / web_serial / simulator
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS measurements_device_metric_ts ON measurements(device_id, metric, ts DESC);

CREATE TABLE IF NOT EXISTS device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  duration_s INT,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('ai','user','automation','estop')),
  proposer_id UUID REFERENCES users(id),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('proposed','confirmed','sent','acknowledged','expired','failed','cancelled','refused')),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  preauthorized_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  ack_at TIMESTAMPTZ,
  ack_payload JSONB,
  rc_session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'acknowledged' OR ack_payload IS NOT NULL)
);

-- ===== Automatisations =====
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  spec JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  preauthorized BOOLEAN NOT NULL DEFAULT false,  -- niveau 5 : préautorisation écrite, révocable
  preauthorized_by UUID REFERENCES users(id),
  dry_run JSONB,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger JSONB NOT NULL,
  outcome TEXT NOT NULL,
  command_id UUID REFERENCES device_commands(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Télépilotage =====
CREATE TABLE IF NOT EXISTS rc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('virtual','bench','real')),
  pilot_id UUID NOT NULL REFERENCES users(id),
  authorization_ref TEXT,
  checklist JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','estopped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS rc_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES rc_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                       -- command, handover, estop, note
  payload JSONB NOT NULL DEFAULT '{}',
  actor_id UUID REFERENCES users(id),
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Earth & Space =====
CREATE TABLE IF NOT EXISTS geo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  http_status INT,
  error TEXT,
  record_count INT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS geo_observations (
  source TEXT NOT NULL,
  lat NUMERIC(8,4) NOT NULL,
  lon NUMERIC(8,4) NOT NULL,
  period TEXT NOT NULL,                     -- 'YYYY-MM-DD' (journalier) ou 'clim-MM' (climatologie)
  parameter TEXT NOT NULL,
  value DOUBLE PRECISION,
  unit TEXT,
  nature TEXT NOT NULL,                     -- modelled / observation / prediction
  resolution TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, lat, lon, period, parameter)
);

-- ===== Académie =====
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  level TEXT NOT NULL,
  lang TEXT NOT NULL,
  summary TEXT,
  lessons JSONB NOT NULL DEFAULT '[]',
  quiz JSONB NOT NULL DEFAULT '[]',
  pass_mark INT NOT NULL DEFAULT 70,
  lab_link TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enrollments (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lessons_done JSONB NOT NULL DEFAULT '[]',
  best_score INT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL,
  digest TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

-- ===== Écosystème (startups, concours, mentors, emplois, actualités, annonces) =====
CREATE TABLE IF NOT EXISTS eco_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('startup','challenge','mentor','job','post','listing')),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  sponsored BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','closed')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Liens utilisateur ↔ élément : candidature, participation, réservation, mise en relation, signalement, note de jury.
CREATE TABLE IF NOT EXISTS eco_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES eco_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('application','entry','booking','connection','report','score','jury')),
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Langues =====
CREATE TABLE IF NOT EXISTS translations (
  lang TEXT NOT NULL,
  key TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','validated','machine_translated')),
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, key)
);

-- ===== Notifications, réglages, journaux =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Journal d'audit en ajout seul, chaîné par empreintes (toute action humaine ou IA significative).
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human','ai','device','system')),
  action TEXT NOT NULL,
  object_kind TEXT,
  object_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
