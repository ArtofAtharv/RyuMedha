import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Razorpay from 'razorpay'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 })
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

    const { planType } = await req.json() // 'monthly' | 'yearly'

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ 
        error: 'Razorpay API credentials missing. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' 
      }, { status: 500 })
    }

    const monthlyPlanId = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_MONTHLY || 'plan_monthly_39'
    const yearlyPlanId = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_YEARLY || 'plan_yearly_399'

    const planId = planType === 'yearly' ? yearlyPlanId : monthlyPlanId

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    })

    // Check if user has an active free trial to defer start_at
    const { data: userSub } = await supabase
      .from('subscriptions')
      .select('status, trial_end')
      .eq('profile_id', profile.id)
      .single()

    const subPayload: Record<string, unknown> = {
      plan_id: planId,
      total_count: planType === 'yearly' ? 10 : 120, // number of billing cycles
      quantity: 1,
      customer_notify: 1,
      notes: {
        profile_id: profile.id,
        plan_type: planType
      }
    }

    if (userSub?.status === 'trialing' && userSub.trial_end && new Date(userSub.trial_end) > new Date()) {
      const trialEndTime = Math.floor(new Date(userSub.trial_end).getTime() / 1000)
      subPayload.start_at = trialEndTime
    }

    // Create Subscription on Razorpay
    const subscription = await razorpay.subscriptions.create(subPayload as any)

    return NextResponse.json({
      subscription_id: subscription.id,
      key_id: keyId,
      plan_type: planType
    })
  } catch (err: unknown) {
    console.error('Error creating Razorpay subscription:', err)
    const message = err instanceof Error ? err.message : 'Failed to create subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
