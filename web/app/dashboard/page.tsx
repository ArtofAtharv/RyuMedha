// app/dashboard/page.tsx — protected server component (session via proxy.ts)

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { InteractiveAttendanceGrid } from '@/components/dashboard/interactive-attendance-grid'
import { SubjectList } from '@/components/dashboard/subject-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, CircleCheck, ChartColumn, Clock, ListTodo, GraduationCap } from 'lucide-react'
import { format } from 'date-fns'

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

  // Fetch Active Subjects
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('id, name, color_hex, type, is_active, legacy_attended_lectures, legacy_missed_lectures')
    .eq('is_active', true)
    .order('name')

  // Fetch raw attendance logs instead of the view
  const { data: attendanceLogs } = await supabase
    .from('attendance_logs')
    .select('subject_id, status')
    .eq('profile_id', profile?.id)
    .in('status', ['present', 'absent'])

  // Dynamically compute attendance (matches Bot logic exactly)
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

  // Fetch Pending Tasks Count
  const { count: pendingTasksCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile?.id)
    .eq('is_completed', false)

  // Fetch Study Timers (Total Time)
  const { data: timersData } = await supabase
    .from('study_timers')
    .select('duration_seconds')
    .eq('profile_id', profile?.id)
    .not('ended_at', 'is', null)

  const totalStudySecs = timersData?.reduce((acc, t) => acc + (t.duration_seconds || 0), 0) || 0
  const totalStudyHours = (totalStudySecs / 3600).toFixed(1)

  // Fetch Grades Average
  const { data: gradesData } = await supabase
    .from('grades')
    .select('marks, max_marks')
    .eq('profile_id', profile?.id)

  let gradesScore = 0
  let gradesMax = 0
  gradesData?.forEach(g => {
    gradesScore += Number(g.marks)
    gradesMax += Number(g.max_marks)
  })
  const overallGradePct = gradesMax > 0 ? Math.round((gradesScore / gradesMax) * 100) : null

  // Derived stats
  const totalPresent = attendanceData?.reduce((s, r) => s + (r.total_present ?? 0), 0) ?? 0
  const totalAbsent = attendanceData?.reduce((s, r) => s + (r.total_absent ?? 0), 0) ?? 0
  const overallPct =
    totalPresent + totalAbsent > 0
      ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
      : null

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

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <span className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Subjects</CardTitle>
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{subjectsData?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">active this semester</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <span className="flex items-center space-x-2">
                <CircleCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Classes Attended</CardTitle>
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{totalPresent}</p>
              <p className="text-xs text-muted-foreground mt-1">out of {totalPresent + totalAbsent} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <span className="flex items-center space-x-2">
                <ChartColumn className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Attendance</CardTitle>
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">
                {overallPct !== null ? <span className="gradient-accent-text">{overallPct}%</span> : '—'}
              </p>
              {overallPct !== null && (
                <div className="w-full bg-muted h-1.5 rounded-full mt-2">
                  <div className="gradient-accent-bar h-1.5 rounded-full transition-all" style={{width: `${overallPct}%`}} />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">across all subjects</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <span className="flex items-center space-x-2">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Tasks</CardTitle>
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{pendingTasksCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">waiting to be done</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <span className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Study Time</CardTitle>
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{totalStudyHours}h</p>
              <p className="text-xs text-muted-foreground mt-1">all time recorded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <span className="flex items-center space-x-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Grades</CardTitle>
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{overallGradePct !== null ? `${overallGradePct}%` : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">cumulative average</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-subject attendance */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full gradient-accent animate-pulse"/>
                Today's Attendance
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Mark your presence for {format(new Date(), "EEEE, MMMM do")}
              </p>
            </div>
          </div>

          <div className="pt-4">
            <InteractiveAttendanceGrid 
              initialData={attendanceData || []} 
              subjectsInfo={subjectsData || []} 
              token={session.user.supabaseToken}
              profileId={profile?.id}
            />
          </div>
        </section>

        {/* Subject list */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Your Subjects</h2>
          <SubjectList subjects={subjectsData ?? []} />
        </section>

      </main>
    </div>
  )
}

