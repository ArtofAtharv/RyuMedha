-- Phase 2 Feature Enhancements: Required Schema Modifications
-- Run these in your Supabase SQL Editor

-- 1. Tasks Table Enhancements
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_exam BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMPTZ;

-- 2. Study Timers Enhancements
ALTER TABLE study_timers ADD COLUMN IF NOT EXISTS total_pause_seconds INTEGER DEFAULT 0;
ALTER TABLE study_timers ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMPTZ;

-- Note: The duration_seconds column in study_timers is automatically generated 
-- to reflect (ended_at - started_at). The new total_pause_seconds column allows 
-- us to correctly calculate the net duration on the frontend without altering the generated column.
