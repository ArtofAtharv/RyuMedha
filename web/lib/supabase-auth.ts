import { useState, useEffect } from 'react'
import { getAppClient } from '@/lib/supabase-client'

export function useSupabaseSession() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getAppClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession)
      setLoading(false)

      // Sync Supabase session token to browser cookies for Next.js Server Components
      if (activeSession) {
        // Simple client-side cookie helper
        document.cookie = `sb-access-token=${activeSession.access_token}; path=/; max-age=${activeSession.expires_in}; samesite=lax`
        document.cookie = `sb-refresh-token=${activeSession.refresh_token}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
      } else {
        // Clear cookies
        document.cookie = `sb-access-token=; path=/; max-age=0`
        document.cookie = `sb-refresh-token=; path=/; max-age=0`
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, isAuthenticated: !!session }
}
