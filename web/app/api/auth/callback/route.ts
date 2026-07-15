import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    
    // Create Supabase client with Next.js cookies storage adapter so it can read the PKCE code verifier
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          detectSessionInUrl: false,
          storage: {
            getItem: (key) => cookieStore.get(key)?.value ?? null,
            setItem: (key, value) => {},
            removeItem: (key) => {}
          }
        }
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      const response = NextResponse.redirect(new URL(next, request.url))
      
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

      // Extract Google provider tokens
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token
      const expiresAt = data.session.expires_at // unix timestamp

      // Save Google credentials to the user's profile and ensure the profile row exists
      const authenticatedSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
          },
        }
      )

      // Fetch existing profile to preserve display name and other settings if present
      const { data: existingProfile } = await authenticatedSupabase
        .from('profiles')
        .select('display_name')
        .eq('id', data.session.user.id)
        .maybeSingle()

      const updates: any = {
        id: data.session.user.id,
        email: data.session.user.email,
        display_name: existingProfile?.display_name || data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'User',
      }

      if (!existingProfile) {
        updates.academics_enabled = null
        updates.personal_enabled = null
      }

      if (providerToken) updates.google_access_token = providerToken
      if (providerRefreshToken) updates.google_refresh_token = providerRefreshToken
      if (expiresAt) updates.google_token_expiry = expiresAt

      await authenticatedSupabase
        .from('profiles')
        .upsert(updates)

      return response
    } else {
      console.error('Session exchange error:', error)
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
