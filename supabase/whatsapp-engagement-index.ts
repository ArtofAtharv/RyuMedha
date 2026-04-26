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
  const { profile_id, type } = await req.json()

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
      const { data: users } = await supabase
        .from('whatsapp_window_status')
        .select('*')
        .eq('window_status', 'closing_soon')

      let sentCount = 0
      if (users) {
        for (const user of users) {
          const success = await sendEngagementMessage({ id: user.profile_id, whatsapp_number: user.whatsapp_number })
          if (success) sentCount++
        }
      }
      return new Response(JSON.stringify({ success: true, sent: sentCount }), { status: 200 })
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 })
  } catch (e: any) {
    console.error('Engagement Error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
