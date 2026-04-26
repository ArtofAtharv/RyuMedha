import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || "ryumedha_secret_token"

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const { method } = req
  const url = new URL(req.url)

  // 1. Webhook Verification (GET)
  if (method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified!')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // 2. Webhook Event Handling (POST)
  if (method === 'POST') {
    try {
      const body = await req.json()
      console.log('Webhook received:', JSON.stringify(body, null, 2))

      const entry = body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      // Case A: Inbound Message (Update 24h window)
      if (value?.messages) {
        for (const message of value.messages) {
          const from = message.from // User's phone number
          const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString()

          // Update profile's last_user_message_at
          const { error } = await supabase
            .from('profiles')
            .update({ last_user_message_at: timestamp })
            .eq('whatsapp_number', from)
          
          if (error) console.error(`Error updating window for ${from}:`, error)
          else console.log(`Updated 24h window for ${from} at ${timestamp}`)
        }
      }

      // Case B: Status Update (delivered, read, etc)
      if (value?.statuses) {
        for (const status of value.statuses) {
          const wa_message_id = status.id
          const currentStatus = status.status // sent, delivered, read, failed
          const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString()
          
          let updateData: any = { status: currentStatus, updated_at: timestamp }
          if (status.errors) {
            updateData.error_message = JSON.stringify(status.errors)
          }

          const { error } = await supabase
            .from('whatsapp_message_logs')
            .update(updateData)
            .eq('wa_message_id', wa_message_id)

          if (error) console.error(`Error updating log for ${wa_message_id}:`, error)
          else console.log(`Message ${wa_message_id} status updated to ${currentStatus}`)
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
