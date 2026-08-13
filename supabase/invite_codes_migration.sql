-- ============================================================================
-- Ryu Medha - Persistent Invite Codes Migration
-- ============================================================================

-- 1. Create invite_codes Table
CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    duration_type TEXT NOT NULL CHECK (duration_type IN ('1_month', '6_months', '1_year', 'lifetime')),
    max_uses INT, -- NULL = unlimited
    uses_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Update check constraint if table already exists
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_duration_type_check;
ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_duration_type_check CHECK (duration_type IN ('1_month', '6_months', '1_year', 'lifetime'));

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active);

-- 3. Row Level Security Policies
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active invite codes (for code redemption)
CREATE POLICY "Public read invite codes" ON invite_codes
    FOR SELECT USING (true);

-- Full access for service role / admin operations
CREATE POLICY "Service role full access on invite_codes" ON invite_codes
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Initial Seed (Only seeds default codes if the table is completely empty on creation)
INSERT INTO invite_codes (id, code, duration_type, max_uses, uses_count, is_active, created_at)
SELECT 'default-lifetime-1', 'RYULIFETIME', 'lifetime', NULL, 0, TRUE, '2026-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM invite_codes LIMIT 1);

INSERT INTO invite_codes (id, code, duration_type, max_uses, uses_count, is_active, created_at)
SELECT 'default-1year-1', 'RYU1YEAR', '1_year', NULL, 0, TRUE, '2026-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = 'RYU1YEAR');
