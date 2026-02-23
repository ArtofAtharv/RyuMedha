-- ============================================================================
-- SQL Fix Script: Drop Strict Constraints
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Drop the academic_must_have_course constraint from subjects table
-- This allows academic subjects to be created even if they are not strictly tied to a pre-defined university course
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS academic_must_have_course;

-- 2. Drop the UNIQUE(profile_id, subject_id, lecture_date) constraint from attendance_logs table
-- This allows users to mark attendance for the same subject multiple times on the same day (e.g. back-to-back lectures or lab + theory)
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_profile_id_subject_id_lecture_date_key;

-- SELECT conname FROM pg_constraint WHERE conrelid = 'attendance_logs'::regclass;

-- 3. Add has_reminder column to tasks table
-- This allows tasks to have an explicit reminder toggle as requested
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS has_reminder BOOLEAN DEFAULT false;
