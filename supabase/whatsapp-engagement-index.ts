// Updated by Antigravity: Added daily mode for 4 PM cron job
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const ENGAGEMENT_TEMPLATES = [
  "Namaste! Quick check-in: Have you made progress on your tasks today? 📚",
  "Hey there! Ready for a productive session? Let us know if you need your task list! 🚀",
  "Studying today? Don't forget to track your hours to stay ahead! ⏳",
  "Ryu Medha is here! Are you staying on track with your goals? 🎯",
  "Focus time! Need a reminder of what's due next? Reply to keep our window open! ✨"
]

async function sendEngagementMessage(profile: any) {
  const msg = ENGAGEMENT_TEMPLATES[Math.floor(Math.random() * ENGAGEMENT_TEMPLATES.length)]
  const cleanTo = profile.whatsapp_number.replace(/\D/g, '')

  const url = `https://graph.facebook.com/v18.0/${waPhoneId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: msg },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'show_tasks', title: 'Show My Tasks' } },
            { type: 'reply', reply: { id: 'all_done', title: 'All Done!' } }
          ]
        }
      }
    }),
  })

  if (res.ok) {
    const waData = await res.json()
    const waMessageId = waData.messages?.[0]?.id
    if (waMessageId) {
      await supabase.from('whatsapp_message_logs').insert({
        profile_id: profile.id,
        wa_message_id: waMessageId,
        status: 'sent',
        body: msg,
        message_type: 'engagement'
      })
    }
    return true
  }
  return false
}

serve(async (req) => {
  let profile_id = null;
  let type = null;

  try {
    const body = await req.json();
    profile_id = body?.profile_id;
    type = body?.type;
  } catch (e) {
    console.log("No JSON body or invalid JSON");
  }

  try {
    // MODE A: MANUAL (Single User)
    if (type === 'manual' && profile_id) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', profile_id).single()
      if (profile) {
        await sendEngagementMessage(profile)
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }
    }

    // MODE B: AUTO (Scan all users closing soon)
    if (type === 'auto') {
      // Find users whose window is 'closing_soon'
      // closing_soon means last message was between 22 and 24 hours ago.
      // To avoid spamming if the cron runs every hour, we fetch users who haven't received an engagement message recently.
      const { data: users } = await supabase
        .from('whatsapp_window_status')
        .select('*')
        .eq('window_status', 'closing_soon')

      let sentCount = 0
      if (users && users.length > 0) {
        for (const user of users) {
          // Check if we already sent an engagement message in the last 2 hours to avoid duplicates
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
          const { data: recentLogs } = await supabase
            .from('whatsapp_message_logs')
            .select('id')
            .eq('profile_id', user.profile_id)
            .eq('message_type', 'engagement')
            .gte('created_at', twoHoursAgo)
            .limit(1);

          if (!recentLogs || recentLogs.length === 0) {
            const success = await sendEngagementMessage({ id: user.profile_id, whatsapp_number: user.whatsapp_number })
            if (success) sentCount++
          }
        }
      }
      return new Response(JSON.stringify({ success: true, sent: sentCount }), { status: 200 })
    }

    // MODE C: DAILY (Send to everyone who has an open window, e.g. at 4 PM)
    if (type === 'daily') {
      const { data: users } = await supabase
        .from('whatsapp_window_status')
        .select('*')
        .eq('window_status', 'open')

      let sentCount = 0
      if (users && users.length > 0) {
        for (const user of users) {
          const success = await sendEngagementMessage({ id: user.profile_id, whatsapp_number: user.whatsapp_number })
          if (success) sentCount++
        }
      }
      return new Response(JSON.stringify({ success: true, sent: sentCount }), { status: 200 })
    }

    return new Response(JSON.stringify({ error: "Invalid request. Provide type='auto' or type='manual' with profile_id" }), { status: 400 })
  } catch (e: any) {
    console.error('Engagement Error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
