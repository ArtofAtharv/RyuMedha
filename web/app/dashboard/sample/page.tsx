// web/app/dashboard/sample/page.tsx — Server Component (mirrors main dashboard fetch pattern)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import SampleDashboardContent from './sample-content'

export default async function SampleDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const token = session.user.supabaseToken
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  // 1. Fetch Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, current_semester')
    .eq('whatsapp_number', session.user.phone)
    .single()

  const profileId = profile?.id || ''
  const displayName = profile?.display_name || session.user.name || ''
  const currentSemester = profile?.current_semester || null

  // 2. Fetch ALL active subjects
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('id, name, color_hex, type, is_active, label, instructor_name, expected_total_lectures, legacy_attended_lectures, legacy_missed_lectures, category_id')
    .eq('is_active', true)
    .order('name')

  // 3. Fetch attendance logs
  const { data: attendanceLogs } = await supabase
    .from('attendance_logs')
    .select('id, subject_id, status, lecture_date')
    .eq('profile_id', profileId)
    .in('status', ['present', 'absent'])

  // 4. Fetch grades
  const { data: gradesData } = await supabase
    .from('grades')
    .select('id, subject_id, grade_type, marks, max_marks')
    .eq('profile_id', profileId)

  // 5. Fetch tasks
  const { data: tasksData } = await supabase
    .from('tasks')
    .select('id, title, priority, due_date, subject_id, is_completed, has_reminder, created_at')
    .eq('profile_id', profileId)
    .order('due_date', { ascending: true })

  // 6. Fetch study timer totals
  const { data: timersData } = await supabase
    .from('study_timers')
    .select('duration_seconds')
    .eq('profile_id', profileId)
    .not('ended_at', 'is', null)

  const totalStudySecs = timersData?.reduce((acc, t) => acc + (t.duration_seconds || 0), 0) || 0

  return (
    <SampleDashboardContent 
       profileId={profileId}
       displayName={displayName}
       currentSemester={currentSemester}
       token={token}
       subjects={subjectsData || []}
       attendanceLogs={attendanceLogs || []}
       grades={gradesData || []}
       tasks={tasksData || []}
       totalStudySecs={totalStudySecs}
    />
  )
}
