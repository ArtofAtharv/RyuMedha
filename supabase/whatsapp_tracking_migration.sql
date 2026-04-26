-- ============================================================================
-- RYUMEDHA DB MIGRATION: WhatsApp Engagement & Status Tracking (SECURE)
-- ============================================================================

-- 1. Add admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ;

-- 2. Set the admin user (only run this once)
UPDATE profiles SET is_admin = true WHERE whatsapp_number LIKE '%8767689904%';

-- 3. Message logs table
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    wa_message_id TEXT UNIQUE, 
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    body TEXT,
    message_type TEXT, 
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. View for Window Status
CREATE OR REPLACE VIEW whatsapp_window_status AS
SELECT 
    p.id as profile_id, p.display_name, p.whatsapp_number, p.last_user_message_at,
    CASE 
        WHEN p.last_user_message_at IS NULL OR p.last_user_message_at < NOW() - INTERVAL '24 hours' THEN 'expired'
        WHEN p.last_user_message_at < NOW() - INTERVAL '22 hours' THEN 'closing_soon'
        ELSE 'open'
    END as window_status,
    EXTRACT(EPOCH FROM (p.last_user_message_at + INTERVAL '24 hours' - NOW())) / 3600 as hours_remaining
FROM profiles p;

-- 5. Secure Function for Admin Data Fetching
-- This ensures that even if someone hacks the frontend, the database will refuse to return data
CREATE OR REPLACE FUNCTION get_admin_whatsapp_status()
RETURNS SETOF whatsapp_window_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true THEN
    RETURN QUERY SELECT * FROM whatsapp_window_status;
  ELSE
    RETURN;
  END IF;
END;
$$;

-- 6. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_logs_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_whatsapp_logs_updated_at ON whatsapp_message_logs;
CREATE TRIGGER tr_whatsapp_logs_updated_at
    BEFORE UPDATE ON whatsapp_message_logs
    FOR EACH ROW EXECUTE FUNCTION update_whatsapp_logs_updated_at();

-- 7. Security (RLS)
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can see ALL logs, users can see own
DROP POLICY IF EXISTS "Admin view all or user view own" ON whatsapp_message_logs;
CREATE POLICY "Admin view all or user view own" ON whatsapp_message_logs 
FOR SELECT USING (
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true OR profile_id = (SELECT id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

-- Policy: Service role can do anything
DROP POLICY IF EXISTS "Service Role Full Access" ON whatsapp_message_logs;
CREATE POLICY "Service Role Full Access" ON whatsapp_message_logs 
FOR ALL USING (true) WITH CHECK (true);

-- 8. Admin function to clear logs
CREATE OR REPLACE FUNCTION clear_whatsapp_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT is_admin FROM profiles WHERE whatsapp_number = (auth.jwt() ->> 'sub')) = true THEN
    DELETE FROM whatsapp_message_logs;
  END IF;
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
