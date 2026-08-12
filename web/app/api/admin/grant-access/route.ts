import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

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

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .single()

    if (!callerProfile || !callerProfile.is_admin) {
      return NextResponse.json({ error: 'Access denied: Admin privileges required' }, { status: 403 })
    }

    const body = await req.json()
    const { profileId, action } = body

    if (!profileId || !action) {
      return NextResponse.json({ error: 'Missing profileId or action' }, { status: 400 })
    }

    const now = new Date()
    let subPayload: Record<string, unknown> = {}
    let message = ''

    if (action === 'grant_lifetime') {
      subPayload = {
        profile_id: profileId,
        status: 'active',
        plan_type: 'yearly',
        razorpay_subscription_id: 'admin_free_lifetime',
        current_period_start: now.toISOString(),
        current_period_end: '2099-12-31T23:59:59.999Z',
        scheduled_deletion_at: null,
        updated_at: now.toISOString()
      }
      message = 'Lifetime free access granted!'
    } else if (action === 'grant_1year') {
      const oneYr = new Date(now)
      oneYr.setFullYear(oneYr.getFullYear() + 1)
      subPayload = {
        profile_id: profileId,
        status: 'active',
        plan_type: 'yearly',
        razorpay_subscription_id: 'admin_free_1year',
        current_period_start: now.toISOString(),
        current_period_end: oneYr.toISOString(),
        scheduled_deletion_at: null,
        updated_at: now.toISOString()
      }
      message = '1-Year free access granted!'
    } else if (action === 'extend_30days' || action === 'extend_1year') {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('profile_id', profileId)
        .single()

      let baseDate = now
      if (existingSub?.current_period_end && new Date(existingSub.current_period_end) > now) {
        baseDate = new Date(existingSub.current_period_end)
      } else if (existingSub?.trial_end && new Date(existingSub.trial_end) > now) {
        baseDate = new Date(existingSub.trial_end)
      }

      const newEnd = new Date(baseDate)
      if (action === 'extend_30days') {
        newEnd.setDate(newEnd.getDate() + 30)
      } else {
        newEnd.setFullYear(newEnd.getFullYear() + 1)
      }

      subPayload = {
        profile_id: profileId,
        status: 'active',
        current_period_start: existingSub?.current_period_start || now.toISOString(),
        current_period_end: newEnd.toISOString(),
        scheduled_deletion_at: null,
        updated_at: now.toISOString()
      }
      message = `Subscription extended until ${newEnd.toLocaleDateString('en-IN')}`
    } else if (action === 'revoke') {
      const deletionDate = new Date(now)
      deletionDate.setDate(deletionDate.getDate() + 60)
      subPayload = {
        profile_id: profileId,
        status: 'canceled',
        scheduled_deletion_at: deletionDate.toISOString(),
        updated_at: now.toISOString()
      }
      message = 'Subscription access revoked.'
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { error: upsertErr } = await supabase
      .from('subscriptions')
      .upsert(subPayload, { onConflict: 'profile_id' })

    if (upsertErr) {
      console.error('Error updating user subscription:', upsertErr)
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message })
  } catch (err: unknown) {
    console.error('Error in admin grant-access:', err)
    const message = err instanceof Error ? err.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
