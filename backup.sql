-- ============================================================================
-- Ryu Medha - COMPLETE DATABASE BACKUP & CONSOLIDATED SCHEMA
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- ============================================================================
-- STEP 2: CREATE ENUM TYPES
-- ============================================================================
CREATE TYPE subject_type AS ENUM ('academic', 'personal');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'cancelled', 'deemed');
CREATE TYPE grade_type AS ENUM ('mid_sem', 'end_sem', 'viva', 'project', 'presentation', 'assignment', 'quiz');

-- ============================================================================
-- STEP 3: CREATE CORE TABLES
-- ============================================================================

-- Profiles: Core user table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number TEXT UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    academics_enabled BOOLEAN DEFAULT false,
    personal_enabled BOOLEAN DEFAULT true,
    current_university_id UUID,
    current_program_id UUID,
    current_semester_id UUID,
    target_attendance_pct DECIMAL(5,2) DEFAULT 75.00,
    push_notifications_enabled BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    last_user_message_at TIMESTAMPTZ,
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expiry BIGINT,
    whatsapp_verification_code TEXT,
    whatsapp_verification_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP Codes: For web login authentication
CREATE TABLE otp_codes (
    whatsapp_number TEXT PRIMARY KEY REFERENCES profiles(whatsapp_number) ON DELETE CASCADE,
    code TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Universities
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    location TEXT,
    country TEXT DEFAULT 'India',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    degree_type TEXT, 
    total_semesters INTEGER,
    duration_years DECIMAL(3,1),
    default_target_attendance DECIMAL(5,2) DEFAULT 75.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(university_id, name)
);

-- Semesters
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    semester_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, semester_number)
);

-- Academic Courses: Curriculum definition (SHARED among users)
CREATE TABLE academic_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    course_code TEXT,
    course_name TEXT NOT NULL,
    credits DECIMAL(3,1),
    course_type TEXT,
    instructor_name TEXT,
    exam_dates JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(semester_id, course_code)
);

-- Subject Categories
CREATE TABLE subject_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '#8b5cf6',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, name)
);

-- Subjects (User-specific link to Course or Category)
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type subject_type NOT NULL,
    name TEXT NOT NULL,
    source_course_id UUID REFERENCES academic_courses(id) ON DELETE SET NULL,
    instructor_name TEXT,
    expected_total_lectures INTEGER,
    category_id UUID REFERENCES subject_categories(id) ON DELETE SET NULL,
    label TEXT,
    description TEXT,
    color_hex TEXT DEFAULT '#8b5cf6',
    is_active BOOLEAN DEFAULT true,
    legacy_attended_lectures INTEGER DEFAULT 0,
    legacy_missed_lectures INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT academic_subject_must_have_course CHECK (
        (type = 'academic' AND source_course_id IS NOT NULL) OR type = 'personal'
    )
);

-- Attendance Logs
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    lecture_date DATE NOT NULL,
    status attendance_status NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grades
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade_type grade_type NOT NULL,
    marks DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    weightage DECIMAL(5,2),
    assessed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study Timers
CREATE TABLE study_timers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    total_pause_seconds INTEGER DEFAULT 0,
    pause_started_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS 
        (EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    priority task_priority DEFAULT 'medium',
    has_reminder BOOLEAN DEFAULT false,
    reminder_time TIMESTAMPTZ,
    is_exam BOOLEAN DEFAULT false,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    google_task_id TEXT,
    google_tasklist_id TEXT DEFAULT '@default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot Sessions (for persistent user flows)
CREATE TABLE bot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT UNIQUE NOT NULL,
    session_data TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Queue
CREATE TABLE message_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number TEXT REFERENCES profiles(whatsapp_number),
    message_text TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    response_sent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push Subscriptions (Web Push)
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, endpoint)
);

-- Task Reminders
CREATE TABLE task_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    reminder_type TEXT NOT NULL, -- e.g., 'due_date', '1_day_prior', 'custom_hours'
    whatsapp_sent BOOLEAN DEFAULT false,
    push_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Message Logs
