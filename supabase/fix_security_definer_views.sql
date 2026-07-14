-- SQL script to resolve critical security warnings in Supabase.
-- This changes the view parameters to run with the permissions of the querying user (security_invoker)
-- rather than the view creator (security_definer), ensuring RLS policies are respected.

ALTER VIEW public.whatsapp_window_status SET (security_invoker = true);
ALTER VIEW public.active_study_sessions SET (security_invoker = true);
ALTER VIEW public.attendance_summary SET (security_invoker = true);
ALTER VIEW public.academic_performance_summary SET (security_invoker = true);
ALTER VIEW public.study_stats_by_subject SET (security_invoker = true);
ALTER VIEW public.upcoming_tasks SET (security_invoker = true);
