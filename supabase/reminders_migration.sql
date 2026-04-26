-- ============================================================================
-- RYUMEDHA DB MIGRATION: Task Reminders & Web Push Subscriptions
-- Run this script in your Supabase SQL Editor.
-- ============================================================================

-- 1. Add push_notifications_enabled to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT false;

-- 2. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, endpoint)
);

-- Enable RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner Access Only" ON push_subscriptions 
FOR ALL USING (profile_id = get_profile_id_from_jwt());

-- 3. Create task_reminders table
CREATE TABLE IF NOT EXISTS task_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    reminder_type TEXT NOT NULL, -- e.g., 'due_date', '1_day_prior', 'custom_hours'
    whatsapp_sent BOOLEAN DEFAULT false,
    push_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Index for fast polling by edge function cron
CREATE INDEX IF NOT EXISTS idx_task_reminders_polling 
ON task_reminders(scheduled_for) 
WHERE (whatsapp_sent = false OR push_sent = false);

-- Enable RLS for task_reminders
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner Access Only" ON task_reminders 
FOR ALL USING (profile_id = get_profile_id_from_jwt());

-- 4. Enable pg_net if not already enabled (Needed for edge function triggers from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
