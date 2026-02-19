// app/api/auth/verify-otp/route.ts
// Thin proxy — forwards to the consolidated auth edge function

import { NextRequest, NextResponse } from 'next/server'

const EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth?action=verify`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Use ANON KEY — the function verifies JWT generation logic internally
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('verify-otp proxy error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
