// app/api/auth/request-otp/route.ts
// Next.js route: validates phone number, calls Supabase edge function to send OTP

import { NextRequest, NextResponse } from 'next/server'

// Update logic: point to 'auth' function with action=request
const EDGE_FN_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth?action=request`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const phone_number: string | undefined = body?.phone_number

    // Validate
    if (!phone_number || typeof phone_number !== 'string') {
      return NextResponse.json({ error: 'phone_number is required' }, { status: 400 })
    }
    if (!phone_number.startsWith('+')) {
      return NextResponse.json(
        { error: 'Include country code (e.g. +919876543210)' },
        { status: 400 }
      )
    }
    // Basic length check (E.164: 7–15 digits + '+')
    const digits = phone_number.slice(1).replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) {
      return NextResponse.json({ error: 'Invalid phone number length' }, { status: 400 })
    }

    // Normalize for Edge Function
    const cleanPhone = `+${digits}`

    // Call edge function
    // Use ANON KEY — the function itself has service role access internally to write to DB
    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone_number: cleanPhone }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? 'Failed to send OTP' },
        { status: res.status }
      )
    }

    // Surface 'not_registered' status to client
    // Surface 'not_registered' status to client
    if (data?.status === 'not_registered') {
      return NextResponse.json({ 
        not_registered: true,
        error: `This number (${data.searchedFor || cleanPhone}) is not registered. Send "hi" to our WhatsApp bot first.` 
      })
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your WhatsApp',
      expiresIn: data.expiresIn ?? 300,
    })
  } catch (err) {
    console.error('request-otp error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
