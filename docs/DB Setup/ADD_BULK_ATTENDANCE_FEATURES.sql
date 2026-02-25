-- ============================================================================
-- DB SCHEMA UPDATE: Add targets and legacy counters for bulk attendance
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Track the custom user attendance percentage threshold (e.g., 75%, 80%)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS target_attendance_pct DECIMAL(5,2) DEFAULT 75.00;

-- Track legacy lectures that were already attended / missed before starting tracking
-- This helps to correctly offset "classes present" and "classes missed" totals
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS legacy_attended_lectures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS legacy_missed_lectures INTEGER DEFAULT 0;

-- Update the view `attendance_summary` to include legacy totals
-- We recreate it since changing underlying columns sometimes causes issues
DROP VIEW IF EXISTS attendance_summary;
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

COMMENT ON VIEW attendance_summary IS 'Aggregated attendance stats per subject including legacy data';






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

ALTER TABLE profiles ADD COLUMN target_attendance_pct DECIMAL(5,2) DEFAULT 75.00;
ALTER TABLE subjects ADD COLUMN legacy_missed_lectures INTEGER DEFAULT 0;
ALTER TABLE subjects ADD COLUMN legacy_attended_lectures INTEGER DEFAULT 0;
