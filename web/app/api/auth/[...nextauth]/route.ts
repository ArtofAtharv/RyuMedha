// app/api/auth/[...nextauth]/route.ts
// NextAuth v4 — WhatsApp OTP CredentialsProvider
// Sensitive verification delegated to the Supabase edge function

import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const VERIFY_EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth?action=verify`

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'whatsapp-otp',
      name: 'WhatsApp OTP',
      credentials: {
        phone_number: { label: 'Phone Number', type: 'text' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const { phone_number, otp } = credentials ?? {}

          if (!phone_number || !otp) {
            throw new Error('Phone number and OTP are required')
          }

          // Guard against missing env var (fail fast with clear message)
          if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            throw new Error('Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL is not set')
          }

          // Normalize phone number (remove spaces) to match what request-otp does
          const cleanPhone = phone_number.replace(/\s/g, '')

          // Delegate verification to the Supabase edge function
          // (SERVICE_ROLE_KEY and JWT_SECRET live only in the edge runtime)
          const res = await fetch(VERIFY_EDGE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
            body: JSON.stringify({ phone_number: cleanPhone, otp }),
          })

          const text = await res.text()
          console.log('[NextAuth] Edge Function Status:', res.status)
          console.log('[NextAuth] Edge Function Response:', text)

          let data
          try {
            data = JSON.parse(text)
          } catch {
            throw new Error(`Edge Function returned invalid JSON: ${text.substring(0, 200)}`)
          }

          if (!res.ok || !data.success) {
            console.error('[NextAuth] Verification failed:', data)
            throw new Error(data.error ?? 'Verification failed')
          }

          return {
            id: data.profile.id,
            name: data.profile.display_name,
            email: data.profile.email ?? null,
            phone: phone_number,
            supabaseToken: data.token,
          }
        } catch (err: any) {
          // Re-throw so the message is preserved in result.error on the client
          // Without this, NextAuth turns ANY exception into error=Configuration
          throw new Error(err.message ?? 'Authentication failed')
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = user.phone
        token.supabaseToken = user.supabaseToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.phone = token.phone
        session.user.supabaseToken = token.supabaseToken
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
