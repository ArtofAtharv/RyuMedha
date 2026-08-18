import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()
    const signature = req.headers.get("x-razorpay-signature")
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(bodyText).digest("hex")

      if (expectedSignature !== signature) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
      }
    }

    const payload = JSON.parse(bodyText)
    const event = payload.event
    const entity = payload.payload?.subscription?.entity || payload.payload?.payment?.entity

    if (!entity) {
      return NextResponse.json({ status: "ignored: missing entity" })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const razorpaySubId = entity.id || entity.subscription_id
    const notes = entity.notes || {}
    const profileId = notes.profile_id

    if (!profileId && !razorpaySubId) {
      return NextResponse.json({ status: "ignored: missing identifier" })
    }

    // Locate subscription row
    let query = supabase.from("subscriptions").select("*")
    if (profileId) {
      query = query.eq("profile_id", profileId)
    } else {
      query = query.eq("razorpay_subscription_id", razorpaySubId)
    }

    const { data: subData } = await query.single()

    if (!subData && !profileId) {
      return NextResponse.json({ status: "ignored: subscription profile not found" })
    }

    const targetProfileId = profileId || subData.profile_id

    // Safeguard: Check if the user currently holds active invite access or admin free access,
    // or if the subscription ID in DB does not match this incoming webhook's razorpaySubId.
    const isInviteOrAdminFree = Boolean(
      subData?.razorpay_subscription_id?.startsWith("invite_") ||
      subData?.razorpay_subscription_id?.startsWith("admin_free_")
    )

    if (isInviteOrAdminFree && (event === "subscription.cancelled" || event === "subscription.halted")) {
      console.log(
        `[Webhook] Ignored ${event} for ${razorpaySubId} because profile currently has active invite/admin access (${subData.razorpay_subscription_id})`
      )
      return NextResponse.json({ status: "ignored: user has active invite/admin access" })
    }

    if (
      subData?.razorpay_subscription_id &&
      subData.razorpay_subscription_id !== razorpaySubId &&
      (event === "subscription.cancelled" || event === "subscription.halted")
    ) {
      console.log(
        `[Webhook] Ignored ${event} for ${razorpaySubId} because profile currently uses a different subscription ID (${subData.razorpay_subscription_id})`
      )
      return NextResponse.json({ status: "ignored: non-matching subscription id" })
    }

    if (event === "subscription.charged" || event === "subscription.activated") {
      const currentEnd = new Date()
      if (subData?.plan_type === "yearly") {
        currentEnd.setFullYear(currentEnd.getFullYear() + 1)
      } else {
        currentEnd.setMonth(currentEnd.getMonth() + 1)
      }

      await supabase.from("subscriptions").upsert(
        {
          profile_id: targetProfileId,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: currentEnd.toISOString(),
          scheduled_deletion_at: null,
          razorpay_subscription_id: razorpaySubId,
        },
        { onConflict: "profile_id" }
      )
    } else if (
      event === "subscription.halted" ||
      event === "subscription.cancelled" ||
      event === "subscription.completed"
    ) {
      // Grace period: deletion scheduled 60 days after subscription expiry
      const deletionDate = new Date()
      deletionDate.setDate(deletionDate.getDate() + 60)

      await supabase.from("subscriptions").upsert(
        {
          profile_id: targetProfileId,
          status: event === "subscription.cancelled" ? "canceled" : "expired",
          scheduled_deletion_at: deletionDate.toISOString(),
          razorpay_subscription_id: razorpaySubId,
        },
        { onConflict: "profile_id" }
      )
    }

    return NextResponse.json({ status: "success", event })
  } catch (err: unknown) {
    console.error("Error handling Razorpay webhook:", err)
    const message = err instanceof Error ? err.message : "Webhook error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
