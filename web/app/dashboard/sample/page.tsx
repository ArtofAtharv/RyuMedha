// web/app/dashboard/sample/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import SampleDashboardContent from './sample-content'

export default async function SampleDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${session.user.supabaseToken}` },
      },
    }
  )

  // 1. Fetch Auth Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('whatsapp_number', session.user.phone)
    .single()

  // 2. Fetch Academic Subjects
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('*')
    .eq('is_active', true)
    .eq('type', 'academic')
    .order('name')

  // 3. Fetch specific data sets for the UI
  const { data: attendanceLogs } = await supabase
    .from('attendance_logs')
    .select('subject_id, status')
    .eq('profile_id', profile?.id)
    .in('status', ['present', 'absent'])

  const { data: gradesData } = await supabase
    .from('grades')
    .select('subject_id, marks, max_marks')
    .eq('profile_id', profile?.id)

  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*')
    .eq('profile_id', profile?.id)

  return (
    <SampleDashboardContent 
       profile={profile}
       subjectsData={subjectsData || []}
       attendanceLogs={attendanceLogs || []}
       gradesData={gradesData || []}
       tasksData={tasksData || []}
    />
  )
}
