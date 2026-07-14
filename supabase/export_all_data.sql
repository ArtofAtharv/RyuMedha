-- SQL function to export all users' database tables as a consolidated JSON.
-- This function runs with SECURITY DEFINER to bypass standard Row-Level Security (RLS) policies,
-- but strictly restricts execution to administrators.

CREATE OR REPLACE FUNCTION export_all_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  is_caller_admin BOOLEAN;
  caller_sub TEXT;
BEGIN
  -- Get caller sub (phone number or UUID depending on auth system)
  BEGIN
    caller_sub := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
  EXCEPTION WHEN OTHERS THEN
    caller_sub := NULL;
  END;

  -- Determine if the caller is an administrator (check by phone or UUID)
  SELECT is_admin INTO is_caller_admin 
  FROM profiles 
  WHERE whatsapp_number = caller_sub 
     OR id::text = caller_sub;
  
  IF is_caller_admin = true THEN
    SELECT json_build_object(
      'exported_at', NOW(),
      'profiles', (SELECT json_agg(p) FROM profiles p),
      'subjects', (SELECT json_agg(s) FROM subjects s),
      'attendance_logs', (SELECT json_agg(a) FROM attendance_logs a),
      'grades', (SELECT json_agg(g) FROM grades g),
      'study_timers', (SELECT json_agg(t) FROM study_timers t),
      'tasks', (SELECT json_agg(tk) FROM tasks tk),
      'task_reminders', (SELECT json_agg(tr) FROM task_reminders tr),
      'whatsapp_message_logs', (SELECT json_agg(wl) FROM whatsapp_message_logs wl)
    ) INTO result;
    RETURN result;
  ELSE
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;
END;
$$;
