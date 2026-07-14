import { useState, useEffect } from 'react'
import { getAppClient } from '@/lib/supabase-client'

export function useSupabaseSession() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getAppClient()

  useEffect(() => {
    // Helper to extract cookies on the client side
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const row = document.cookie
        .split('; ')
        .find((r) => r.startsWith(`${name}=`))
      return row ? decodeURIComponent(row.split('=')[1]) : null
    }

    async function syncSession() {
      const accessToken = getCookie('sb-access-token')
      const refreshToken = getCookie('sb-refresh-token')

      // Get standard active session
      const { data: { session: activeSession } } = await supabase.auth.getSession()

      if (!activeSession && accessToken && refreshToken) {
        // If server cookies exist but client SDK memory is empty, set it on the client
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        if (!error && data.session) {
          setSession(data.session)
        }
      } else {
        setSession(activeSession)
      }
      setLoading(false)
    }

    syncSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession)
      setLoading(false)

      // Sync Supabase session token to browser cookies for Next.js Server Components
      if (activeSession) {
        document.cookie = `sb-access-token=${activeSession.access_token}; path=/; max-age=${activeSession.expires_in}; samesite=lax`
        document.cookie = `sb-refresh-token=${activeSession.refresh_token}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
      } else {
        // Clear cookies on logout
        document.cookie = `sb-access-token=; path=/; max-age=0`
        document.cookie = `sb-refresh-token=; path=/; max-age=0`
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, isAuthenticated: !!session }
}
