-- ============================================================================
-- SadhyaSmriti - Complete Database Schema (Academic + Personal Tracks)
-- Version: 1.0-COMPLETE
-- Description: Full-featured schema with both institutional and personal tracking
-- All critical bugs fixed, bot infrastructure included
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 2: CREATE ENUM TYPES
-- ============================================================================

-- Subject types: Academic (linked to course) or Personal (standalone)
CREATE TYPE subject_type AS ENUM ('academic', 'personal');

-- Task priority levels
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Attendance status options
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'cancelled');

-- Grade assessment types
CREATE TYPE grade_type AS ENUM ('mid_sem', 'end_sem', 'viva', 'project', 'presentation', 'assignment', 'quiz');

-- ============================================================================
-- STEP 3: CREATE CORE TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Profiles: Core user table (whatsapp_number is the identity)
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    
    -- Module toggles
    academics_enabled BOOLEAN DEFAULT false,
    personal_enabled BOOLEAN DEFAULT true,
    
    -- Academic settings (if academics_enabled)
    current_university_id UUID,
    current_program_id UUID,
    current_semester_id UUID,
    
    -- Target attendance goal
    target_attendance_pct DECIMAL(5,2) DEFAULT 75.00,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Core user profiles - whatsapp_number is the immutable identity (E.164 format)';
COMMENT ON COLUMN profiles.whatsapp_number IS 'Immutable user identifier from WhatsApp (e.g., +919876543210)';
COMMENT ON COLUMN profiles.academics_enabled IS 'Toggle for institutional tracking features';
COMMENT ON COLUMN profiles.personal_enabled IS 'Toggle for personal subject tracking';

-- -----------------------------------------------------------------------------
-- OTP Codes: For web login authentication
-- -----------------------------------------------------------------------------
CREATE TABLE otp_codes (
    whatsapp_number TEXT PRIMARY KEY REFERENCES profiles(whatsapp_number) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE otp_codes IS 'Temporary OTP storage for web login (5 min expiry, no RLS)';

-- -----------------------------------------------------------------------------
-- Universities: For academic track
-- -----------------------------------------------------------------------------
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    location TEXT,
    country TEXT DEFAULT 'India',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE universities IS 'Reference data for academic institutions (publicly readable)';

-- -----------------------------------------------------------------------------
-- Programs: Degree programs within universities
-- -----------------------------------------------------------------------------
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    degree_type TEXT, -- "UG", "PG", "Diploma"
    total_semesters INTEGER,
    duration_years DECIMAL(3,1),
    default_target_attendance DECIMAL(5,2) DEFAULT 75.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(university_id, name)
);

COMMENT ON TABLE programs IS 'Degree programs offered by universities (publicly readable)';

-- -----------------------------------------------------------------------------
-- Semesters: Academic periods within programs
-- -----------------------------------------------------------------------------
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    semester_number INTEGER NOT NULL,
    name TEXT NOT NULL, -- "Semester 1", "Semester 2"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(program_id, semester_number)
);

COMMENT ON TABLE semesters IS 'Academic periods within a program (publicly readable)';

-- -----------------------------------------------------------------------------
-- Academic Courses: Curriculum courses in a semester
-- -----------------------------------------------------------------------------
CREATE TABLE academic_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    course_code TEXT,
    course_name TEXT NOT NULL,
    credits DECIMAL(3,1),
    course_type TEXT, -- "Core", "Elective", "Lab"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(semester_id, course_code)
);

COMMENT ON TABLE academic_courses IS 'Pre-defined curriculum courses (publicly readable)';
COMMENT ON COLUMN academic_courses.course_code IS 'e.g., CS101, LAW201';

-- -----------------------------------------------------------------------------
-- Subject Categories: For organizing personal subjects
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE subject_categories IS 'User-defined categories for personal subjects (e.g., "CA Prep", "Coding")';

