// app/dashboard/page.tsx — protected server component (session via proxy.ts)

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { SubjectList } from '@/components/dashboard/subject-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, CheckCircle2, BarChart3 } from 'lucide-react'

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
    .select('display_name')
    .eq('whatsapp_number', session.user.phone)
    .single()

  const displayName = profile?.display_name || session.user.name || session.user.phone

  // Fetch Attendance Summary
  const { data: attendanceData } = await supabase
    .from('attendance_summary')
    .select('*')
    .order('attendance_percentage', { ascending: true })

  // Fetch Active Subjects
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('name')

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
            Welcome back, {displayName}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">📱 {session.user.phone}</p>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{subjectsData?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">active this semester</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Classes Attended</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{totalPresent}</p>
              <p className="text-xs text-muted-foreground mt-1">out of {totalPresent + totalAbsent} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Attendance</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">
                {overallPct !== null ? `${overallPct}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">across all subjects</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-subject attendance */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Attendance by Subject</h2>
          {attendanceData && attendanceData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attendanceData.map((item: any) => (
                <AttendanceCard
                  key={item.subject_id}
                  subjectName={item.subject_name}
                  present={item.total_present}
                  absent={item.total_absent}
                  percentage={item.attendance_percentage}
                  accentColor={subjectsData?.find((s: any) => s.id === item.subject_id)?.color_hex ?? undefined}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <p>No attendance logged yet.</p>
                <p className="text-xs mt-1">Mark attendance via the WhatsApp bot to see stats here.</p>
              </CardContent>
            </Card>
          )}
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

