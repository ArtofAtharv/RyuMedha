-- Migration: Move shared data to academic_courses
-- Description: Move instructor_name from subjects to academic_courses and add exam_dates.

-- 1. Add shared columns to academic_courses
ALTER TABLE academic_courses ADD COLUMN IF NOT EXISTS instructor_name TEXT;
ALTER TABLE academic_courses ADD COLUMN IF NOT EXISTS exam_dates JSONB;

-- 2. (Optional) Remove redundant column from subjects if we want strict sharing
-- ALTER TABLE subjects DROP COLUMN instructor_name;

-- Note: We keep instructor_name on subjects for now to avoid breaking existing code,
-- but the new bot V2 will primarily use and update the one in academic_courses.
