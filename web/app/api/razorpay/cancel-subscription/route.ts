import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Razorpay from 'razorpay'

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

    // Try canceling on Razorpay if it's a real sub_ ID
    if (sub.razorpay_subscription_id?.startsWith('sub_')) {
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
      const keySecret = process.env.RAZORPAY_KEY_SECRET

      if (keyId && keySecret) {
        try {
          const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
          await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, false) // cancel_at_cycle_end = false
        } catch (rzpErr) {
          console.warn('Razorpay SDK cancel warning (ignoring if test or already canceled):', rzpErr)
        }
      }
    }

    // Update status in DB to canceled
    const deletionDate = new Date()
    deletionDate.setDate(deletionDate.getDate() + 60)

    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        scheduled_deletion_at: deletionDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profile.id)

    if (updateErr) {
      console.error('Error updating subscription status to canceled:', updateErr)
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled successfully. Your data is retained for 60 days.'
    })
  } catch (err: unknown) {
    console.error('Error canceling subscription:', err)
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
