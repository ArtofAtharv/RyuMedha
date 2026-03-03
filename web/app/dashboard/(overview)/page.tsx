// app/dashboard/page.tsx — protected server component (session via proxy.ts)

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { ProfileProvider, UserProfile } from '@/components/dashboard/profile-context'
import { OverviewContent } from "./overview-content"

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

  // Fetch fresh profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', session.user.phone)
    .single()

  if (!profile?.display_name) {
    redirect('/setup')
  }

  const displayName = profile.display_name
  const fullProfile = profile as unknown as UserProfile

  // Fetch all dashboard data concurrently
  const [
    { data: rawSubjectsData },
    { data: attendanceLogs },
    { data: pendingTasks },
    { data: timersData },
    { data: gradesData },
    { data: categoriesData }
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, color_hex, type, is_active, label, expected_total_lectures, legacy_attended_lectures, legacy_missed_lectures, category_id, source_course_id(*)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('attendance_logs')
      .select('subject_id, status')
      .eq('profile_id', profile?.id)
      .in('status', ['present', 'absent', 'deemed']),
    supabase
      .from('tasks')
      .select('id, subject_id, subjects(type)')
      .eq('profile_id', profile?.id)
      .eq('is_completed', false),
    supabase
      .from('study_timers')
      .select('started_at, ended_at, total_pause_seconds, timer_type, subject_id, subjects(type)')
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

  // Filter subjects by the current academic hierarchy (Semester)
  const subjectsData = rawSubjectsData?.filter((s: any) => {
    if (s.type === 'personal') return true
    
    // Access semester_id from joined source_course_id (handling potential array from Supabase join types)
    const semesterId = Array.isArray(s.source_course_id) 
      ? s.source_course_id[0]?.semester_id 
      : (s.source_course_id as any)?.semester_id

    // If academic, it MUST belong to the current semester
    return semesterId === profile?.current_semester_id
  }) || []

  const categories = categoriesData || []
  const hasSubjects = (subjectsData.length || 0) > 0

  if (!hasSubjects) {
    return (
      <ProfileProvider profile={fullProfile}>
        <div className="min-h-screen bg-background text-foreground pb-20">
          <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
            <div className="flex items-center justify-between space-y-2">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Namaste, <span className="gradient-accent-text">{displayName}</span>
              </h2>
            </div>
            
            <Card className="border-dashed border-2 bg-muted/20 border-primary/20 rounded-3xl overflow-hidden backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center animate-pulse shadow-inner shadow-primary/5">
                    <PlusCircle className="w-12 h-12 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full animate-ping opacity-20" />
                </div>
                <div className="space-y-3 max-w-sm">
                  <CardTitle className="text-3xl font-black tracking-tight">Your journey starts here</CardTitle>
                  <CardDescription className="text-base text-muted-foreground/80 leading-relaxed font-medium">
                    You haven't added any subjects yet. Add your first subject to start tracking your attendance, tasks, and progress!
                  </CardDescription>
                </div>
                <Link href="/dashboard/subjects">
                  <Button size="lg" className="font-bold h-14 px-10 text-lg rounded-2xl gradient-accent shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                    <PlusCircle className="mr-2 h-6 w-6" /> Add First Subject
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground/60 font-medium italic">
                  Tip: Use the bot or Subjects tab to populate your dashboard.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </ProfileProvider>
    )
  }

  // Derived calculations (moved from original code)
  const targetPct = profile?.target_attendance_pct || 75
  const attendanceData = subjectsData?.filter(s => s.type === 'academic').map(sub => {
    const subjectLogs = attendanceLogs?.filter(log => log.subject_id === sub.id) || []
    const logPresent = subjectLogs.filter(log => log.status === 'present').length
    const logAbsent = subjectLogs.filter(log => log.status === 'absent').length
    const logDeemed = subjectLogs.filter(log => log.status === 'deemed').length

    return {
      subject_id: sub.id,
      subject_name: sub.name,
      total_present: logPresent + (sub.legacy_attended_lectures || 0),
      total_absent: logAbsent + (sub.legacy_missed_lectures || 0),
      total_deemed: logDeemed,
      attendance_percentage: 0 // Will be calculated by InteractiveAttendanceGrid
    }
  }) || []

  let academicPendingTasks = 0
  let personalPendingTasks = 0
  pendingTasks?.forEach(t => {
    // @ts-ignore
    const type = t.subjects?.type
    if (type === 'academic') academicPendingTasks++
    else if (type === 'personal') personalPendingTasks++
  })

  let academicStudySecs = 0
  let personalStudySecs = 0
  timersData?.forEach(t => {
    // @ts-ignore
    const type = t.subjects?.type
    
    // Manual JS-based calculation: (End - Start) - Pause
    const start = new Date(t.started_at).getTime()
    const end = new Date(t.ended_at).getTime()
    const grossSecs = Math.floor((end - start) / 1000)
    const netSecs = Math.max(0, grossSecs - (t.total_pause_seconds || 0))

    if (type === 'academic') academicStudySecs += netSecs
    else if (type === 'personal') personalStudySecs += netSecs
  })

  const formatStudyTime = (secs: number) => {
    if (secs === 0) return null
    const hours = Math.floor(secs / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return null
  }

  const academicStudyTimeFormatted = formatStudyTime(academicStudySecs)
  const personalStudyTimeFormatted = formatStudyTime(personalStudySecs)

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

  const totalPresent = attendanceData?.reduce((s, r) => s + (r.total_present ?? 0), 0) ?? 0
  const totalAbsent = attendanceData?.reduce((s, r) => s + (r.total_absent ?? 0), 0) ?? 0
  const totalDeemed = attendanceData?.reduce((s, r) => s + (r.total_deemed ?? 0), 0) ?? 0
  const overallAttendancePct = totalPresent + totalAbsent + totalDeemed > 0
    ? Math.round(((totalPresent + totalDeemed) / (totalPresent + totalAbsent + totalDeemed)) * 100)
    : null

  const academicSubjects = subjectsData?.filter(s => s.type === 'academic') || []
  const personalSubjects = subjectsData?.filter(s => s.type === 'personal') || []

  return (
    <ProfileProvider profile={fullProfile}>
      <div className="min-h-screen bg-background text-foreground pb-20">
        <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          <OverviewContent 
            profile={profile as unknown as UserProfile}
            academicOverviewData={{
              overallAttendancePct,
              totalPresent,
              totalAbsent,
              totalDeemed,
              academicGradePct,
              academicPendingTasks,
              academicStudyTimeFormatted,
              attendanceData,
              academicSubjects,
              timersSessionData: timersData?.filter(t => (t.subjects as any)?.type === 'academic') || [],
              token: session.user.supabaseToken,
              profileId: profile?.id,
              targetPct
            }}
            personalOverviewData={{
              personalScorePct,
              personalPendingTasks,
              personalStudyTimeFormatted,
              personalSubjects,
              timersSessionData: timersData?.filter(t => (t.subjects as any)?.type === 'personal') || [],
              categories
            }}
          />
        </main>
      </div>
    </ProfileProvider>
  )
}
