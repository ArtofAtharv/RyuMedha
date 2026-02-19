// app/api/auth/[...nextauth]/route.ts
// Next Auth configuration with WhatsApp OTP provider

import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'whatsapp-otp',
      name: 'WhatsApp OTP',
      credentials: {
        whatsappNumber: { label: 'WhatsApp Number', type: 'text' },
        otp: { label: 'OTP', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.whatsappNumber || !credentials?.otp) {
          throw new Error('Phone number and OTP required')
        }

        const { whatsappNumber, otp } = credentials

        // Verify OTP
        const { data: otpRecord, error: otpError } = await supabase
          .from('otp_codes')
          .select('*')
          .eq('whatsapp_number', whatsappNumber)
          .eq('code', otp)
          .eq('used', false)
          .single()

        if (otpError || !otpRecord) {
          throw new Error('Invalid OTP')
        }

        // Check if expired
        const now = new Date()
        const expiresAt = new Date(otpRecord.expires_at)
        
        if (now > expiresAt) {
          throw new Error('OTP expired. Please request a new one.')
        }

        // Mark OTP as used
        await supabase
          .from('otp_codes')
          .update({ used: true })
          .eq('whatsapp_number', whatsappNumber)

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('whatsapp_number', whatsappNumber)
          .single()

        if (profileError || !profile) {
          throw new Error('User not found')
        }

        // Return user object for session
        return {
          id: profile.id,
          name: profile.display_name,
          email: profile.email,
          phone: profile.whatsapp_number,
          image: null
        }
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = user.phone
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.phone = token.phone as string
      }
      return session
    }
  },
  
  pages: {
    signIn: '/login',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
