import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { SubjectDetailContent } from "./subject-detail-content"

export default async function SubjectDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("sb-access-token")?.value
  if (!accessToken) redirect("/login")

  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
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
    .single()

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <SubjectDetailContent 
          subject={subject} 
          attendanceLogs={attendanceLogs || []} 
          profile={profile}
          token={accessToken}
        />
      </main>
    </div>
  )
}
