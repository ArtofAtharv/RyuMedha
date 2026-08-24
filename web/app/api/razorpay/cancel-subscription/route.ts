import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { cancelUserRazorpaySubscriptions } from '@/lib/razorpay'

export async function POST(_req: Request) {
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

    const { data: profile } = await supabase.from('profiles').select('id').single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('profile_id', profile.id)
      .single()

    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Cancel active subscription on Razorpay so auto-debit stops
    await cancelUserRazorpaySubscriptions(profile.id, sub.razorpay_subscription_id)

    const now = new Date()
    const expiryDate = sub.current_period_end
      ? new Date(sub.current_period_end)
      : (sub.trial_end ? new Date(sub.trial_end) : now)

    const baseExpiry = expiryDate > now ? expiryDate : now
    const deletionDate = new Date(baseExpiry)
    deletionDate.setDate(deletionDate.getDate() + 60)

    const isFutureExpiry = baseExpiry > now
    const updatedStatus = isFutureExpiry ? (sub.status || 'active') : 'canceled'
    const newSubId = sub.razorpay_subscription_id && !sub.razorpay_subscription_id.endsWith('_canceled')
      ? `${sub.razorpay_subscription_id}_canceled`
      : sub.razorpay_subscription_id

    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({
        status: updatedStatus,
        razorpay_subscription_id: newSubId,
        scheduled_deletion_at: deletionDate.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('profile_id', profile.id)

    if (updateErr) {
      console.error('Error updating subscription status to canceled:', updateErr)
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
    }

    const expiryStr = baseExpiry.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
    return NextResponse.json({
      success: true,
      message: `Auto-pay canceled. Your access remains active until ${expiryStr}.`
    })
  } catch (err: unknown) {
    console.error('Error canceling subscription:', err)
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
