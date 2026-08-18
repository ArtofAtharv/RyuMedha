import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getInviteCodesAsync, saveInviteCodeToDb, saveInviteCodesFile } from "@/lib/invite-codes-store"
import { sendInviteAccessEmail } from "@/lib/email"
import { cancelUserRazorpaySubscriptions } from "@/lib/razorpay"

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

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(accessToken)
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized: Session invalid" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const body = await req.json()
    const rawCode = body.code ? String(body.code).trim().toUpperCase() : ""

    if (!rawCode) {
      return NextResponse.json({ error: "Please provide an invite code" }, { status: 400 })
    }

    const codes = await getInviteCodesAsync()
    const target = codes.find((c) => c.code.toUpperCase() === rawCode)

    if (!target) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 400 })
    }

    if (!target.isActive) {
      return NextResponse.json({ error: "This invite code is no longer active" }, { status: 400 })
    }

    if (target.maxUses !== null && target.usesCount >= target.maxUses) {
      return NextResponse.json({ error: "This invite code has reached its maximum uses" }, { status: 400 })
    }

    // Fetch existing user subscription to check for active Razorpay Autopay or period end
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle()

    // 1. Cancel any active Razorpay recurring subscription so Razorpay WILL NOT bill the bank account next month
    await cancelUserRazorpaySubscriptions(profile.id, existingSub?.razorpay_subscription_id)

    // 2. Calculate subscription period (extending existing current_period_end if active in future)
    const now = new Date()
    const baseDate =
      existingSub?.current_period_end && new Date(existingSub.current_period_end) > now
        ? new Date(existingSub.current_period_end)
        : now

    let periodEnd: string
    if (target.durationType === "lifetime") {
      periodEnd = "2099-12-31T23:59:59.999Z"
    } else if (target.durationType === "6_months") {
      const d = new Date(baseDate)
      d.setMonth(d.getMonth() + 6)
      periodEnd = d.toISOString()
    } else if (target.durationType === "1_month") {
      const d = new Date(baseDate)
      d.setMonth(d.getMonth() + 1)
      periodEnd = d.toISOString()
    } else {
      const d = new Date(baseDate)
      d.setFullYear(d.getFullYear() + 1)
      periodEnd = d.toISOString()
    }

    // Update user subscription in database
    const subPayload = {
      profile_id: profile.id,
      status: "active",
      plan_type: target.durationType === "1_month" ? "monthly" : "yearly",
      razorpay_subscription_id: `invite_${rawCode}`,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd,
      scheduled_deletion_at: null,
      updated_at: now.toISOString(),
    }

    const { error: subErr } = await supabase.from("subscriptions").upsert(subPayload, { onConflict: "profile_id" })

    if (subErr) {
      console.error("Error redeeming invite code in DB:", subErr)
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 })
    }

    // Increment invite code usage
    target.usesCount += 1
    await saveInviteCodeToDb(target)
    saveInviteCodesFile(codes)

    // Send confirmation email from ryumedha@gmail.com if email is available
    const recipientEmail = profile.email || user.email
    if (recipientEmail) {
      await sendInviteAccessEmail({
        to: recipientEmail,
        displayName: profile.display_name,
        code: rawCode,
        durationType: target.durationType,
      })
    }

    const durationLabel =
      target.durationType === "lifetime"
        ? "Lifetime"
        : target.durationType === "6_months"
          ? "6-Months"
          : target.durationType === "1_month"
            ? "1-Month"
            : "1-Year"

    return NextResponse.json({
      success: true,
      message: `Free ${durationLabel} access activated!`,
      durationType: target.durationType,
    })
  } catch (err: unknown) {
    console.error("Error redeeming invite code:", err)
    const message = err instanceof Error ? err.message : "An error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
