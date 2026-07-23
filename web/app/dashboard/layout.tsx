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
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      },
    }
  )

  // Fetch the user's profile on the server with retries to handle database cold starts/transient connection errors
  let profile = null
  let error = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await supabase
        .from('profiles')
        .select('*')
        .single()
      
      profile = res.data
      error = res.error

      // If we got a profile, or it's a known PGRST116 (profile doesn't exist, setup needed), stop retrying
      if (profile || (error && error.code === 'PGRST116')) {
        break
      }

      console.warn(`DashboardLayout: Profile fetch attempt ${attempt} failed:`, error)
    } catch (err: any) {
      console.warn(`DashboardLayout: Profile fetch attempt ${attempt} threw exception:`, err)
      error = err
    }

    if (attempt < 3) {
      // Delay before next attempt (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 300 * attempt))
    }
  }

  if (error || !profile) {
    console.error("DashboardLayout profile fetch error details:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      errorObj: error
    })
    
    if (error && error.code === 'PGRST116') {
      redirect("/setup")
    }
    
    // Fallback: if it's a connection error, redirect to login or show error.
    // But redirect to setup is the default fallback.
    redirect("/setup")
  }

  // Check if account setup is complete
  const isSetup = (profile.academics_enabled !== null || profile.personal_enabled !== null) && 
                  (!profile.academics_enabled || !!profile.current_semester_id);

  if (!isSetup) {
    redirect('/setup')
  }

  return (
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
  )
}
