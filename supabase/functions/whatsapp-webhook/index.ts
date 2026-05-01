// Updated by Antigravity: Added bot processor routing
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { processMessage } from "../whatsapp-bot/processor.ts"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || "ryumedha_secret_token"
const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function sendWhatsAppMessage(to: string, content: any) {
  const url = `https://graph.facebook.com/v18.0/${waPhoneId}/messages`
  const body: any = {
    messaging_product: 'whatsapp',
    to: to,
  }
  
  if (typeof content === 'string') {
    body.type = 'text'
    body.text = { body: content }
  } else {
    body.type = 'interactive'
    body.interactive = content
  }

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

serve(async (req) => {
  const { method } = req
  const url = new URL(req.url)

  if (method === 'GET') {
    const trigger = url.searchParams.get('trigger')
    if (trigger === 'daily') {
      try {
        const today = new Date().toISOString().split('T')[0];
        // Find users with academics enabled
        const { data: users } = await supabase
          .from('profiles')
          .select('id, whatsapp_number')
          .eq('academics_enabled', true)

        let sentCount = 0;
        if (users) {
          for (const user of users) {
            const msg = "🏫 *Daily Attendance Guardian*\n\nHey! It's 4 PM. Have you attended your classes today? Don't forget to log your attendance to stay on track!";
            const cleanTo = user.whatsapp_number.replace(/\D/g, '');
            const interactiveMsg = {
              type: 'button',
              body: { text: msg },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'present all', title: '✅ Attended All' } },
                  { type: 'reply', reply: { id: 'absent all', title: '❌ Missed All' } },
                  { type: 'reply', reply: { id: 'stats', title: '📊 Show Stats' } }
                ]
              }
            };
            await sendWhatsAppMessage(cleanTo, interactiveMsg);
            sentCount++;
          }
        }
        return new Response(JSON.stringify({ success: true, sent: sentCount }), { status: 200 })
      } catch (e: any) {
        console.error('Daily Trigger Error:', e)
        return new Response(JSON.stringify({ error: e.message }), { status: 500 })
      }
    }

    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (method === 'POST') {
    try {
      const body = await req.json()
      const entry = body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      if (value?.messages) {
        for (const message of value.messages) {
          const from = message.from 
          let phone = from
          if (phone && !phone.startsWith('+')) {
            phone = `+${phone}`
          }
          const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString()

          // 1. Update 24h window
          await supabase
            .from('profiles')
            .update({ last_user_message_at: timestamp })
            .or(`whatsapp_number.eq.${from},whatsapp_number.eq.+${from}`)

          // 2. Handle Button Replies and Bot Commands
          const isInteractive = !!(message.button?.text || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id);
          const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;

          if (text) {
            console.log(`📩 [${phone}] (interactive: ${isInteractive}): ${text}`);
            if (isInteractive && text === 'all_done') {
              await sendWhatsAppMessage(from, "That's fantastic! Keep up the great momentum. 🌟")
            } else if (isInteractive && text === 'show_tasks') {
              await sendWhatsAppMessage(from, "Checking your list... 📂 (I will send your tasks shortly!)")
              const reply = await processMessage(phone, 'tasks', { isInteractive: false });
              if (Array.isArray(reply)) {
                for (const r of reply) await sendWhatsAppMessage(from, r);
              } else if (reply) {
                await sendWhatsAppMessage(from, reply);
              }
            } else {
              const reply = await processMessage(phone, text, { isInteractive });
              if (Array.isArray(reply)) {
                for (const r of reply) await sendWhatsAppMessage(from, r);
              } else if (reply) {
                await sendWhatsAppMessage(from, reply);
              }
            }
          }
        }
      }

      if (value?.statuses) {
        for (const status of value.statuses) {
          const wa_message_id = status.id
          const currentStatus = status.status 
          const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString()
          let updateData: any = { status: currentStatus, updated_at: timestamp }
          if (status.errors) updateData.error_message = JSON.stringify(status.errors)

          await supabase
            .from('whatsapp_message_logs')
            .update(updateData)
            .eq('wa_message_id', wa_message_id)
        }
      }

      return new Response('EVENT_RECEIVED', { status: 200 })
    } catch (e) {
      console.error('Webhook Error:', e)
      return new Response('Error', { status: 500 })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
})