-- -----------------------------------------------------------------------------
-- Subjects: THE BRIDGE - Academic (linked to course) OR Personal (standalone)
-- -----------------------------------------------------------------------------
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Subject Type
    type subject_type NOT NULL,
    name TEXT NOT NULL,
    
    -- For Academic subjects (type = 'academic')
    source_course_id UUID REFERENCES academic_courses(id) ON DELETE SET NULL,
    instructor_name TEXT,
    expected_total_lectures INTEGER,
    
    -- For Personal subjects (type = 'personal')
    category_id UUID REFERENCES subject_categories(id) ON DELETE SET NULL,
    label TEXT, -- User-defined tag like "Professional", "Hobby"
    
    -- Common fields
    description TEXT,
    color_hex TEXT DEFAULT '#8b5cf6',
    is_active BOOLEAN DEFAULT true,
    legacy_attended_lectures INTEGER DEFAULT 0,
    legacy_missed_lectures INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subjects IS 'Central bridge entity - Academic (linked to curriculum) OR Personal (standalone)';
COMMENT ON COLUMN subjects.type IS 'academic = institutional course, personal = user-defined subject';
COMMENT ON COLUMN subjects.source_course_id IS 'Required for academic subjects, NULL for personal';
COMMENT ON COLUMN subjects.category_id IS 'Used for personal subjects, NULL for academic';

-- -----------------------------------------------------------------------------
-- Attendance Logs: Track attendance per lecture (academic subjects only)
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE attendance_logs IS 'Lecture-based attendance tracking (academic subjects only)';
COMMENT ON COLUMN attendance_logs.lecture_date IS 'Date of the lecture (not time, since multiple lectures can occur same day)';

-- -----------------------------------------------------------------------------
-- Grades: Track assessment marks for academic courses
-- -----------------------------------------------------------------------------
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade_type grade_type NOT NULL,
    marks DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    weightage DECIMAL(5,2), -- Percentage weight in final grade
    assessed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE grades IS 'Assessment marks for academic subjects';
COMMENT ON COLUMN grades.weightage IS 'Percentage weight in final grade (e.g., 30 for 30%)';

-- -----------------------------------------------------------------------------
-- Study Timers: Track study sessions for ANY subject (academic or personal)
-- -----------------------------------------------------------------------------
CREATE TABLE study_timers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS 
        (EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE study_timers IS 'Study session tracking for both academic and personal subjects';
COMMENT ON COLUMN study_timers.duration_seconds IS 'Auto-calculated from started_at and ended_at';

-- -----------------------------------------------------------------------------
-- Tasks: Microsoft To-Do style task management
-- -----------------------------------------------------------------------------
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    priority task_priority DEFAULT 'medium',
    has_reminder BOOLEAN DEFAULT false,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tasks IS 'Tasks can optionally link to subjects or exist standalone';
COMMENT ON COLUMN tasks.subject_id IS 'Optional link to subject (academic or personal), can be NULL';

-- -----------------------------------------------------------------------------
-- Bot Sessions: Track bot uptime and usage
-- -----------------------------------------------------------------------------
CREATE TABLE bot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    session_type TEXT CHECK (session_type IN ('laptop', 'mini-pc', 'edge')) DEFAULT 'laptop',
    messages_processed INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bot_sessions IS 'Track bot availability and message throughput (no RLS, admin only)';

-- -----------------------------------------------------------------------------
-- Message Queue: Store messages received when bot is offline
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE message_queue IS 'Queues messages received when bot is offline (no RLS, bot internal)';

-- ============================================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Profiles
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_number);
CREATE INDEX idx_profiles_university ON profiles(current_university_id);
CREATE INDEX idx_profiles_program ON profiles(current_program_id);

-- Universities, Programs, Semesters (for lookups)
CREATE INDEX idx_programs_university ON programs(university_id);
CREATE INDEX idx_semesters_program ON semesters(program_id);
CREATE INDEX idx_academic_courses_semester ON academic_courses(semester_id);

-- Subject Categories
CREATE INDEX idx_categories_profile ON subject_categories(profile_id);

-- Subjects (THE BRIDGE)
CREATE INDEX idx_subjects_profile ON subjects(profile_id);
CREATE INDEX idx_subjects_type ON subjects(type);
CREATE INDEX idx_subjects_source_course ON subjects(source_course_id);
CREATE INDEX idx_subjects_category ON subjects(category_id);
CREATE INDEX idx_subjects_active ON subjects(profile_id, is_active);

