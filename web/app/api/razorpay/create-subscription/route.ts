import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import Razorpay from "razorpay"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("sb-access-token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized: Session missing" }, { status: 401 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    const { data: profile } = await supabase.from("profiles").select("id, display_name, email").single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const { planType } = await req.json() // 'monthly' | 'yearly'

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error: "Razorpay API credentials missing. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        },
        { status: 500 }
      )
    }

    const monthlyPlanId = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_MONTHLY || "plan_monthly_39"
    const yearlyPlanId = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_YEARLY || "plan_yearly_399"

    const planId = planType === "yearly" ? yearlyPlanId : monthlyPlanId

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })

    // Check user's current subscription status and period end
    const { data: userSub } = await supabase
      .from("subscriptions")
      .select("status, trial_end, current_period_end, razorpay_subscription_id")
      .eq("profile_id", profile.id)
      .single()

    const now = new Date()

    // 1. Check for Lifetime Access: Block auto-pay creation as it's unneeded
    const isLifetime =
      userSub?.razorpay_subscription_id === "admin_free_lifetime" ||
      (userSub?.current_period_end && new Date(userSub.current_period_end).getFullYear() > 2090)

    if (isLifetime) {
      return NextResponse.json(
        {
          error: "You currently have Free Lifetime Access! Auto-pay is not required.",
        },
        { status: 400 }
      )
    }

    const subPayload: Record<string, unknown> = {
      plan_id: planId,
      total_count: planType === "yearly" ? 10 : 120, // number of billing cycles
      quantity: 1,
      customer_notify: 1,
      notes: {
        profile_id: profile.id,
        plan_type: planType,
      },
    }

    // 2. Determine if start_at should be deferred (e.g. 1-Year Free Access or Active Free Trial)
    let deferUntil: Date | null = null

    if (userSub?.current_period_end && new Date(userSub.current_period_end) > now) {
      deferUntil = new Date(userSub.current_period_end)
    } else if (userSub?.status === "trialing" && userSub.trial_end && new Date(userSub.trial_end) > now) {
      deferUntil = new Date(userSub.trial_end)
    }

    // Razorpay requires start_at to be at least 15 minutes (900 seconds) in the future
    if (deferUntil && deferUntil.getTime() > now.getTime() + 15 * 60 * 1000) {
      subPayload.start_at = Math.floor(deferUntil.getTime() / 1000)
    }

    // Create Subscription on Razorpay
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await razorpay.subscriptions.create(subPayload as any)

    // Save pending subscription ID to database
    if (subscription?.id) {
      await supabase.from("subscriptions").upsert(
        {
          profile_id: profile.id,
          status: userSub?.status || "trialing",
          plan_type: planType,
          razorpay_subscription_id: subscription.id,
          razorpay_plan_id: planId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          razorpay_customer_id: (subscription as any)?.customer_id || null,
          updated_at: now.toISOString(),
        },
        { onConflict: "profile_id" }
      )
    }

    return NextResponse.json({
      subscription_id: subscription.id,
      key_id: keyId,
      plan_type: planType,
    })
  } catch (err: unknown) {
    console.error("Error creating Razorpay subscription:", err)
    const message = err instanceof Error ? err.message : "Failed to create subscription"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
