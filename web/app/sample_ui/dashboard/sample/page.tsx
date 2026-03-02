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
    .select('*')
    .eq('whatsapp_number', session.user.phone)
    .single()

  const profileId = profile?.id || ''
  
  // 2. Fetch ALL active subjects
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('*, source_course_id(*)')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('name')

  // 3. Fetch attendance logs
  const { data: attendanceLogs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('profile_id', profileId)

  // 4. Fetch grades
  const { data: gradesData } = await supabase
    .from('grades')
    .select('*')
    .eq('profile_id', profileId)

  // 5. Fetch tasks
  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*, subjects(name, type)')
    .eq('profile_id', profileId)
    .order('due_date', { ascending: true })

  // 6. Fetch study timers
  const { data: timersData } = await supabase
    .from('study_timers')
    .select('*, subjects(id, name, type)')
    .eq('profile_id', profileId)
    .order('started_at', { ascending: false })

  const totalStudySecs = (timersData || [])
    .filter(t => t.ended_at)
    .reduce((acc, t) => {
      const start = new Date(t.started_at).getTime()
      const end = new Date(t.ended_at).getTime()
      const grossSecs = Math.floor((end - start) / 1000)
      const netSecs = Math.max(0, grossSecs - (t.total_pause_seconds || 0))
      return acc + netSecs
    }, 0)

  return (
    <SampleDashboardContent 
       profile={profile}
       token={token}
       subjects={subjectsData || []}
       attendanceLogs={attendanceLogs || []}
       grades={gradesData || []}
       tasks={tasksData || []}
       timers={timersData || []}
       totalStudySecs={totalStudySecs}
    />
  )
}
