import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

console.log("Hello from Subscription Notifications edge function!")

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
    
    const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const in3Days = new Date(now.valueOf() + 3 * 24 * 60 * 60 * 1000)
    const in7Days = new Date(now.valueOf() + 7 * 24 * 60 * 60 * 1000)
    const in1Day = new Date(now.valueOf() + 1 * 24 * 60 * 60 * 1000)

    let notificationCount = 0

    // 1. Check Trials Ending in <= 3 Days
    const { data: trialingSubs } = await supabase
      .from('subscriptions')
      .select('id, profile_id, trial_end, status, profiles(whatsapp_number, display_name, email)')
      .eq('status', 'trialing')
      .lte('trial_end', in3Days.toISOString())

    for (const sub of trialingSubs || []) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles
      if (!profile) continue

      // Check if reminder was already sent
      const { data: sentLog } = await supabase
        .from('subscription_notifications_log')
        .select('id')
        .eq('profile_id', sub.profile_id)
        .eq('notification_type', 'trial_ending_3d')
        .single()

      if (sentLog) continue

      const trialEndDateStr = new Date(sub.trial_end).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      })

      const msg = `🔔 *Ryu Medha Free Trial Ending Soon*

Hi ${profile.display_name || 'there'}, your 1-Month Free Trial on Ryu Medha expires on *${trialEndDateStr}*.

Subscribe to keep your attendance, grades, timers, and tasks safe! Plans start at just ₹39/month.

Visit: https://ryumedha.in/dashboard/subscription`

      // Send WhatsApp
      if (profile.whatsapp_number && waToken && waPhoneId) {
        try {
          const cleanTo = profile.whatsapp_number.replace(/\D/g, '')
          const res = await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanTo,
              text: { body: msg }
            })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.messages?.[0]?.id) {
              await supabase.from('whatsapp_message_logs').insert({
                profile_id: sub.profile_id,
                wa_message_id: data.messages[0].id,
                status: 'sent',
                body: msg,
                message_type: 'subscription_reminder'
              })
            }
          }
        } catch (err) {
          console.error('Failed to send WhatsApp trial reminder:', err)
        }
      }

      // Log notification
      await supabase.from('subscription_notifications_log').insert({
        profile_id: sub.profile_id,
        notification_type: 'trial_ending_3d'
      })
      notificationCount++
    }

    // 2. Check Data Retention Deletion Warnings (7 Days and 1 Day remaining)
    const { data: expiredSubs } = await supabase
      .from('subscriptions')
      .select('id, profile_id, scheduled_deletion_at, status, profiles(whatsapp_number, display_name, email)')
      .in('status', ['expired', 'canceled'])
      .not('scheduled_deletion_at', 'is', null)

    for (const sub of expiredSubs || []) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles
      if (!profile || !sub.scheduled_deletion_at) continue

      const deletionDate = new Date(sub.scheduled_deletion_at)
      const daysLeft = Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      let warningType: 'deletion_warning_7d' | 'deletion_warning_1d' | null = null
      if (daysLeft <= 7 && daysLeft > 1) {
        warningType = 'deletion_warning_7d'
      } else if (daysLeft <= 1 && daysLeft >= 0) {
        warningType = 'deletion_warning_1d'
      }

      if (!warningType) continue

      // Check if already sent
      const { data: sentLog } = await supabase
        .from('subscription_notifications_log')
        .select('id')
        .eq('profile_id', sub.profile_id)
        .eq('notification_type', warningType)
        .single()

      if (sentLog) continue

      const deletionDateStr = deletionDate.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      })

      const msg = `⚠️ *URGENT: Ryu Medha Account Data Deletion Warning*

Hi ${profile.display_name || 'there'}, your subscription has expired.

As per our 2-month data retention policy, your account and ALL data (attendance records, grades, tasks, study logs) will be *PERMANENTLY DELETED* on *${deletionDateStr}* (${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining).

To save your data and reactivate your workspace, subscribe now at:
https://ryumedha.in/dashboard/subscription`

      if (profile.whatsapp_number && waToken && waPhoneId) {
        try {
          const cleanTo = profile.whatsapp_number.replace(/\D/g, '')
          await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanTo,
              text: { body: msg }
            })
          })
        } catch (err) {
          console.error('Failed to send WhatsApp deletion warning:', err)
        }
      }

      await supabase.from('subscription_notifications_log').insert({
        profile_id: sub.profile_id,
        notification_type: warningType
      })
      notificationCount++
    }

    return new Response(JSON.stringify({ status: "success", notificationCount }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error: unknown) {
    console.error('Error running subscription notifications function:', error)
    const message = error instanceof Error ? error.message : 'Subscription notifications error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
