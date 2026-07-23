import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, httpOnly: false })
          )
        },
      },
    }
  )

  const accessToken = request.cookies.get('sb-access-token')?.value

  let user = null
  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (data?.user && !error) {
      user = data.user
    }
  }

  // Fallback to standard Supabase auth check if token check didn't yield user
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data?.user || null
  }

  // Also sync sb-access-token and sb-refresh-token if an active session exists
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    response.cookies.set('sb-access-token', session.access_token, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.expires_in,
    })
    if (session.refresh_token) {
      response.cookies.set('sb-refresh-token', session.refresh_token, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
    
    // Force all sb-*-auth-token* cookies to be httpOnly: false so the browser can read them.
    // This fixes the issue where they were previously set as httpOnly: true.
    request.cookies.getAll().forEach(cookie => {
      if (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) {
        response.cookies.set(cookie.name, cookie.value, {
          path: '/',
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: session.expires_in,
        })
      }
    })
  }

  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/profile') || pathname.startsWith('/setup')

  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.cookies.delete('sb-access-token')
    redirectResponse.cookies.delete('sb-refresh-token')
    return redirectResponse
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}
