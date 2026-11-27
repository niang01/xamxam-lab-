-- Cours intégrés à la plateforme (contenu XAM-XAM LAB) : sans auteur utilisateur, identifiés par une clé stable
-- afin que les inscriptions, scores et certificats soient conservés lors des mises à jour du contenu.
ALTER TABLE courses ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS builtin_key TEXT UNIQUE;
