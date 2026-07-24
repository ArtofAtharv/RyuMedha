import { useState, useEffect } from 'react'
import { getAppClient } from '@/lib/supabase-client'
import { type Session } from '@supabase/supabase-js'

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getAppClient()

  useEffect(() => {
    // Robust cookie parser helper
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const cookies = document.cookie.split(';')
      for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim()
        if (c.startsWith(`${name}=`)) {
          return decodeURIComponent(c.substring(name.length + 1))
        }
      }
      return null
    }

    async function syncSession() {
      const accessToken = getCookie('sb-access-token')
      const refreshToken = getCookie('sb-refresh-token')

      let activeSession: Session | null = null
      try {
        const { data } = await supabase.auth.getSession()
        activeSession = data?.session || null
      } catch (err) {
        console.error('useSupabaseSession: getSession exception', err)
      }

      if (!activeSession && refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken || '',
            refresh_token: refreshToken
          })
          if (!error && data?.session) {
            activeSession = data.session
          } else {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: refreshToken
            })
            if (!refreshError && refreshData?.session) {
              activeSession = refreshData.session
            }
          }
        } catch (err) {
          console.error('useSupabaseSession: refresh exception', err)
        }

        if (!activeSession) {
          // Clear stale cookies only after failed refresh attempt
          document.cookie = 'sb-access-token=; path=/; max-age=0; samesite=lax'
          document.cookie = 'sb-refresh-token=; path=/; max-age=0; samesite=lax'
          const cookies = document.cookie.split(';')
          for (let i = 0; i < cookies.length; i++) {
            const c = cookies[i].trim()
            if (c.startsWith('sb-') && c.endsWith('-auth-token')) {
              const name = c.split('=')[0]
              document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
            }
          }
        }
      }

      setSession(activeSession)
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
  }, [supabase.auth])

  return { session, loading, isAuthenticated: !!session }
}
