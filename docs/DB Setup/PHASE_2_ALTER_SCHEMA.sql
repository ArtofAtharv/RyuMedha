-- ============================================================================
-- Phase 2 Enhancements - Schema Updates
-- Run these statements in your Supabase SQL Editor to apply the changes
-- ============================================================================

-- 1. Tasks Table Updates (For Upcoming Exams and Reminders)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_exam BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMPTZ;

-- 2. Study Timers Table Updates (For Pause Tracking)
ALTER TABLE study_timers ADD COLUMN IF NOT EXISTS total_pause_seconds INTEGER DEFAULT 0;
ALTER TABLE study_timers ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMPTZ;

-- Note: The duration_seconds generated column in study_timers remains the same
-- because it calculates (ended_at - started_at). We will subtract total_pause_seconds
-- dynamically in code or by modifying the generated column if necessary, but
-- the simplest non-breaking approach is to calculate actual_duration in views or app logic.
-- However, if we want to update the generated column directly:
-- ALTER TABLE study_timers DROP COLUMN duration_seconds;
-- ALTER TABLE study_timers ADD COLUMN duration_seconds INTEGER GENERATED ALWAYS AS
--   (EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER - total_pause_seconds) STORED;

-- We will leave it to the app logic to subtract total_pause_seconds from duration_seconds
-- to keep views and prior data intact without complex recreation.
