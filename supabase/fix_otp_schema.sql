-- 🔍 DIAGNOSTIC: Check if otp_codes has a primary key
SELECT 
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type
FROM 
    pg_index i
JOIN 
    pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE 
    i.indrelid = 'otp_codes'::regclass
AND 
    i.indisprimary;

-- 🛠️ FIX: If the above returns no rows, run this to set the primary key
-- This is required for the 'upsert' logic in the Auth function to work correctly.

DO $$
BEGIN
    -- 1. Ensure columns exist (matching the required schema)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'attempts') THEN
        ALTER TABLE otp_codes ADD COLUMN attempts INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'last_sent_at') THEN
        ALTER TABLE otp_codes ADD COLUMN last_sent_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- 2. Add Primary Key if missing
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'otp_codes'::regclass AND contype = 'p'
    ) THEN
        ALTER TABLE otp_codes ADD PRIMARY KEY (whatsapp_number);
    END IF;
END $$;
