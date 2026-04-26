-- ============================================================================
-- RYUMEDHA DB MIGRATION: WhatsApp Engagement & Status Tracking
-- ============================================================================

-- 1. Track WhatsApp 24-hour window & message delivery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ;

-- 2. Message logs table
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

-- 3. View for Window Status
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

-- 4. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_logs_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_whatsapp_logs_updated_at ON whatsapp_message_logs;
CREATE TRIGGER tr_whatsapp_logs_updated_at
    BEFORE UPDATE ON whatsapp_message_logs
    FOR EACH ROW EXECUTE FUNCTION update_whatsapp_logs_updated_at();

-- 5. Security (RLS)
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can see their own logs
DROP POLICY IF EXISTS "Users can see own logs" ON whatsapp_message_logs;
CREATE POLICY "Users can see own logs" ON whatsapp_message_logs 
FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE id = auth.uid() OR id = get_profile_id_from_jwt() LIMIT 1));

-- Policy 2: Admin (+918767689904) can see ALL logs
DROP POLICY IF EXISTS "Admin can see all logs" ON whatsapp_message_logs;
CREATE POLICY "Admin can see all logs" ON whatsapp_message_logs 
FOR SELECT USING (
  (SELECT whatsapp_number FROM profiles WHERE id = get_profile_id_from_jwt() OR id = auth.uid() LIMIT 1) = '918767689904'
);

-- Policy 3: Allow the service role (Edge Function) to insert/update
DROP POLICY IF EXISTS "Service Role Access" ON whatsapp_message_logs;
CREATE POLICY "Service Role Access" ON whatsapp_message_logs 
FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
