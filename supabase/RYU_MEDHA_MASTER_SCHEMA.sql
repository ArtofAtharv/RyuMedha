-- ============================================================================
-- Ryu Medha - Master Database Schema (Academic + Personal Tracks)
-- Version: 4.2-CONSOLIDATED (EXACT LIVE PARITY)
-- Description: Comprehensive, production-ready schema integrating all 
--              live dump structures from sqlfile.sql + functional fixes.
-- ============================================================================

-- STEP 1: DROP OLD DB (CLEAN SLATE)
-- ============================================================================
DROP VIEW IF EXISTS attendance_summary CASCADE;
DROP VIEW IF EXISTS active_study_sessions CASCADE;
DROP VIEW IF EXISTS study_stats_by_subject CASCADE;
DROP VIEW IF EXISTS upcoming_tasks CASCADE;
DROP VIEW IF EXISTS academic_performance_summary CASCADE;

DROP TABLE IF EXISTS message_queue CASCADE;
DROP TABLE IF EXISTS bot_sessions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS study_timers CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS subject_categories CASCADE;
DROP TABLE IF EXISTS academic_courses CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS universities CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS subject_type CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS grade_type CASCADE;

-- STEP 2: ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- STEP 3: CREATE ENUM TYPES
-- ============================================================================
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'cancelled', 'deemed');
CREATE TYPE grade_type AS ENUM ('mid_sem', 'end_sem', 'viva', 'project', 'presentation', 'assignment', 'quiz');
CREATE TYPE subject_type AS ENUM ('academic', 'personal');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- STEP 4: CORE TABLES (Matched to sqlfile.sql Ordering)
-- ============================================================================