-- Attendance Logs
CREATE INDEX idx_attendance_profile ON attendance_logs(profile_id);
CREATE INDEX idx_attendance_subject ON attendance_logs(subject_id);
CREATE INDEX idx_attendance_date ON attendance_logs(profile_id, lecture_date);
CREATE INDEX idx_attendance_status ON attendance_logs(profile_id, subject_id, status);

-- Grades
CREATE INDEX idx_grades_profile ON grades(profile_id);
CREATE INDEX idx_grades_subject ON grades(subject_id);
CREATE INDEX idx_grades_type ON grades(profile_id, grade_type);

-- Study Timers
CREATE INDEX idx_timers_profile ON study_timers(profile_id);
CREATE INDEX idx_timers_subject ON study_timers(subject_id);
CREATE INDEX idx_timers_active ON study_timers(profile_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_timers_date ON study_timers(profile_id, started_at);

-- Tasks
CREATE INDEX idx_tasks_profile ON tasks(profile_id);
CREATE INDEX idx_tasks_subject ON tasks(subject_id);
CREATE INDEX idx_tasks_pending ON tasks(profile_id, is_completed, due_date) WHERE NOT is_completed;
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE NOT is_completed;

-- Message Queue
CREATE INDEX idx_message_queue_pending ON message_queue(whatsapp_number, processed) WHERE NOT processed;

-- ============================================================================
-- STEP 5: CREATE TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_universities_updated_at
    BEFORE UPDATE ON universities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
    BEFORE UPDATE ON programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_semesters_updated_at
    BEFORE UPDATE ON semesters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academic_courses_updated_at
    BEFORE UPDATE ON academic_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subject_categories_updated_at
    BEFORE UPDATE ON subject_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_logs_updated_at
    BEFORE UPDATE ON attendance_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at
    BEFORE UPDATE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: CREATE HELPER FUNCTION FOR RLS (CRITICAL FIX)
-- ============================================================================

-- FIXED VERSION: Properly extracts profile UUID from JWT phone number claim
CREATE OR REPLACE FUNCTION get_profile_id_from_jwt()
RETURNS UUID AS $$
DECLARE
    phone_number TEXT;
    user_profile_id UUID;
BEGIN
    -- Extract phone number from JWT 'sub' claim
    phone_number := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
    
    -- Return NULL if no JWT present (will fail RLS checks)
    IF phone_number IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Look up profile_id from whatsapp_number
    SELECT id INTO user_profile_id 
    FROM profiles 
    WHERE whatsapp_number = phone_number;
    
    RETURN user_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_profile_id_from_jwt() IS 'Extracts profile UUID from JWT phone number claim (FIXED: no longer tries to cast text to UUID)';

-- ============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Note: These tables do NOT have RLS (accessed via service role key or public read):
-- - otp_codes (edge functions only)
-- - bot_sessions (admin only)
-- - message_queue (bot internal)
-- - universities (public reference data)
-- - programs (public reference data)
-- - semesters (public reference data)
-- - academic_courses (public reference data)

-- ============================================================================
-- STEP 8: CREATE RLS POLICIES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Profiles
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = get_profile_id_from_jwt());

