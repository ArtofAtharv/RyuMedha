import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || "ryumedha_secret_token"
const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${waPhoneId}/messages`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      text: { body: text },
    }),
  })
}

serve(async (req) => {
  const { method } = req
  const url = new URL(req.url)

  if (method === 'GET') {
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
          const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString()

          // 1. Update 24h window
          await supabase
            .from('profiles')
            .update({ last_user_message_at: timestamp })
            .or(`whatsapp_number.eq.${from},whatsapp_number.eq.+${from}`)

          // 2. Handle Button Replies
          if (message.type === 'interactive') {
            const buttonReply = message.interactive?.button_reply
            if (buttonReply?.id === 'all_done') {
              await sendWhatsAppMessage(from, "That's fantastic! Keep up the great momentum. 🌟")
            } else if (buttonReply?.id === 'show_tasks') {
              await sendWhatsAppMessage(from, "Checking your list... 📂 (I will send your tasks shortly!)")
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