-- Profiles
CREATE TABLE profiles (
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    target_attendance_pct DECIMAL(5,2) DEFAULT 75.00,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    current_semester_id UUID,
    current_program_id UUID,
    current_university_id UUID,
    personal_enabled BOOLEAN DEFAULT true,
    academics_enabled BOOLEAN DEFAULT false,
    email TEXT,
    display_name TEXT NOT NULL,
    whatsapp_number TEXT UNIQUE NOT NULL,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- OTP Codes
CREATE TABLE otp_codes (
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attempts INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    whatsapp_number TEXT PRIMARY KEY REFERENCES profiles(whatsapp_number) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Universities
CREATE TABLE universities (
    country TEXT DEFAULT 'India',
    location TEXT,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
    default_target_attendance DECIMAL(5,2) DEFAULT 75.00,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    duration_years DECIMAL(3,1),
    total_semesters INTEGER,
    degree_type TEXT,
    name TEXT NOT NULL,
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    UNIQUE(university_id, name)
);

-- Semesters
CREATE TABLE semesters (
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    semester_number INTEGER NOT NULL,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    UNIQUE(program_id, semester_number)
);

-- Academic Courses
CREATE TABLE academic_courses (
    course_code TEXT,
    instructor_name TEXT,
    exam_dates JSONB,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    course_type TEXT,
    credits DECIMAL(3,1),
    course_name TEXT NOT NULL,
    expected_total_lectures INTEGER DEFAULT 0,
    UNIQUE(semester_id, course_code)
);

-- Subject Categories
CREATE TABLE subject_categories (
    color_hex TEXT DEFAULT '#8b5cf6',
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(profile_id, name)
);

-- Subjects
CREATE TABLE subjects (
    source_course_id UUID REFERENCES academic_courses(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    color_hex TEXT DEFAULT '#8b5cf6',
    description TEXT,
    label TEXT,
    type subject_type NOT NULL,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES subject_categories(id) ON DELETE SET NULL,
    expected_total_lectures INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    legacy_attended_lectures INTEGER DEFAULT 0,
    legacy_missed_lectures INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT academic_must_have_course CHECK (
        (type = 'academic' AND source_course_id IS NOT NULL) OR type = 'personal'
    )
);

-- Attendance Logs
CREATE TABLE attendance_logs (
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    status attendance_status NOT NULL,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lecture_date DATE NOT NULL,
    UNIQUE(profile_id, subject_id, lecture_date)
);

-- Grades
CREATE TABLE grades (
    notes TEXT,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade_type grade_type NOT NULL,
    marks DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    weightage DECIMAL(5,2),
    assessed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study Timers
CREATE TABLE study_timers (
    notes TEXT,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    total_pause_seconds INTEGER DEFAULT 0,
    pause_started_at TIMESTAMPTZ
);

-- Tasks
CREATE TABLE tasks (
    priority task_priority DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    description TEXT,
    title TEXT NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    has_reminder BOOLEAN DEFAULT false,
    is_exam BOOLEAN DEFAULT false,
    reminder_time TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT false
);

-- Bot Sessions (Audit Fix: Merged items)
CREATE TABLE bot_sessions (
    created_at TIMESTAMPTZ DEFAULT NOW(),
    errors_count INTEGER DEFAULT 0,
    messages_processed INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ended_at TIMESTAMPTZ,
    session_type TEXT DEFAULT 'edge',
    phone_number TEXT UNIQUE, -- CRITICAL for bot code
    session_data TEXT,        -- CRITICAL for bot code
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Queue
CREATE TABLE message_queue (
    response_sent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    id TEXT PRIMARY KEY, -- WhatsApp wamid
    whatsapp_number TEXT REFERENCES profiles(whatsapp_number),
    message_text TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ
);

-- STEP 5: INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_number);
CREATE INDEX idx_programs_university ON programs(university_id);
CREATE INDEX idx_semesters_program ON semesters(program_id);
CREATE INDEX idx_academic_courses_semester ON academic_courses(semester_id);
CREATE INDEX idx_subjects_profile ON subjects(profile_id);
CREATE INDEX idx_attendance_date ON attendance_logs(profile_id, lecture_date);
CREATE INDEX idx_timers_active ON study_timers(profile_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_tasks_pending ON tasks(profile_id, is_completed, due_date) WHERE NOT is_completed;

-- STEP 6: TRIGGERS & FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_ts BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_universities_ts BEFORE UPDATE ON universities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_programs_ts BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_semesters_ts BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_ts BEFORE UPDATE ON academic_courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_ts BEFORE UPDATE ON subject_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_ts BEFORE UPDATE ON attendance_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grades_ts BEFORE UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_ts BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_sessions_ts BEFORE UPDATE ON bot_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 7: SECURITY (RLS)
-- ============================================================================

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

-- Table Activation
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_courses ENABLE ROW LEVEL SECURITY;

-- Exact Policy Names from sqlfile.sql
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO public USING ((id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO public USING ((id = get_profile_id_from_jwt()));

CREATE POLICY "Users can view own categories" ON subject_categories FOR SELECT TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own categories" ON subject_categories FOR UPDATE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can delete own categories" ON subject_categories FOR DELETE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can insert own categories" ON subject_categories FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));

CREATE POLICY "Users can view own subjects" ON subjects FOR SELECT TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own subjects" ON subjects FOR UPDATE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can delete own subjects" ON subjects FOR DELETE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can insert own subjects" ON subjects FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));

CREATE POLICY "Users can view own attendance" ON attendance_logs FOR SELECT TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own attendance" ON attendance_logs FOR UPDATE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can delete own attendance" ON attendance_logs FOR DELETE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can insert own attendance" ON attendance_logs FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));

CREATE POLICY "Users can view own grades" ON grades FOR SELECT TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own grades" ON grades FOR UPDATE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can delete own grades" ON grades FOR DELETE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can insert own grades" ON grades FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));

CREATE POLICY "Users can view own timers" ON study_timers FOR SELECT TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own timers" ON study_timers FOR UPDATE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can delete own timers" ON study_timers FOR DELETE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can insert own timers" ON study_timers FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));

CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE TO public USING ((profile_id = get_profile_id_from_jwt()));
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));

-- Public Read Access
CREATE POLICY "Public Read Access" ON universities FOR SELECT TO public USING (true);
CREATE POLICY "Public Read Access" ON programs FOR SELECT TO public USING (true);
CREATE POLICY "Public Read Access" ON semesters FOR SELECT TO public USING (true);
CREATE POLICY "Public Read Access" ON academic_courses FOR SELECT TO public USING (true);

-- Authenticated Insert Access for Shared Hierarchy
CREATE POLICY "Authenticated users can insert universities" ON universities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert programs" ON programs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert semesters" ON semesters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert academic courses" ON academic_courses FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated Update Access for Shared Hierarchy
CREATE POLICY "Authenticated users can update universities" ON universities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update programs" ON programs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update semesters" ON semesters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update academic courses" ON academic_courses FOR UPDATE TO authenticated USING (true);

-- STEP 8: VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW attendance_summary AS
SELECT 
    al.profile_id,
    al.subject_id,
    s.name AS subject_name,
    s.type AS subject_type,
    s.legacy_attended_lectures + COUNT(*) FILTER (WHERE al.status = 'present') AS total_present,
    s.legacy_missed_lectures + COUNT(*) FILTER (WHERE al.status = 'absent') AS total_absent,
    COUNT(*) FILTER (WHERE al.status = 'deemed') AS total_deemed,
    COUNT(*) FILTER (WHERE al.status = 'cancelled') AS total_cancelled,
    (s.legacy_attended_lectures + s.legacy_missed_lectures) + 
     COUNT(*) FILTER (WHERE al.status IN ('present', 'absent', 'deemed')) AS total_lectures,
    COALESCE(ac.expected_total_lectures, s.expected_total_lectures) AS expected_total,
    ROUND(
        (
            (s.legacy_attended_lectures + COUNT(*) FILTER (WHERE al.status = 'present') + COUNT(*) FILTER (WHERE al.status = 'deemed'))::NUMERIC / 
            NULLIF((s.legacy_attended_lectures + s.legacy_missed_lectures) + COUNT(*) FILTER (WHERE al.status IN ('present', 'absent', 'deemed')), 0)
        ) * 100, 2
    ) AS attendance_percentage
FROM subjects s
LEFT JOIN academic_courses ac ON s.source_course_id = ac.id
LEFT JOIN attendance_logs al ON al.subject_id = s.id
GROUP BY al.profile_id, al.subject_id, s.name, s.type, s.legacy_attended_lectures, s.legacy_missed_lectures, ac.expected_total_lectures, s.expected_total_lectures;

CREATE OR REPLACE VIEW active_study_sessions AS
SELECT st.id, st.profile_id, st.subject_id, s.name AS subject_name, s.type AS subject_type, st.started_at,
       EXTRACT(EPOCH FROM (NOW() - st.started_at)) / 60 AS current_duration_minutes,
       st.pause_started_at IS NOT NULL AS is_paused
FROM study_timers st 
JOIN subjects s ON st.subject_id = s.id 
WHERE st.ended_at IS NULL;

CREATE OR REPLACE VIEW study_stats_by_subject AS
SELECT st.profile_id, st.subject_id, s.name AS subject_name, s.type AS subject_type,
       COUNT(*) AS total_sessions, 
       COALESCE(SUM(st.duration_seconds), 0) AS total_seconds,
       ROUND(COALESCE(SUM(st.duration_seconds), 0) / 3600.0, 2) AS total_hours
FROM study_timers st 
JOIN subjects s ON st.subject_id = s.id 
WHERE st.ended_at IS NOT NULL
GROUP BY st.profile_id, st.subject_id, s.name, s.type;

CREATE OR REPLACE VIEW upcoming_tasks AS
SELECT t.id, t.profile_id, t.title, t.due_date, t.priority, t.is_completed, t.is_exam, s.name AS subject_name
FROM tasks t 
LEFT JOIN subjects s ON t.subject_id = s.id
WHERE NOT t.is_completed AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE)
ORDER BY t.due_date ASC NULLS LAST, t.priority DESC;

CREATE OR REPLACE VIEW academic_performance_summary AS
SELECT 
    g.profile_id, 
    ac.semester_id, 
    ROUND(AVG((g.marks / NULLIF(g.max_marks, 0)) * 10), 2) AS semester_gpa,
    SUM(ac.credits) AS total_credits_counted
FROM grades g 
JOIN subjects s ON g.subject_id = s.id 
JOIN academic_courses ac ON s.source_course_id = ac.id
WHERE s.type = 'academic' 
GROUP BY g.profile_id, ac.semester_id;

-- STEP 9: SEEDING FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_categories(user_profile_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO subject_categories (profile_id, name, is_default, color_hex) VALUES
        (user_profile_id, 'Professional Development', true, '#3b82f6'),
        (user_profile_id, 'Competitive Exams', true, '#ef4444'),
        (user_profile_id, 'Coding & Tech', true, '#10b981'),
        (user_profile_id, 'Creative Skills', true, '#f59e0b'),
        (user_profile_id, 'Hobbies', true, '#8b5cf6'),
        (user_profile_id, 'Language Learning', true, '#ec4899')
    ON CONFLICT (profile_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
