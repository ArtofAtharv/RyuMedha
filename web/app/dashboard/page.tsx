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
    .select('id, name, color_hex, type, is_active, legacy_attended_lectures, legacy_missed_lectures, category_id, label, instructor_name')
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

  // Fetch Pending Tasks Count by Type
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('id, subject_id, subjects(type)')
    .eq('profile_id', profile?.id)
    .eq('is_completed', false)

  let academicPendingTasks = 0
  let personalPendingTasks = 0
  pendingTasks?.forEach(t => {
    // @ts-ignore
    const type = t.subjects?.type
    if (type === 'academic') academicPendingTasks++
    else if (type === 'personal') personalPendingTasks++
    // Uncategorized tasks aren't explicitly tracked in either bucket right now to maintain strict track isolation.
  })

  // Fetch Study Timers by Type
  const { data: timersData } = await supabase
    .from('study_timers')
    .select('duration_seconds, subject_id, subjects(type)')
    .eq('profile_id', profile?.id)
    .not('ended_at', 'is', null)

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

  // Split Grades
  const { data: gradesData } = await supabase
    .from('grades')
    .select('marks, max_marks, subject_id, subjects!inner(type)')
    .eq('profile_id', profile?.id)

  let academicScore = 0
  let academicMax = 0
  let personalScore = 0
  let personalMax = 0

  gradesData?.forEach(g => {
    // @ts-ignore - Supabase type inference on joins can be spotty
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

  // Derived attendance stats
  const totalPresent = attendanceData?.reduce((s, r) => s + (r.total_present ?? 0), 0) ?? 0
  const totalAbsent = attendanceData?.reduce((s, r) => s + (r.total_absent ?? 0), 0) ?? 0
  const overallAttendancePct = totalPresent + totalAbsent > 0
    ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
    : null

  // Split Subjects
  const academicSubjects = subjectsData?.filter(s => s.type === 'academic') || []
  const personalSubjects = subjectsData?.filter(s => s.type === 'personal') || []

  // Fetch Categories for Personal Subjects
  const { data: categoriesData } = await supabase
    .from('subject_categories')
    .select('*')
    .eq('profile_id', profile?.id)
  
  const categories = categoriesData || []

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

        {/* ─── ACADEMIC OVERVIEW ─── */}
        <section className="space-y-6 pt-2">
          <div className="flex items-center gap-3 border-b pb-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Academic Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <ChartColumn className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">
                  {overallAttendancePct !== null ? <span className="gradient-accent-text">{overallAttendancePct}%</span> : '—'}
                </p>
                {overallAttendancePct !== null && (
                  <div className="w-full bg-muted h-1.5 rounded-full mt-2">
                    <div className="gradient-accent-bar h-1.5 rounded-full transition-all" style={{width: `${overallAttendancePct}%`}} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{totalPresent} out of {totalPresent + totalAbsent} classes present</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Grades</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{academicGradePct !== null ? `${academicGradePct}%` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">cumulative average</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{academicPendingTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">academic to-dos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{academicStudyHours}h</p>
                <p className="text-xs text-muted-foreground mt-1">invested</p>
              </CardContent>
            </Card>
          </div>

          {/* Today's Attendance Widget */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full gradient-accent animate-pulse"/>
                  Today's Attendance
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mark your presence for {format(new Date(), "EEEE, MMMM do")}
                </p>
              </div>
            </div>
            <InteractiveAttendanceGrid 
              initialData={attendanceData || []} 
              subjectsInfo={academicSubjects} 
              token={session.user.supabaseToken}
              profileId={profile?.id}
            />
          </div>

          <div className="pt-2">
            {/* The old generic SubjectList was removed from the Academic section as Attendance Grid provides the cards already */}
          </div>
        </section>

        {/* ─── PERSONAL OVERVIEW ─── */}
        <section className="space-y-6 pt-6">
          <div className="flex items-center gap-3 border-b pb-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Personal Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Score</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalScorePct !== null ? `${personalScorePct}%` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">skill points</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalPendingTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">personal to-dos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalStudyHours}h</p>
                <p className="text-xs text-muted-foreground mt-1">invested</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Focus Areas</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalSubjects.length}</p>
                <p className="text-xs text-muted-foreground mt-1">active tracks</p>
              </CardContent>
            </Card>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalSubjects.map(sub => {
                const subCategory = categories.find(c => c.id === sub.category_id)
                return (
                  <SubjectGridCard 
                    key={sub.id} 
                    subject={{...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex}} 
                    category={subCategory}
                  />
                )
              })}
            </div>
            {personalSubjects.length === 0 && (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/30">
                <p className="text-muted-foreground text-sm font-medium">No personal learning tracks defined yet.</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}

