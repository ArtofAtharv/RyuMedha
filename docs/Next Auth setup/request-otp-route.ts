// app/api/auth/request-otp/route.ts
// API route to request OTP via Supabase Edge Function

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { whatsappNumber } = await request.json()

    // Validate phone number format
    if (!whatsappNumber || typeof whatsappNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Ensure it starts with +
    if (!whatsappNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must include country code (e.g., +919876543210)' },
        { status: 400 }
      )
    }

    // Call Supabase Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-whatsapp-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ whatsappNumber })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to send OTP' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your WhatsApp',
      expiresIn: data.expiresIn
    })

  } catch (error) {
    console.error('Request OTP error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
