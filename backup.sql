-- 1) Create enum types if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'cancelled', 'deemed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grade_type') THEN
    CREATE TYPE grade_type AS ENUM ('mid_sem', 'end_sem', 'viva', 'project', 'presentation', 'assignment', 'quiz');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type') THEN
    CREATE TYPE subject_type AS ENUM ('academic', 'personal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END$$;


-- 2) Create tables if not exists (preserve original columns). Primary keys set where id uuid NOT NULL present.

CREATE TABLE IF NOT EXISTS "academic_courses" (
  course_code text,
  instructor_name text,
  exam_dates jsonb,
  id uuid NOT NULL,
  semester_id uuid NOT NULL,
  updated_at timestamptz,
  created_at timestamptz,
  course_type text,
  credits numeric(3,1),
  course_name text NOT NULL,
  CONSTRAINT academic_courses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "attendance_logs" (
  subject_id uuid NOT NULL,
  updated_at timestamptz,
  created_at timestamptz,
  notes text,
  status attendance_status NOT NULL,
  id uuid NOT NULL,
  profile_id uuid NOT NULL,
  lecture_date date NOT NULL,
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "bot_sessions" (
  created_at timestamptz,
  errors_count integer,
  messages_processed integer,
  started_at timestamptz NOT NULL,
  id uuid NOT NULL,
  ended_at timestamptz,
  session_type text,
  CONSTRAINT bot_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "grades" (
  notes text,
  id uuid NOT NULL,
  profile_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  grade_type grade_type NOT NULL,
  marks numeric(5,2),
  max_marks numeric(5,2),
  weightage numeric(5,2),
  assessed_date date,
  created_at timestamptz,
  updated_at timestamptz,
  CONSTRAINT grades_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "message_queue" (
  response_sent text,
  created_at timestamptz,
  id uuid NOT NULL,
  whatsapp_number text,
  message_text text NOT NULL,
  received_at timestamptz NOT NULL,
  processed boolean,
  processed_at timestamptz,
  CONSTRAINT message_queue_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "otp_codes" (
  used boolean,
  created_at timestamptz,
  attempts integer,
  last_sent_at timestamptz,
  whatsapp_number text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL
  -- note: original dump did not include an "id" column here
);

CREATE TABLE IF NOT EXISTS "profiles" (
  timezone text NOT NULL,
  target_attendance_pct numeric(5,2),
  updated_at timestamptz,
  created_at timestamptz,
  current_semester_id uuid,
  current_program_id uuid,
  current_university_id uuid,
  personal_enabled boolean,
  academics_enabled boolean,
  email text,
  display_name text NOT NULL,
  whatsapp_number text NOT NULL,
  id uuid NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "programs" (
  default_target_attendance numeric(5,2),
  updated_at timestamptz,
  created_at timestamptz,
  duration_years numeric(3,1),
  total_semesters integer,
  degree_type text,
  name text NOT NULL,
  university_id uuid NOT NULL,
  id uuid NOT NULL,
  CONSTRAINT programs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "semesters" (
  updated_at timestamptz,
  id uuid NOT NULL,
  created_at timestamptz,
  name text NOT NULL,
  semester_number integer NOT NULL,
  program_id uuid NOT NULL,
  CONSTRAINT semesters_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "study_timers" (
  notes text,
  id uuid NOT NULL,
  profile_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz,
  total_pause_seconds integer,
  pause_started_at timestamptz,
  CONSTRAINT study_timers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "subject_categories" (
  color_hex text,
  id uuid NOT NULL,
  is_default boolean,
  created_at timestamptz,
  updated_at timestamptz,
  profile_id uuid NOT NULL,
  name text NOT NULL,
  CONSTRAINT subject_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "subjects" (
  source_course_id uuid,
  is_active boolean,
  color_hex text,
  description text,
  label text,
  type subject_type NOT NULL,
  profile_id uuid NOT NULL,
  id uuid NOT NULL,
  category_id uuid,
  expected_total_lectures integer,
  created_at timestamptz,
  name text NOT NULL,
  legacy_attended_lectures integer,
  legacy_missed_lectures integer,
  updated_at timestamptz,
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "tasks" (
  priority task_priority,
  due_date timestamptz,
  description text,
  title text NOT NULL,
  subject_id uuid,
  profile_id uuid NOT NULL,
  id uuid NOT NULL,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  has_reminder boolean,
  is_exam boolean,
  reminder_time timestamptz,
  is_completed boolean,
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "universities" (
  country text,
  location text,
  name text NOT NULL,
  created_at timestamptz,
  id uuid NOT NULL,
  updated_at timestamptz,
  CONSTRAINT universities_pkey PRIMARY KEY (id)
);


-- 3) Enable RLS and create policies only if not exists.
-- Note: These policies reference get_profile_id_from_jwt(). Ensure the function exists.

-- Helper to create policy only if not exists
CREATE OR REPLACE FUNCTION private.create_policy_if_not_exists(
  p_table regclass,
  p_policy_name text,
  p_for text,
  p_to text,
  p_using text,
  p_with_check text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = split_part(p_table::text, '.', 1)
      AND tablename = split_part(p_table::text, '.', 2)
      AND policyname = p_policy_name
  ) THEN
    EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %s %s %s',
      p_policy_name,
      p_table,
      p_for,
      p_to,
      CASE WHEN p_using IS NOT NULL THEN 'USING (' || p_using || ')' ELSE '' END,
      CASE WHEN p_with_check IS NOT NULL THEN 'WITH CHECK (' || p_with_check || ')' ELSE '' END
    );
  END IF;
END;
$$;


-- Enable RLS on tables and create policies

-- subject_categories
ALTER TABLE IF EXISTS "subject_categories" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.subject_categories', 'Users_can_delete_own_categories', 'DELETE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.subject_categories', 'Users_can_update_own_categories', 'UPDATE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.subject_categories', 'Users_can_view_own_categories', 'SELECT', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);

-- subjects
ALTER TABLE IF EXISTS "subjects" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.subjects', 'Users_can_delete_own_subjects', 'DELETE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.subjects', 'Users_can_update_own_subjects', 'UPDATE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.subjects', 'Users_can_view_own_subjects', 'SELECT', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);

-- attendance_logs
ALTER TABLE IF EXISTS "attendance_logs" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.attendance_logs', 'Users_can_delete_own_attendance', 'DELETE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.attendance_logs', 'Users_can_update_own_attendance', 'UPDATE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.attendance_logs', 'Users_can_view_own_attendance', 'SELECT', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);

-- grades
ALTER TABLE IF EXISTS "grades" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.grades', 'Users_can_delete_own_grades', 'DELETE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.grades', 'Users_can_update_own_grades', 'UPDATE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.grades', 'Users_can_view_own_grades', 'SELECT', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);

-- tasks
ALTER TABLE IF EXISTS "tasks" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.tasks', 'Users_can_delete_own_tasks', 'DELETE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.tasks', 'Users_can_update_own_tasks', 'UPDATE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.tasks', 'Users_can_view_own_tasks', 'SELECT', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);

-- study_timers
ALTER TABLE IF EXISTS "study_timers" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.study_timers', 'Users_can_delete_own_timers', 'DELETE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.study_timers', 'Users_can_update_own_timers', 'UPDATE', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.study_timers', 'Users_can_view_own_timers', 'SELECT', 'public', 'profile_id = get_profile_id_from_jwt()', NULL);

-- profiles
ALTER TABLE IF EXISTS "profiles" ENABLE ROW LEVEL SECURITY;
SELECT private.create_policy_if_not_exists('public.profiles', 'Users_can_update_own_profile', 'UPDATE', 'public', 'id = get_profile_id_from_jwt()', NULL);
SELECT private.create_policy_if_not_exists('public.profiles', 'Users_can_view_own_profile', 'SELECT', 'public', 'id = get_profile_id_from_jwt()', NULL);


-- Clean up: drop helper function (optional). Comment out if you prefer to keep it.
DROP FUNCTION IF EXISTS private.create_policy_if_not_exists(regclass, text, text, text, text, text);