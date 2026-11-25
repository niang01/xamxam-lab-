-- Formation à distance : ressources de cours (documents, liens vidéo), devoirs / TD / TP / examens, remises, notes.
CREATE TABLE IF NOT EXISTS course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_index INT,
  kind TEXT NOT NULL CHECK (kind IN ('video_link','file')),
  title TEXT NOT NULL,
  url TEXT,
  file_name TEXT,
  mime TEXT,
  size_bytes INT,
  data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_resources_course ON course_resources(course_id);

CREATE TABLE IF NOT EXISTS course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('devoir','td','tp','examen')),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  max_points NUMERIC NOT NULL DEFAULT 20 CHECK (max_points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  file_name TEXT,
  file_mime TEXT,
  file_data BYTEA,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  late BOOLEAN NOT NULL DEFAULT false,
  grade NUMERIC,
  feedback TEXT,
  graded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  UNIQUE (assignment_id, user_id)
);
