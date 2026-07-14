-- 1. Alter Column Constraints
ALTER TABLE profiles ALTER COLUMN whatsapp_number DROP NOT NULL;

-- 2. Add Google OAuth Token Storage columns to Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_token_expiry BIGINT;

-- 3. Automatic Profile Creation on Google Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    display_name, 
    email, 
    timezone, 
    academics_enabled, 
    personal_enabled
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Google User'),
    new.email,
    'Asia/Kolkata',
    false,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  
  -- Seed default categories for the new user
  PERFORM public.seed_default_categories(new.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Re-create RLS Policies to use standard auth.uid()
DROP POLICY IF EXISTS "Owner Access Only" ON profiles;
DROP POLICY IF EXISTS "Owner Access Only" ON subject_categories;
DROP POLICY IF EXISTS "Owner Access Only" ON subjects;
DROP POLICY IF EXISTS "Owner Access Only" ON attendance_logs;
DROP POLICY IF EXISTS "Owner Access Only" ON grades;
DROP POLICY IF EXISTS "Owner Access Only" ON study_timers;
DROP POLICY IF EXISTS "Owner Access Only" ON tasks;
DROP POLICY IF EXISTS "Owner Access Only" ON push_subscriptions;
DROP POLICY IF EXISTS "Owner Access Only" ON task_reminders;

CREATE POLICY "Owner Access Only" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Owner Access Only" ON subject_categories FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON subjects FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON attendance_logs FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON grades FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON study_timers FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON tasks FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON push_subscriptions FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Owner Access Only" ON task_reminders FOR ALL USING (profile_id = auth.uid());
