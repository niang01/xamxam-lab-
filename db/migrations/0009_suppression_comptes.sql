-- Droit à l'effacement : les références « auteur / décideur » vers un compte supprimé deviennent NULL au lieu de
-- bloquer la suppression du compte (les journaux et objets partagés sont conservés, anonymisés).
ALTER TABLE rc_sessions ALTER COLUMN pilot_id DROP NOT NULL;

DO $$
DECLARE
  r RECORD;
  c TEXT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('clearances', 'granted_by'), ('project_tasks', 'created_by'), ('schematic_versions', 'created_by'), ('normative_tables', 'entered_by'),
    ('components', 'created_by'), ('ai_steps', 'decided_by'), ('device_commands', 'proposer_id'), ('device_commands', 'confirmed_by'),
    ('device_commands', 'preauthorized_by'), ('automations', 'preauthorized_by'), ('rc_sessions', 'pilot_id'), ('rc_events', 'actor_id'),
    ('settings', 'updated_by'), ('drone_profiles', 'updated_by')) AS t(tbl, col)
  LOOP
    SELECT con.conname INTO c
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.contype = 'f' AND rel.relname = r.tbl AND att.attname = r.col AND con.confrelid = 'users'::regclass
     LIMIT 1;
    IF c IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, c);
    END IF;
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL', r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
  END LOOP;
END $$;
