-- ============================================================================
-- Ryu Medha - ULTIMATE CONSOLIDATED SCHEMA (v3.0)
-- Corrected & Verified: 2026-02-25
-- Based on codebase audit of Bot logic, Website code, and documentation.
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    whatsapp_number TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    academics_enabled BOOLEAN DEFAULT false,
    personal_enabled BOOLEAN DEFAULT true,
    current_university_id UUID,
    current_program_id UUID,
    current_semester_id UUID,
    target_attendance_pct DECIMAL(5,2) DEFAULT 75.00,
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
    instructor_name TEXT, -- [AUDIT FIX]: Shared instructor info
    exam_dates JSONB,     -- [AUDIT FIX]: Shared exam schedule
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
    instructor_name TEXT, -- Kept for backward compatibility
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
    total_pause_seconds INTEGER DEFAULT 0, -- [AUDIT FIX]: Net time calculation
    pause_started_at TIMESTAMPTZ,          -- [AUDIT FIX]: Pausing tracking
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
    reminder_time TIMESTAMPTZ, -- [AUDIT FIX]: Notification scheduling
    is_exam BOOLEAN DEFAULT false, -- [AUDIT FIX]: Special rendering for exams
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot Infrastructure
CREATE TABLE bot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT UNIQUE NOT NULL,
    session_data TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================================================
-- STEP 4: INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_number);
CREATE INDEX idx_subjects_profile_active ON subjects(profile_id, is_active);
CREATE INDEX idx_attendance_date ON attendance_logs(profile_id, lecture_date);
CREATE INDEX idx_tasks_pending ON tasks(profile_id, is_completed, due_date) WHERE NOT is_completed;
CREATE INDEX idx_timers_active ON study_timers(profile_id, ended_at) WHERE ended_at IS NULL;

-- ============================================================================
-- STEP 5: SECURITY (RLS)
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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner Access Only" ON profiles FOR ALL USING (id = get_profile_id_from_jwt());
CREATE POLICY "Owner Access Only" ON subject_categories FOR ALL USING (profile_id = get_profile_id_from_jwt());
CREATE POLICY "Owner Access Only" ON subjects FOR ALL USING (profile_id = get_profile_id_from_jwt());
CREATE POLICY "Owner Access Only" ON attendance_logs FOR ALL USING (profile_id = get_profile_id_from_jwt());
CREATE POLICY "Owner Access Only" ON grades FOR ALL USING (profile_id = get_profile_id_from_jwt());
CREATE POLICY "Owner Access Only" ON study_timers FOR ALL USING (profile_id = get_profile_id_from_jwt());
CREATE POLICY "Owner Access Only" ON tasks FOR ALL USING (profile_id = get_profile_id_from_jwt());

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Select" ON universities FOR SELECT USING (true);
CREATE POLICY "Public Select" ON programs FOR SELECT USING (true);
CREATE POLICY "Public Select" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public Select" ON academic_courses FOR SELECT USING (true);

-- ============================================================================
-- STEP 6: VIEWS
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

-- ============================================================================
-- STEP 7: TRIGGERS & FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_ts BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
$$ LANGUAGE plpgsql;
