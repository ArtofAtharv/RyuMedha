import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import Razorpay from "razorpay"
import { sendPaymentConfirmationEmail } from "@/lib/email"

export async function POST(_req: Request) {
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

    const { data: sub } = await supabase.from("subscriptions").select("*").eq("profile_id", profile.id).maybeSingle()

    if (!sub || !sub.razorpay_subscription_id || !sub.razorpay_subscription_id.startsWith("sub_")) {
      return NextResponse.json({ status: sub?.status || "inactive", synced: false })
    }

    // Initialize Razorpay SDK
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ status: sub.status, synced: false })
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    // Fetch subscription details directly from Razorpay API
    const rzpSub = await razorpay.subscriptions.fetch(sub.razorpay_subscription_id)

    // Razorpay subscription statuses: 'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
    const isActiveOnRzp = rzpSub.status === "active" || rzpSub.status === "authenticated"

    if (isActiveOnRzp && sub.status !== "active") {
      const now = new Date()
      let periodEnd: Date
      if (sub.plan_type === "yearly") {
        periodEnd = new Date(now)
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      } else {
        periodEnd = new Date(now)
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      }

      await supabase.from("subscriptions").upsert(
        {
          profile_id: profile.id,
          status: "active",
          plan_type: sub.plan_type || "monthly",
          razorpay_subscription_id: sub.razorpay_subscription_id,
          razorpay_plan_id: (rzpSub as { plan_id?: string })?.plan_id || null,
          razorpay_customer_id: (rzpSub as { customer_id?: string })?.customer_id || null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          scheduled_deletion_at: null,
          updated_at: now.toISOString(),
        },
        { onConflict: "profile_id" }
      )

      // Send confirmation email from ryumedha@gmail.com
      if (profile.email) {
        await sendPaymentConfirmationEmail({
          to: profile.email,
          displayName: profile.display_name,
          planType: sub.plan_type === "yearly" ? "yearly" : "monthly",
          razorpaySubId: sub.razorpay_subscription_id,
          periodEnd: periodEnd.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
        })
      }

      return NextResponse.json({ status: "active", synced: true, periodEnd: periodEnd.toISOString() })
    }

    return NextResponse.json({ status: sub.status, rzpStatus: rzpSub.status, synced: false })
  } catch (err: unknown) {
    console.error("Error syncing Razorpay subscription:", err)
    const message = err instanceof Error ? err.message : "Failed to sync subscription"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
