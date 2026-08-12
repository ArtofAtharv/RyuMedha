-- ============================================================================
-- Ryu Medha - Subscription, Free Trial, and Data Retention Migration
-- ============================================================================

-- 1. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
    plan_type TEXT CHECK (plan_type IN ('monthly', 'yearly')),
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    razorpay_plan_id TEXT,
    trial_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    scheduled_deletion_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Notification Audit Log (to prevent duplicate reminders)
CREATE TABLE IF NOT EXISTS subscription_notifications_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- 'trial_ending_3d', 'deletion_warning_7d', 'deletion_warning_1d'
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, notification_type)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile ON subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_deletion ON subscriptions(scheduled_deletion_at) WHERE scheduled_deletion_at IS NOT NULL;

-- 4. Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_notifications_log ENABLE ROW LEVEL SECURITY;

-- Owner RLS Policies
CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Service Role full access on subscriptions" ON subscriptions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service Role full access on notifications_log" ON subscription_notifications_log
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Trigger for updated_at
CREATE TRIGGER update_subscriptions_ts 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Function & Trigger to auto-create 1-month trial subscription for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.subscriptions (
        profile_id,
        status,
        trial_start,
        trial_end
    )
    VALUES (
        NEW.id,
        'trialing',
        NOW(),
        NOW() + INTERVAL '30 days'
    )
    ON CONFLICT (profile_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_profile_created_subscription ON profiles;
CREATE TRIGGER on_profile_created_subscription
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- 7. Backfill existing profiles with a 30-day Free Trial if they don't have a subscription
INSERT INTO public.subscriptions (profile_id, status, trial_start, trial_end)
SELECT 
    id, 
    'trialing', 
    COALESCE(created_at, NOW()), 
    COALESCE(created_at, NOW()) + INTERVAL '30 days'
FROM profiles
ON CONFLICT (profile_id) DO NOTHING;

-- 8. Automated Data Cleanup Procedure (Purges profiles whose 2-month grace period has passed)
CREATE OR REPLACE FUNCTION cleanup_expired_user_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer := 0;
BEGIN
    -- Delete profiles where trial or subscription has expired AND scheduled_deletion_at <= NOW()
    WITH target_users AS (
        SELECT s.profile_id
        FROM subscriptions s
        WHERE s.status IN ('expired', 'canceled')
          AND s.scheduled_deletion_at IS NOT NULL
          AND s.scheduled_deletion_at <= NOW()
    )
    DELETE FROM public.profiles
    WHERE id IN (SELECT profile_id FROM target_users);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
