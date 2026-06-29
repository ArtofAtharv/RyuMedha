import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { SubjectDetailContent } from "./subject-detail-content"

export default async function SubjectDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
  )

  // 1. Fetch Subject Details
  const { data: subject, error: subError } = await supabase
    .from('subjects')
    .select('*, source_course_id(*)')
    .eq('id', id)
    .single()

  if (subError || !subject) {
    redirect("/dashboard")
  }

  // 2. Fetch Attendance Logs for this subject
  const { data: attendanceLogs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('subject_id', id)
    .order('lecture_date', { ascending: true })

  // 3. Fetch Profile for context
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', session.user.phone)
    .single()

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <SubjectDetailContent 
          subject={subject} 
          attendanceLogs={attendanceLogs || []} 
          profile={profile}
          token={session.user.supabaseToken}
        />
      </main>
    </div>
  )
}
