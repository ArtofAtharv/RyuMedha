// proxy.ts — all route-guard logic lives here
// middleware.ts re-exports this so Next.js picks it up

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isLoggedIn = !!token
  const { pathname } = req.nextUrl

  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/profile')

  // Redirect unauthenticated users away from protected routes
  if (!isLoggedIn && isProtected) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect logged-in users away from /login
  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Exclude API auth routes, Next.js internals, and static assets
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json).*)'],
}
