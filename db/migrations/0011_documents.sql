-- Documents déposés pour analyse par Aláji IA. Le fichier d'origine n'est PAS conservé : seuls son empreinte,
-- le texte extrait, les tableaux et le rapport d'analyse le sont (suppression possible à tout moment).
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL,
  size_bytes INT NOT NULL,
  sha256 TEXT NOT NULL,
  pages INT,
  ocr BOOLEAN NOT NULL DEFAULT false,
  extracted_text TEXT NOT NULL,
  tables JSONB NOT NULL DEFAULT '[]',
  report JSONB,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_user ON documents(user_id, created_at DESC);
