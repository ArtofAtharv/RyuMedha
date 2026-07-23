import { createServerClient } from '@supabase/ssr'
import { createClient, type Session } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function processProfileUpdate(session: Session) {
  const providerToken = session.provider_token
  const providerRefreshToken = session.provider_refresh_token

  // Save Google credentials to the user's profile and ensure the profile row exists
  const authenticatedSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      },
    }
  )

  // Fetch existing profile to preserve display name and other settings if present
  const { data: existingProfile } = await authenticatedSupabase
    .from('profiles')
    .select('display_name')
    .eq('id', session.user.id)
    .maybeSingle()

  const updates: Record<string, unknown> = {
    id: session.user.id,
    email: session.user.email,
    display_name: existingProfile?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
  }

  if (!existingProfile) {
    updates.academics_enabled = null
    updates.personal_enabled = null
  }

  if (providerToken) {
    updates.google_access_token = providerToken
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${providerToken}`)
      .then(r => r.json())
      .catch(() => null)
    updates.google_token_expiry = info?.expires_in
      ? Math.floor(Date.now() / 1000) + Number(info.expires_in)
      : Math.floor(Date.now() / 1000) + 3500
  }
  if (providerRefreshToken) updates.google_refresh_token = providerRefreshToken

  await authenticatedSupabase
    .from('profiles')
    .upsert(updates)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const response = NextResponse.redirect(new URL(next, request.url))
    
    // Create Supabase client with SSR to automatically save standard session cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, { ...options, httpOnly: false })
              )
            } catch (error) {
              console.error('Failed to set cookies:', error)
            }
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      
      // Store Supabase session tokens in cookies for server components (made readable to client hook)
      response.cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in,
      })
      response.cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })

      await processProfileUpdate(data.session)

      return response
    } else {
      console.error('Session exchange error:', error)
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
