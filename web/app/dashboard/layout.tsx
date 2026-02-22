import { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { createClient } from "@supabase/supabase-js"
import { ProfileProvider, UserProfile } from "@/components/dashboard/profile-context"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // Fetch the user's profile on the server
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', session.user.phone)
    .single()

  if (profile && (!profile.display_name || profile.display_name.trim() === '')) {
    redirect('/setup')
  }

  return (
    <ProfileProvider profile={profile as UserProfile}>
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        {/* Animated Dashboard Navigation */}
        <DashboardNav />

        {/* Main Content Area */}
        <div className="flex-1 pb-24 md:pb-0">
          {children}
        </div>
      </div>
    </ProfileProvider>
  )
}
