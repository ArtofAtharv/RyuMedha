import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getInviteCodes } from '@/lib/invite-codes-store'

export async function GET(_req: Request) {
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

    // Fetch all profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, email, whatsapp_number, created_at, is_admin')
      .order('created_at', { ascending: false })

    if (pErr) throw pErr

    // Fetch all subscriptions
    const { data: subscriptions, error: sErr } = await supabase
      .from('subscriptions')
      .select('*')

    if (sErr) throw sErr

    // Map profiles with their subscription
    const subMap = new Map(subscriptions?.map(s => [s.profile_id, s]))

    const userSubscriptions = (profiles || []).map(p => {
      const sub = subMap.get(p.id)
      return {
        profileId: p.id,
        displayName: p.display_name,
        email: p.email,
        whatsappNumber: p.whatsapp_number,
        isAdmin: p.is_admin === true,
        userCreatedAt: p.created_at,
        subscriptionId: sub?.id || null,
        status: sub?.status || 'trialing',
        planType: sub?.plan_type || null,
        razorpaySubscriptionId: sub?.razorpay_subscription_id || null,
        trialStart: sub?.trial_start || null,
        trialEnd: sub?.trial_end || null,
        currentPeriodStart: sub?.current_period_start || null,
        currentPeriodEnd: sub?.current_period_end || null,
        scheduledDeletionAt: sub?.scheduled_deletion_at || null
      }
    })

    const now = new Date()
    // Calculate aggregate metrics
    const totalUsers = userSubscriptions.length
    const activeAutopayCount = userSubscriptions.filter(u => u.status === 'active' && u.razorpaySubscriptionId?.startsWith('sub_')).length
    const freeLifetimeCount = userSubscriptions.filter(u => u.status === 'active' && (u.razorpaySubscriptionId === 'admin_free_lifetime' || u.razorpaySubscriptionId?.startsWith('invite_') || (u.currentPeriodEnd && new Date(u.currentPeriodEnd).getFullYear() > 2090))).length
    const free1YearCount = userSubscriptions.filter(u => u.status === 'active' && u.razorpaySubscriptionId === 'admin_free_1year').length
    const trialingCount = userSubscriptions.filter(u => u.status === 'trialing' && u.trialEnd && new Date(u.trialEnd) > now).length
    const expiredCount = userSubscriptions.filter(u => u.status === 'expired' || u.status === 'canceled').length

    const inviteCodes = getInviteCodes()

    return NextResponse.json({
      stats: {
        totalUsers,
        activeAutopayCount,
        freeLifetimeCount,
        free1YearCount,
        trialingCount,
        expiredCount
      },
      users: userSubscriptions,
      inviteCodes
    })
  } catch (err: unknown) {
    console.error('Error fetching admin subscriptions:', err)
    const message = err instanceof Error ? err.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