CREATE TABLE whatsapp_message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    wa_message_id TEXT UNIQUE, 
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    body TEXT,
    message_type TEXT, 
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_number);
CREATE INDEX idx_subjects_profile_active ON subjects(profile_id, is_active);
CREATE INDEX idx_attendance_date ON attendance_logs(profile_id, lecture_date);
CREATE INDEX idx_tasks_pending ON tasks(profile_id, is_completed, due_date) WHERE NOT is_completed;
CREATE UNIQUE INDEX tasks_google_task_id_idx ON tasks(google_task_id) WHERE google_task_id IS NOT NULL;
CREATE INDEX idx_timers_active ON study_timers(profile_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_task_reminders_polling ON task_reminders(scheduled_for) WHERE (whatsapp_sent = false OR push_sent = false);

-- ============================================================================
-- STEP 5: SECURITY (RLS) & HELPER FUNCTIONS
-- ============================================================================

-- Function to extract profile_id from request JWT claims
CREATE OR REPLACE FUNCTION get_profile_id_from_jwt()
RETURNS UUID AS $$
DECLARE
    phone_number TEXT;
    user_profile_id UUID;
BEGIN
    phone_number := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
    IF phone_number IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO user_profile_id FROM profiles WHERE whatsapp_number = phone_number;
    RETURN user_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_courses ENABLE ROW LEVEL SECURITY;

-- Owner Access Only Policies
CREATE POLICY "Owner Access Only" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Owner Access Only" ON subject_categories FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON subjects FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON attendance_logs FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON grades FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON study_timers FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON tasks FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON push_subscriptions FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON task_reminders FOR ALL USING (profile_id = auth.uid());

-- Owner Access Only Policies for phone-number keyed tables
CREATE POLICY "Owner Access Only" ON otp_codes FOR ALL USING (whatsapp_number = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'));
CREATE POLICY "Owner Access Only" ON bot_sessions FOR ALL USING (phone_number = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'));
CREATE POLICY "Owner Access Only" ON message_queue FOR ALL USING (whatsapp_number = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'));

-- Public Select Policies for shared academic assets
CREATE POLICY "Public Select" ON universities FOR SELECT USING (true);
CREATE POLICY "Public Select" ON programs FOR SELECT USING (true);
CREATE POLICY "Public Select" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public Select" ON academic_courses FOR SELECT USING (true);

-- whatsapp_message_logs Policies
CREATE POLICY "Admin view all or user view own" ON whatsapp_message_logs 
FOR SELECT USING (
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true OR profile_id = (SELECT id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "Service Role Full Access" ON whatsapp_message_logs 
FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: VIEWS
-- ============================================================================

-- Attendance Summary View
CREATE OR REPLACE VIEW attendance_summary AS
SELECT 
    al.profile_id,
    al.subject_id,
    s.name AS subject_name,
    s.type AS subject_type,
    s.legacy_attended_lectures + COUNT(*) FILTER (WHERE al.status = 'present') AS total_present,
    s.legacy_missed_lectures + COUNT(*) FILTER (WHERE al.status = 'absent') AS total_absent,
    COUNT(*) FILTER (WHERE al.status = 'deemed') AS total_deemed,
    (s.legacy_attended_lectures + s.legacy_missed_lectures) + 
     COUNT(*) FILTER (WHERE al.status IN ('present', 'absent', 'deemed')) AS total_lectures,
    ROUND(
        (
            (s.legacy_attended_lectures + COUNT(*) FILTER (WHERE al.status = 'present') + COUNT(*) FILTER (WHERE al.status = 'deemed'))::NUMERIC / 
            NULLIF((s.legacy_attended_lectures + s.legacy_missed_lectures) + COUNT(*) FILTER (WHERE al.status IN ('present', 'absent', 'deemed')), 0)
        ) * 100, 
        2
    ) AS attendance_percentage
FROM subjects s
LEFT JOIN attendance_logs al ON al.subject_id = s.id
GROUP BY al.profile_id, al.subject_id, s.name, s.type, s.legacy_attended_lectures, s.legacy_missed_lectures;

-- WhatsApp Window Status View
CREATE OR REPLACE VIEW whatsapp_window_status AS
SELECT 
    p.id as profile_id, p.display_name, p.whatsapp_number, p.last_user_message_at,
    CASE 
        WHEN p.last_user_message_at IS NULL OR p.last_user_message_at < NOW() - INTERVAL '24 hours' THEN 'expired'
        WHEN p.last_user_message_at < NOW() - INTERVAL '22 hours' THEN 'closing_soon'
        ELSE 'open'
    END as window_status,
    EXTRACT(EPOCH FROM (p.last_user_message_at + INTERVAL '24 hours' - NOW())) / 3600 as hours_remaining
FROM profiles p;

-- ============================================================================
-- STEP 7: FUNCTIONS & TRIGGERS
-- ============================================================================

-- Admin functions & secure procedures
CREATE OR REPLACE FUNCTION get_admin_whatsapp_status()
RETURNS SETOF whatsapp_window_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_sub TEXT;
  is_caller_admin BOOLEAN;
BEGIN
  BEGIN
    caller_sub := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
  EXCEPTION WHEN OTHERS THEN
    caller_sub := NULL;
  END;

  IF caller_sub IS NULL THEN
    RETURN;
  END IF;

  SELECT is_admin INTO is_caller_admin
  FROM profiles
  WHERE id::text = caller_sub
     OR whatsapp_number = caller_sub;

  IF is_caller_admin = true THEN
    RETURN QUERY SELECT * FROM whatsapp_window_status;
  ELSE
    RETURN;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION clear_whatsapp_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT is_admin FROM profiles WHERE id = auth.uid() OR whatsapp_number = (auth.jwt() ->> 'sub')) = true THEN
    DELETE FROM whatsapp_message_logs WHERE id IS NOT NULL;
  END IF;
END;
$$;

-- Trigger logic for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_ts BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_message_logs_ts BEFORE UPDATE ON whatsapp_message_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to seed default categories for new users
CREATE OR REPLACE FUNCTION seed_default_categories(user_profile_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO subject_categories (profile_id, name, is_default) VALUES
        (user_profile_id, 'Professional Development', true),
        (user_profile_id, 'Competitive Exams', true),
        (user_profile_id, 'Language Learning', true),
        (user_profile_id, 'Coding & Tech', true),
        (user_profile_id, 'Creative Skills', true),
        (user_profile_id, 'Hobbies', true)
    ON CONFLICT (profile_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Automatic Profile Creation on Google Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    display_name, 
    email, 
    timezone, 
    academics_enabled, 
    personal_enabled
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Google User'),
    new.email,
    'Asia/Kolkata',
    NULL,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  
  -- Seed default categories for the new user
  PERFORM public.seed_default_categories(new.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Resolve view parameters to use security_invoker (respect RLS)
ALTER VIEW public.whatsapp_window_status SET (security_invoker = true);
ALTER VIEW public.active_study_sessions SET (security_invoker = true);
ALTER VIEW public.attendance_summary SET (security_invoker = true);
ALTER VIEW public.academic_performance_summary SET (security_invoker = true);
ALTER VIEW public.study_stats_by_subject SET (security_invoker = true);
ALTER VIEW public.upcoming_tasks SET (security_invoker = true);

-- SQL function to export all users' database tables as a consolidated JSON
CREATE OR REPLACE FUNCTION export_all_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  is_caller_admin BOOLEAN;
  caller_sub TEXT;
END;
$$;

-- SQL function implementation to export all users' database tables
CREATE OR REPLACE FUNCTION export_all_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  is_caller_admin BOOLEAN;
  caller_sub TEXT;
BEGIN
  -- Get caller sub (phone number or UUID depending on auth system)
  BEGIN
    caller_sub := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
  EXCEPTION WHEN OTHERS THEN
    caller_sub := NULL;
  END;

  -- Determine if the caller is an administrator (check by phone or UUID)
  SELECT is_admin INTO is_caller_admin 
  FROM profiles 
  WHERE whatsapp_number = caller_sub 
     OR id::text = caller_sub;
  
  IF is_caller_admin = true THEN
    SELECT json_build_object(
      'exported_at', NOW(),
      'profiles', (SELECT json_agg(p) FROM profiles p),
      'subjects', (SELECT json_agg(s) FROM subjects s),
      'attendance_logs', (SELECT json_agg(a) FROM attendance_logs a),
      'grades', (SELECT json_agg(g) FROM grades g),
      'study_timers', (SELECT json_agg(t) FROM study_timers t),
      'tasks', (SELECT json_agg(tk) FROM tasks tk),
      'task_reminders', (SELECT json_agg(tr) FROM task_reminders tr),
      'whatsapp_message_logs', (SELECT json_agg(wl) FROM whatsapp_message_logs wl)
    ) INTO result;
    RETURN result;
  END IF;
END;
$$;

-- SQL function to allow authenticated users to delete their own account completely from public.profiles and auth.users
CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- RLS & Security verification: check if auth.uid() is valid
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User is not authenticated';
  END IF;

  -- Delete from profiles first (cascades to other tables like tasks, study_timers, etc.)
  DELETE FROM public.profiles WHERE id = auth.uid();
  
  -- Delete from auth.users to completely delete user auth details
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;