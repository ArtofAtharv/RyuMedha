-- Phase 3 Feature Enhancements: Required Schema Modifications
-- Run these in your Supabase SQL Editor

-- Add 'deemed' status to attendance_status enum
-- You cannot use IF NOT EXISTS inside an ALTER TYPE ADD VALUE statement in older PG versions safely in a single block without DO.
-- If this fails because deemed already exists, you can safely ignore the error.

ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'deemed';
