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

serve(async (req) => {
  const { profile_id, type } = await req.json()

  try {
    // 1. Get the user profile
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single()

    if (pErr || !profile?.whatsapp_number) {
      return new Response(JSON.stringify({ error: "User not found or no WhatsApp number" }), { status: 400 })
    }

    // 2. Pick a random message
    const msg = ENGAGEMENT_TEMPLATES[Math.floor(Math.random() * ENGAGEMENT_TEMPLATES.length)]
    const cleanTo = profile.whatsapp_number.replace(/\D/g, '')

    // 3. Send via WhatsApp Cloud API (Interactive Button Message)
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

    if (!res.ok) {
      const errText = await res.text()
      console.error("WhatsApp API Error:", errText)
      return new Response(JSON.stringify({ error: errText }), { status: 500 })
    }

    const waData = await res.json()
    const waMessageId = waData.messages?.[0]?.id

    // 4. Log the message
    if (waMessageId) {
      await supabase.from('whatsapp_message_logs').insert({
        profile_id: profile.id,
        wa_message_id: waMessageId,
        status: 'sent',
        body: msg,
        message_type: 'engagement'
      })
    }

    return new Response(JSON.stringify({ success: true, message_id: waMessageId }), { status: 200 })
  } catch (e: any) {
    console.error('Engagement Function Error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
