-- ============================================================================
-- Schema Verification and Fix Script
-- Run this after deploying COMPLETE_SCHEMA.sql
-- ============================================================================

-- ============================================================================
-- PART 1: VERIFICATION QUERIES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Check all tables created
-- -----------------------------------------------------------------------------
SELECT 
    tablename,
    CASE 
        WHEN tablename IN ('profiles', 'subject_categories', 'subjects', 
                           'attendance_logs', 'grades', 'study_timers', 'tasks') 
        THEN '✅ RLS Expected'
        ELSE '⚠️ No RLS (Public/Internal)'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Expected output: 14 tables
-- WITH RLS (7):    profiles, subject_categories, subjects, attendance_logs, 
--                  grades, study_timers, tasks
-- WITHOUT RLS (7): universities, programs, semesters, academic_courses, 
--                  otp_codes, bot_sessions, message_queue

-- -----------------------------------------------------------------------------
-- 2. Check ENUM types (filter out Supabase system types)
-- -----------------------------------------------------------------------------
SELECT typname 
FROM pg_type 
WHERE typtype = 'e' 
  AND typname IN ('attendance_status', 'grade_type', 'subject_type', 'task_priority')
ORDER BY typname;

-- Expected output: 4 types
-- attendance_status, grade_type, subject_type, task_priority
-- (Other types you see are from Supabase's internal auth schema - IGNORE THEM)

-- -----------------------------------------------------------------------------
-- 3. Verify RLS is enabled on correct tables
-- -----------------------------------------------------------------------------
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'profiles', 'subject_categories', 'subjects', 
    'attendance_logs', 'grades', 'study_timers', 'tasks'
  )
ORDER BY tablename;

-- Expected: All 7 tables should show "✅ Enabled"

-- -----------------------------------------------------------------------------
-- 4. Check RLS policies exist
-- -----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN cmd = '*' THEN 'ALL'
        ELSE cmd
    END as command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: At least 2 policies per RLS-enabled table

-- -----------------------------------------------------------------------------
-- 5. Verify helper function exists and works
-- -----------------------------------------------------------------------------
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'get_profile_id_from_jwt';

-- Should return the function definition

-- Test the function (should return NULL - no JWT set)
SELECT get_profile_id_from_jwt();

-- -----------------------------------------------------------------------------
-- 6. Check indexes were created
-- -----------------------------------------------------------------------------
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Expected: 20+ indexes

-- -----------------------------------------------------------------------------
-- 7. Verify views were created
-- -----------------------------------------------------------------------------
SELECT 
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- Expected: 5 views
-- academic_performance_summary, active_study_sessions, attendance_summary,
-- study_stats_by_subject, upcoming_tasks

-- -----------------------------------------------------------------------------
-- 8. Check triggers
-- -----------------------------------------------------------------------------
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Expected: update_updated_at triggers on 9 tables

-- ============================================================================
-- PART 2: FIX SCRIPT (Only run if verification shows issues)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Fix 1: Enable RLS on tables if missing
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    -- Check and enable RLS on each table
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'profiles' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on profiles';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'subject_categories' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on subject_categories';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'subjects' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on subjects';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'attendance_logs' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on attendance_logs';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'grades' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on grades';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'study_timers' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE study_timers ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on study_timers';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'tasks' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on tasks';
    END IF;
END $$;

-- ============================================================================
-- PART 3: TEST DATA (Verify RLS works)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Create test user
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    test_profile_id UUID;
BEGIN
    -- Insert test profile if not exists
    INSERT INTO profiles (whatsapp_number, display_name, timezone)
    VALUES ('+919999999999', 'Test User RLS', 'Asia/Kolkata')
    ON CONFLICT (whatsapp_number) DO NOTHING
    RETURNING id INTO test_profile_id;
    
    IF test_profile_id IS NULL THEN
        SELECT id INTO test_profile_id 
        FROM profiles 
        WHERE whatsapp_number = '+919999999999';
    END IF;
    
    RAISE NOTICE 'Test profile created/found: %', test_profile_id;
END $$;

-- -----------------------------------------------------------------------------
-- Seed default categories for test user
-- -----------------------------------------------------------------------------
SELECT seed_default_categories(
    (SELECT id FROM profiles WHERE whatsapp_number = '+919999999999')
);

-- -----------------------------------------------------------------------------
-- Create test personal subject
-- -----------------------------------------------------------------------------
INSERT INTO subjects (profile_id, type, name, category_id, color_hex)
SELECT 
    p.id,
    'personal',
    'Test Subject - Python',
    (SELECT id FROM subject_categories WHERE profile_id = p.id AND name = 'Coding & Tech' LIMIT 1),
    '#3b82f6'
FROM profiles p
WHERE p.whatsapp_number = '+919999999999'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Test RLS with JWT claim
-- -----------------------------------------------------------------------------

-- Set JWT claim (simulates authenticated user)
SET request.jwt.claims = '{"sub": "+919999999999"}';

-- This should return ONLY the test user's profile
SELECT whatsapp_number, display_name FROM profiles;
-- Expected: 1 row (Test User RLS)

-- This should return ONLY the test user's subjects
SELECT name, type FROM subjects;
-- Expected: 1 row (Test Subject - Python)

-- This should return ONLY the test user's categories
SELECT name FROM subject_categories;
-- Expected: 6 rows (default categories)

-- Reset JWT
RESET request.jwt.claims;

-- This should now return ALL profiles (service role access)
SELECT COUNT(*) as total_profiles FROM profiles;

-- ============================================================================
-- PART 4: CLEANUP TEST DATA (Optional)
-- ============================================================================

-- Uncomment to delete test data
-- DELETE FROM profiles WHERE whatsapp_number = '+919999999999';

-- ============================================================================
-- VERIFICATION COMPLETE ✅
-- ============================================================================

-- Summary check: Run this to confirm everything is working
DO $$
DECLARE
    table_count INTEGER;
    enum_count INTEGER;
    rls_count INTEGER;
    view_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count 
    FROM pg_tables 
    WHERE schemaname = 'public';
    
    -- Count custom ENUMs (exclude Supabase system types)
    SELECT COUNT(*) INTO enum_count 
    FROM pg_type 
    WHERE typtype = 'e' 
      AND typname IN ('attendance_status', 'grade_type', 'subject_type', 'task_priority');
    
    -- Count RLS-enabled tables
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
      AND c.relrowsecurity = true;
    
    -- Count views
    SELECT COUNT(*) INTO view_count
    FROM pg_views
    WHERE schemaname = 'public';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    RAISE NOTICE '
╔════════════════════════════════════════════════╗
║        SCHEMA VERIFICATION SUMMARY              ║
╚════════════════════════════════════════════════╝

Tables Created:       % / 14 expected
Custom ENUM Types:    % / 4 expected
RLS-Enabled Tables:   % / 7 expected
Views Created:        % / 5 expected
RLS Policies:         % / 14+ expected

% % % % %',
    table_count,
    enum_count,
    rls_count,
    view_count,
    policy_count,
    CASE WHEN table_count = 14 THEN '✅' ELSE '❌' END,
    CASE WHEN enum_count = 4 THEN '✅' ELSE '❌' END,
    CASE WHEN rls_count = 7 THEN '✅' ELSE '❌' END,
    CASE WHEN view_count = 5 THEN '✅' ELSE '❌' END,
    CASE WHEN policy_count >= 14 THEN '✅' ELSE '❌' END;
END $$;
