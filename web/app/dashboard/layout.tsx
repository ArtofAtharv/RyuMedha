import { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { createClient } from "@supabase/supabase-js"
import { ProfileProvider, UserProfile } from "@/components/dashboard/profile-context"
import { GamificationProvider } from "@/components/dashboard/gamification-context"

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("sb-access-token")?.value

  if (!accessToken) {
    redirect("/login")
  }

  // Create server-side authenticated Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )

  // Fetch the user's profile on the server (RLS automatically scopes to their auth.uid())
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .single()

  if (error || !profile) {
    console.error("DashboardLayout profile fetch error:", error)
    redirect("/login")
  }

  if (!profile.display_name || profile.display_name.trim() === '') {
    redirect('/setup')
  }

  return (
    <ProfileProvider profile={profile as UserProfile}>
      <GamificationProvider>
        <div className="flex flex-col min-h-screen bg-background text-foreground">
          {/* Animated Dashboard Navigation */}
          <DashboardNav />

          {/* Main Content Area */}
          <div className="flex-1 pb-24">
            {children}
          </div>
        </div>
      </GamificationProvider>
    </ProfileProvider>
  )
}
