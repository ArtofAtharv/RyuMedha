import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

import { sendPaymentConfirmationEmail } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )

    const { data: profile } = await supabase.from('profiles').select('id, display_name, email').single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, planType } = body

    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (keySecret && razorpay_signature) {
      // HMAC SHA256 signature verification: payment_id + "|" + subscription_id
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
        .digest('hex')

      if (expectedSignature !== razorpay_signature) {
        return NextResponse.json({ error: 'Invalid Razorpay signature verification failed' }, { status: 400 })
      }
    }

    // Fetch existing subscription to preserve free 1-year or trial period end date if active
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('current_period_end, trial_end, status')
      .eq('profile_id', profile.id)
      .maybeSingle()

    const now = new Date()
    let periodEnd: Date

    if (existingSub?.current_period_end && new Date(existingSub.current_period_end) > now) {
      periodEnd = new Date(existingSub.current_period_end)
    } else if (existingSub?.status === 'trialing' && existingSub.trial_end && new Date(existingSub.trial_end) > now) {
      periodEnd = new Date(existingSub.trial_end)
    } else {
      periodEnd = new Date(now)
      if (planType === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      }
    }

    // Upsert subscription state to active
    const { error: subErr } = await supabase.from('subscriptions').upsert({
      profile_id: profile.id,
      status: 'active',
      plan_type: planType || 'monthly',
      razorpay_subscription_id: razorpay_subscription_id,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      scheduled_deletion_at: null
    }, { onConflict: 'profile_id' })

    if (subErr) {
      console.error('Error updating subscription in DB:', subErr)
      return NextResponse.json({ error: 'Failed to update subscription status' }, { status: 500 })
    }

    // Send payment confirmation email from ryumedha@gmail.com
    if (profile.email) {
      await sendPaymentConfirmationEmail({
        to: profile.email,
        displayName: profile.display_name,
        planType: planType === 'yearly' ? 'yearly' : 'monthly',
        razorpaySubId: razorpay_subscription_id,
        periodEnd: periodEnd.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
      })
    }

    return NextResponse.json({ success: true, status: 'active', periodEnd: periodEnd.toISOString() })
  } catch (err: unknown) {
    console.error('Error verifying subscription:', err)
    const message = err instanceof Error ? err.message : 'Subscription verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