-- Note: INSERT handled by bot during signup (service role key)
-- Note: DELETE not allowed (requires admin action)

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Subject Categories
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own categories"
    ON subject_categories FOR SELECT
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can insert own categories"
    ON subject_categories FOR INSERT
    WITH CHECK (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own categories"
    ON subject_categories FOR UPDATE
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can delete own categories"
    ON subject_categories FOR DELETE
    USING (profile_id = get_profile_id_from_jwt());

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Subjects (THE BRIDGE)
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own subjects"
    ON subjects FOR SELECT
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can insert own subjects"
    ON subjects FOR INSERT
    WITH CHECK (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own subjects"
    ON subjects FOR UPDATE
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can delete own subjects"
    ON subjects FOR DELETE
    USING (profile_id = get_profile_id_from_jwt());

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Attendance Logs
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own attendance"
    ON attendance_logs FOR SELECT
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can insert own attendance"
    ON attendance_logs FOR INSERT
    WITH CHECK (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own attendance"
    ON attendance_logs FOR UPDATE
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can delete own attendance"
    ON attendance_logs FOR DELETE
    USING (profile_id = get_profile_id_from_jwt());

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Grades
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own grades"
    ON grades FOR SELECT
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can insert own grades"
    ON grades FOR INSERT
    WITH CHECK (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own grades"
    ON grades FOR UPDATE
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can delete own grades"
    ON grades FOR DELETE
    USING (profile_id = get_profile_id_from_jwt());

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Study Timers
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own timers"
    ON study_timers FOR SELECT
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can insert own timers"
    ON study_timers FOR INSERT
    WITH CHECK (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own timers"
    ON study_timers FOR UPDATE
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can delete own timers"
    ON study_timers FOR DELETE
    USING (profile_id = get_profile_id_from_jwt());

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Tasks
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own tasks"
    ON tasks FOR SELECT
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can insert own tasks"
    ON tasks FOR INSERT
    WITH CHECK (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can update own tasks"
    ON tasks FOR UPDATE
    USING (profile_id = get_profile_id_from_jwt());

CREATE POLICY "Users can delete own tasks"
    ON tasks FOR DELETE
    USING (profile_id = get_profile_id_from_jwt());

-- ============================================================================
-- STEP 9: CREATE UTILITY VIEWS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- View: Attendance summary per subject
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW attendance_summary AS
SELECT 
    al.profile_id,
    al.subject_id,
    s.name AS subject_name,
    s.type AS subject_type,
    s.legacy_attended_lectures + COUNT(*) FILTER (WHERE al.status = 'present') AS total_present,
    s.legacy_missed_lectures + COUNT(*) FILTER (WHERE al.status = 'absent') AS total_absent,
    COUNT(*) FILTER (WHERE al.status = 'cancelled') AS total_cancelled,
    (s.legacy_attended_lectures + s.legacy_missed_lectures) + COUNT(*) FILTER (WHERE al.status IN ('present', 'absent')) AS total_counted_lectures,
    ROUND(
        (
            (s.legacy_attended_lectures + COUNT(*) FILTER (WHERE al.status = 'present'))::NUMERIC / 
            NULLIF((s.legacy_attended_lectures + s.legacy_missed_lectures) + COUNT(*) FILTER (WHERE al.status IN ('present', 'absent')), 0)
        ) * 100, 
        2
    ) AS attendance_percentage
FROM subjects s
LEFT JOIN attendance_logs al ON al.subject_id = s.id
GROUP BY al.profile_id, al.subject_id, s.name, s.type, s.legacy_attended_lectures, s.legacy_missed_lectures;

COMMENT ON VIEW attendance_summary IS 'Aggregated attendance stats per subject';

-- -----------------------------------------------------------------------------
-- View: Active study sessions (ongoing timers)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW active_study_sessions AS
SELECT 
    st.id,
    st.profile_id,
    st.subject_id,
    s.name AS subject_name,
    s.type AS subject_type,
    st.started_at,
    EXTRACT(EPOCH FROM (NOW() - st.started_at)) / 60 AS current_duration_minutes
FROM study_timers st
JOIN subjects s ON st.subject_id = s.id
WHERE st.ended_at IS NULL;

COMMENT ON VIEW active_study_sessions IS 'Lists all currently running study timers with live duration';

-- -----------------------------------------------------------------------------
-- View: Study stats by subject
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW study_stats_by_subject AS
SELECT 
    st.profile_id,
    st.subject_id,
    s.name AS subject_name,
    s.type AS subject_type,
    COUNT(*) AS total_sessions,
    COALESCE(SUM(st.duration_seconds), 0) AS total_seconds,
    ROUND(COALESCE(SUM(st.duration_seconds), 0) / 3600.0, 2) AS total_hours,
    ROUND(COALESCE(AVG(st.duration_seconds), 0) / 60.0, 1) AS avg_session_minutes
FROM study_timers st
JOIN subjects s ON st.subject_id = s.id
WHERE st.ended_at IS NOT NULL
GROUP BY st.profile_id, st.subject_id, s.name, s.type;

COMMENT ON VIEW study_stats_by_subject IS 'Aggregated study time statistics per subject (academic and personal)';

-- -----------------------------------------------------------------------------
-- View: Upcoming tasks
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW upcoming_tasks AS
SELECT 
    t.id,
    t.profile_id,
    t.title,
    t.due_date,
    t.priority,
    t.is_completed,
    s.name AS subject_name,
    s.type AS subject_type
FROM tasks t
LEFT JOIN subjects s ON t.subject_id = s.id
WHERE NOT t.is_completed
  AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE)
ORDER BY t.due_date ASC NULLS LAST, t.priority DESC;

COMMENT ON VIEW upcoming_tasks IS 'Lists pending tasks sorted by due date and priority';

-- -----------------------------------------------------------------------------
-- View: Academic Performance Summary (CGPA calculation)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW academic_performance_summary AS
SELECT 
    g.profile_id,
    s.source_course_id,
    ac.semester_id,
    sem.program_id,
    ac.course_name,
    ac.credits,
    SUM(g.marks) AS total_marks,
    SUM(g.max_marks) AS total_max_marks,
    ROUND((SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100, 2) AS percentage,
    CASE 
        WHEN (SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100 >= 90 THEN 10
        WHEN (SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100 >= 80 THEN 9
        WHEN (SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100 >= 70 THEN 8
        WHEN (SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100 >= 60 THEN 7
        WHEN (SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100 >= 50 THEN 6
        WHEN (SUM(g.marks) / NULLIF(SUM(g.max_marks), 0)) * 100 >= 40 THEN 5
        ELSE 0
    END AS grade_points
FROM grades g
JOIN subjects s ON g.subject_id = s.id
JOIN academic_courses ac ON s.source_course_id = ac.id
JOIN semesters sem ON ac.semester_id = sem.id
WHERE s.type = 'academic'
GROUP BY g.profile_id, s.source_course_id, ac.semester_id, sem.program_id, ac.course_name, ac.credits;

COMMENT ON VIEW academic_performance_summary IS 'Course-wise performance with grade points for CGPA calculation';

-- ============================================================================
-- STEP 10: SEED DEFAULT CATEGORIES FUNCTION
-- ============================================================================

-- Helper function to seed default categories for new users
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

COMMENT ON FUNCTION seed_default_categories IS 'Seeds default categories when new user signs up';


ALTER TABLE otp_codes ADD COLUMN attempts INTEGER DEFAULT 0;
ALTER TABLE otp_codes ADD COLUMN last_sent_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- STEP 11: SEED SAMPLE UNIVERSITIES & PROGRAMS (OPTIONAL)
-- ============================================================================

-- Uncomment to seed sample data for testing

/*
-- Sample Universities
INSERT INTO universities (name, location, country) VALUES
    ('Ramaiah Institute of Technology', 'Bangalore', 'India'),
    ('Delhi University', 'New Delhi', 'India'),
    ('IIT Bombay', 'Mumbai', 'India'),
    ('NLS Bangalore', 'Bangalore', 'India')
ON CONFLICT (name) DO NOTHING;

-- Sample Programs (Example: Ramaiah Institute)
INSERT INTO programs (university_id, name, degree_type, total_semesters, duration_years)
SELECT u.id, 'B.Tech Computer Science', 'UG', 8, 4.0
FROM universities u WHERE u.name = 'Ramaiah Institute of Technology'
ON CONFLICT (university_id, name) DO NOTHING;

INSERT INTO programs (university_id, name, degree_type, total_semesters, duration_years)
SELECT u.id, 'BA LLB', 'UG', 10, 5.0
FROM universities u WHERE u.name = 'NLS Bangalore'
ON CONFLICT (university_id, name) DO NOTHING;

-- Sample Semesters (Example: B.Tech CS Semester 1)
INSERT INTO semesters (program_id, semester_number, name)
SELECT p.id, 1, 'Semester 1'
FROM programs p WHERE p.name = 'B.Tech Computer Science'
ON CONFLICT (program_id, semester_number) DO NOTHING;

-- Sample Academic Courses (Example: Semester 1)
INSERT INTO academic_courses (semester_id, course_code, course_name, credits, course_type)
SELECT s.id, 'CS101', 'Data Structures', 4.0, 'Core'
FROM semesters s 
JOIN programs p ON s.program_id = p.id
WHERE p.name = 'B.Tech Computer Science' AND s.semester_number = 1
ON CONFLICT (semester_id, course_code) DO NOTHING;

INSERT INTO academic_courses (semester_id, course_code, course_name, credits, course_type)
SELECT s.id, 'CS102', 'Digital Logic', 3.0, 'Core'
FROM semesters s 
JOIN programs p ON s.program_id = p.id
WHERE p.name = 'B.Tech Computer Science' AND s.semester_number = 1
ON CONFLICT (semester_id, course_code) DO NOTHING;
*/

-- ============================================================================
-- STEP 12: VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after schema creation to verify everything worked:

-- 1. List all tables created (should show 14 tables)
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Expected tables:
-- academic_courses, attendance_logs, bot_sessions, grades, message_queue,
-- otp_codes, profiles, programs, semesters, study_timers, 
-- subject_categories, subjects, tasks, universities

-- 2. List all ENUM types created (should show 4 types)
-- SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;

-- Expected: attendance_status, grade_type, subject_type, task_priority

-- 3. List all indexes created
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;

-- 4. List all views created (should show 4 views)
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;

-- Expected: academic_performance_summary, active_study_sessions, 
--           attendance_summary, study_stats_by_subject, upcoming_tasks

-- 5. Test RLS function (CRITICAL)
-- SELECT get_profile_id_from_jwt(); -- Should return NULL (no JWT set)

-- ============================================================================
-- STEP 13: TEST WITH SAMPLE DATA
-- ============================================================================

-- Create test user
/*
INSERT INTO profiles (whatsapp_number, display_name, timezone)
VALUES ('+919876543210', 'Test User', 'Asia/Kolkata')
RETURNING *;

-- Seed default categories
SELECT seed_default_categories(
    (SELECT id FROM profiles WHERE whatsapp_number = '+919876543210')
);

-- Create a personal subject
INSERT INTO subjects (profile_id, type, name, category_id)
SELECT 
    p.id,
    'personal',
    'Python Programming',
    (SELECT id FROM subject_categories WHERE profile_id = p.id AND name = 'Coding & Tech')
FROM profiles p
WHERE p.whatsapp_number = '+919876543210'
RETURNING *;

-- Start a study timer
INSERT INTO study_timers (profile_id, subject_id, started_at)
SELECT 
    p.id,
    s.id,
    NOW()
FROM profiles p
JOIN subjects s ON s.profile_id = p.id
WHERE p.whatsapp_number = '+919876543210'
  AND s.name = 'Python Programming'
RETURNING *;

-- Create a task
INSERT INTO tasks (profile_id, subject_id, title, due_date, priority)
SELECT 
    p.id,
    s.id,
    'Complete Python Exercises Chapter 5',
    NOW() + INTERVAL '3 days',
    'high'
FROM profiles p
JOIN subjects s ON s.profile_id = p.id
WHERE p.whatsapp_number = '+919876543210'
  AND s.name = 'Python Programming'
RETURNING *;

-- Clean up test data
DELETE FROM profiles WHERE whatsapp_number = '+919876543210';
*/

-- ============================================================================
-- COMPLETE SCHEMA READY ✅
-- ============================================================================

-- Summary of what was created:
-- ✅ 14 tables (with proper relationships and constraints)
-- ✅ 4 ENUM types (for type safety)
-- ✅ 5 utility views (for common queries)
-- ✅ Comprehensive indexes (for performance)
-- ✅ RLS policies (for security)
-- ✅ Auto-update triggers (for timestamps)
-- ✅ FIXED: RLS function (no longer crashes on phone number)
-- ✅ ADDED: OTP table (for web login)
-- ✅ ADDED: Bot infrastructure (sessions + message queue)
-- ✅ SUPPORT: Both academic and personal tracks

-- Next steps:
-- 1. Run verification queries to confirm setup
-- 2. Seed sample universities/programs if needed
-- 3. Deploy WhatsApp bot with edge functions
-- 4. Build Next.js dashboard
-- 5. Test end-to-end flow: WhatsApp signup → Web login → Create subject → Track time

-- For questions or issues, refer to documentation or test queries above


/* Delete all users and empty the table

TRUNCATE TABLE message_queue CASCADE;
TRUNCATE TABLE bot_sessions CASCADE;
TRUNCATE TABLE otp_codes CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE study_timers CASCADE;
TRUNCATE TABLE grades CASCADE;
TRUNCATE TABLE attendance_logs CASCADE;
TRUNCATE TABLE subjects CASCADE;
TRUNCATE TABLE subject_categories CASCADE;
TRUNCATE TABLE profiles CASCADE;

*/