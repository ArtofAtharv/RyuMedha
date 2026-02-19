// app/dashboard/page.tsx — protected server component (session via proxy.ts)

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeSelector } from '@/components/theme-selector'

import { createClient } from '@supabase/supabase-js'

import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { SubjectList } from '@/components/dashboard/subject-list'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Fetch fresh profile & data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${session.user.supabaseToken}`,
        },
      },
    }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('whatsapp_number', session.user.phone)
    .single()

  const displayName = profile?.display_name || session.user.name || session.user.phone

  // Fetch Attendance Stats
  const { data: attendanceData } = await supabase
    .from('attendance_summary')
    .select('*')
    .order('attendance_percentage', { ascending: true })

  // Fetch Subjects
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-sm shadow-sm">
            R
          </div>
          <span className="font-bold tracking-tight">Ryu Medha</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="space-y-1">
           <h1 className="text-3xl font-black tracking-tight">
            Welcome back, {displayName}!
          </h1>
          <p className="text-muted-foreground text-sm">📱 {session.user?.phone}</p>
        </div>

        {/* Attendance Grid */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Attendance Overview</h2>
          {attendanceData && attendanceData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attendanceData.map((item: any) => (
                <AttendanceCard
                  key={item.subject_id}
                  subjectName={item.subject_name}
                  present={item.total_present}
                  absent={item.total_absent}
                  percentage={item.attendance_percentage}
                  colorHex={subjectsData?.find((s: any) => s.id === item.subject_id)?.color_hex}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/30">
              <p>No attendance data recorded yet.</p>
              <p className="text-sm mt-1">Mark attendance via the WhatsApp bot to see stats here.</p>
            </div>
          )}
        </section>

        {/* Subjects List */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Active Subjects</h2>
          <SubjectList subjects={subjectsData || []} />
        </section>
      </main>
    </div>
  )
}
