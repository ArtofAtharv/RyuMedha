// proxy.ts — all route-guard logic lives here
// middleware.ts re-exports this so Next.js picks it up

import { NextRequest, NextResponse } from 'next/server'

export default async function proxy(req: NextRequest) {
  const hasAccessToken = req.cookies.has('sb-access-token')
  const refreshToken = req.cookies.get('sb-refresh-token')?.value
  const { pathname } = req.nextUrl

  let isLoggedIn = hasAccessToken
  let newAccessToken: string | null = null
  let newRefreshToken: string | null = null
  let expiresIn = 3600

  // If access token is expired/missing but refresh token exists, attempt to refresh session
  if (!hasAccessToken && refreshToken) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      )

      if (res.ok) {
        const data = await res.json()
        newAccessToken = data.access_token
        newRefreshToken = data.refresh_token
        expiresIn = data.expires_in || 3600
        isLoggedIn = true
      } else {
        console.error('Middleware token refresh failed:', await res.text())
        // Clear cookies and force redirect to login if refresh token is invalid
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        const response = NextResponse.redirect(loginUrl)
        response.cookies.delete('sb-access-token')
        response.cookies.delete('sb-refresh-token')
        return response
      }
    } catch (err) {
      console.error('Middleware token refresh error:', err)
    }
  }

  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/profile')

  // Redirect unauthenticated users away from protected routes
  if (!isLoggedIn && isProtected) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')
    return response
  }

  // Redirect logged-in users away from /login
  if (isLoggedIn && pathname === '/login') {
    const response = NextResponse.redirect(new URL('/dashboard', req.url))
    if (newAccessToken && newRefreshToken) {
      response.cookies.set('sb-access-token', newAccessToken, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expiresIn,
      })
      response.cookies.set('sb-refresh-token', newRefreshToken, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
    return response
  }

  const response = NextResponse.next()
  if (newAccessToken && newRefreshToken) {
    response.cookies.set('sb-access-token', newAccessToken, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
    })
    response.cookies.set('sb-refresh-token', newRefreshToken, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    // Set cookies on request object so server components in the current request read the refreshed token
    req.cookies.set('sb-access-token', newAccessToken)
    req.cookies.set('sb-refresh-token', newRefreshToken)
  }
  return response
}

export const config = {
  // Exclude API auth routes, Next.js internals, and static assets
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json).*)'],
}
