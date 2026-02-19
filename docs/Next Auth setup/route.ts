// app/api/auth/verify-otp/route.ts

import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_VERIFY_ATTEMPTS = 5 // lock out after 5 wrong OTPs

export async function POST(req: Request) {
  try {
    const { phone_number, otp } = await req.json()

    if (!phone_number || !otp) {
      return NextResponse.json(
        { error: 'phone_number and otp are required' },
        { status: 400 }
      )
    }

    // Fetch OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('whatsapp_number', phone_number)
      .single()

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { error: 'No OTP found. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if locked out from too many wrong attempts
    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new OTP.' },
        { status: 429 }
      )
    }

    // Check if already used
    if (otpRecord.used) {
      return NextResponse.json(
        { error: 'OTP already used. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if OTP is correct — increment attempts if wrong
    if (otpRecord.code !== otp) {
      await supabase
        .from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('whatsapp_number', phone_number)

      const remaining = MAX_VERIFY_ATTEMPTS - (otpRecord.attempts + 1)
      return NextResponse.json(
        { error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      )
    }

    // ✅ OTP is correct — mark as used
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('whatsapp_number', phone_number)

    // Generate JWT — same format as bot, so RLS works on web and bot identically
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
    const token = await new SignJWT({
      sub: phone_number,
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)

    return NextResponse.json({
      success: true,
      token,
      phone_number
    })

  } catch (err) {
    console.error('verify-otp error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
