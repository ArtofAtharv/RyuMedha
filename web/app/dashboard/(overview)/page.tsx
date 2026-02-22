// app/dashboard/page.tsx — protected server component (session via proxy.ts)

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { InteractiveAttendanceGrid } from '@/components/dashboard/interactive-attendance-grid'
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, CircleCheck, ChartColumn, Clock, ListTodo, GraduationCap, FolderOpen, Target } from 'lucide-react'
import { format } from 'date-fns'
import { ProfileProvider, UserProfile } from '@/components/dashboard/profile-context'
import { OverviewContent } from './overview-content'

export default async function DashboardPage() {
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

  // Fetch fresh display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('whatsapp_number', session.user.phone)
    .single()

  const displayName = profile?.display_name || session.user.name || session.user.phone

  // Fetch all dashboard data concurrently
  const [
    { data: subjectsData },
    { data: attendanceLogs },
    { data: pendingTasks },
    { data: timersData },
    { data: gradesData },
    { data: categoriesData }
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, color_hex, type, is_active, legacy_attended_lectures, legacy_missed_lectures, category_id, label, instructor_name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('attendance_logs')
      .select('subject_id, status')
      .eq('profile_id', profile?.id)
      .in('status', ['present', 'absent']),
    supabase
      .from('tasks')
      .select('id, subject_id, subjects(type)')
      .eq('profile_id', profile?.id)
      .eq('is_completed', false),
    supabase
      .from('study_timers')
      .select('duration_seconds, subject_id, subjects(type)')
      .eq('profile_id', profile?.id)
      .not('ended_at', 'is', null),
    supabase
      .from('grades')
      .select('marks, max_marks, subject_id, subjects!inner(type)')
      .eq('profile_id', profile?.id),
    supabase
      .from('subject_categories')
      .select('*')
      .eq('profile_id', profile?.id)
  ])

  // Dynamically compute attendance (matches Bot logic exactly)
  
  const categories = categoriesData || []

  // Now perform all derivations
  
  // 1. Compute attendance
  const attendanceData = subjectsData?.filter(s => s.type === 'academic').map(sub => {
    const subjectLogs = attendanceLogs?.filter(log => log.subject_id === sub.id) || []
    const logPresent = subjectLogs.filter(log => log.status === 'present').length
    const logAbsent = subjectLogs.filter(log => log.status === 'absent').length

    const totalPresent = logPresent + (sub.legacy_attended_lectures || 0)
    const totalAbsent = logAbsent + (sub.legacy_missed_lectures || 0)
    const total = totalPresent + totalAbsent
    const pct = total > 0 ? (totalPresent / total) * 100 : 0

    return {
      subject_id: sub.id,
      subject_name: sub.name,
      total_present: totalPresent,
      total_absent: totalAbsent,
      attendance_percentage: pct
    }
  }).sort((a, b) => a.attendance_percentage - b.attendance_percentage) || []

  // 2. Compute pending tasks
  let academicPendingTasks = 0
  let personalPendingTasks = 0
  pendingTasks?.forEach(t => {
    // @ts-ignore
    const type = t.subjects?.type
    if (type === 'academic') academicPendingTasks++
    else if (type === 'personal') personalPendingTasks++
  })

  // 3. Compute study timer durations
  let academicStudySecs = 0
  let personalStudySecs = 0
  timersData?.forEach(t => {
    // @ts-ignore
    const type = t.subjects?.type
    if (type === 'academic') academicStudySecs += (t.duration_seconds || 0)
    else if (type === 'personal') personalStudySecs += (t.duration_seconds || 0)
  })

  const academicStudyHours = (academicStudySecs / 3600).toFixed(1)
  const personalStudyHours = (personalStudySecs / 3600).toFixed(1)

  // 4. Compute grades
  let academicScore = 0
  let academicMax = 0
  let personalScore = 0
  let personalMax = 0

  gradesData?.forEach(g => {
    // @ts-ignore
    const type = g.subjects?.type
    if (type === 'academic') {
      academicScore += Number(g.marks)
      academicMax += Number(g.max_marks)
    } else if (type === 'personal') {
      personalScore += Number(g.marks)
      personalMax += Number(g.max_marks)
    }
  })

  const academicGradePct = academicMax > 0 ? Math.round((academicScore / academicMax) * 100) : null
  const personalScorePct = personalMax > 0 ? Math.round((personalScore / personalMax) * 100) : null

  // 5. Derived attendance global stats
  const totalPresent = attendanceData?.reduce((s, r) => s + (r.total_present ?? 0), 0) ?? 0
  const totalAbsent = attendanceData?.reduce((s, r) => s + (r.total_absent ?? 0), 0) ?? 0
  const overallAttendancePct = totalPresent + totalAbsent > 0
    ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
    : null

  // 6. Filter subjects
  const academicSubjects = subjectsData?.filter(s => s.type === 'academic') || []
  const personalSubjects = subjectsData?.filter(s => s.type === 'personal') || []

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Page content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-black">
            Welcome back, <span className="gradient-accent-text">{displayName}</span>!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">📱 {session.user.phone}</p>
        </div>

        <OverviewContent 
          profile={profile as unknown as UserProfile}
          academicOverviewData={{
            overallAttendancePct,
            totalPresent,
            totalAbsent,
            academicGradePct,
            academicPendingTasks,
            academicStudyHours,
            attendanceData,
            academicSubjects,
            token: session.user.supabaseToken,
            profileId: profile?.id
          }}
          personalOverviewData={{
            personalScorePct,
            personalPendingTasks,
            personalStudyHours,
            personalSubjects,
            categories
          }}
        />

      </main>
    </div>
  )
}
