import { useState, useEffect } from 'react'
import { getAppClient } from '@/lib/supabase-client'

export function useSupabaseSession() {
  const [session, setSession] = useState<any>(null)
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

      console.log('useSupabaseSession: checking cookies', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken 
      })

      // Get standard active session
      const { data: { session: activeSession } } = await supabase.auth.getSession()

      console.log('useSupabaseSession: active session from client SDK', {
        hasSession: !!activeSession
      })

      if (!activeSession && accessToken && refreshToken) {
        console.log('useSupabaseSession: setting session on client using server cookies')
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        if (!error && data.session) {
          console.log('useSupabaseSession: session sync successful')
          setSession(data.session)
        } else if (error) {
          console.error('useSupabaseSession: session sync error', error)
        }
      } else {
        setSession(activeSession)
      }
      setLoading(false)
    }

    syncSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      console.log('useSupabaseSession: auth state change triggered', {
        event: _event,
        hasSession: !!activeSession
      })
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
