import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || "ryumedha_secret_token"

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
      console.log('--- WHATSAPP WEBHOOK EVENT ---')
      console.log(JSON.stringify(body, null, 2))

      const entry = body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      // Case A: Inbound Message (Update 24h window)
      if (value?.messages) {
        for (const message of value.messages) {
          const from = message.from 
          const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString()

          console.log(`Processing inbound message from: ${from}`)
          
          const { data, error } = await supabase
            .from('profiles')
            .update({ last_user_message_at: timestamp })
            .or(`whatsapp_number.eq.${from},whatsapp_number.eq.+${from}`)
            .select()
          
          if (error) console.error(`Error updating window for ${from}:`, error)
          else console.log(`Updated window for ${from}. Profiles matched: ${data?.length}`)
        }
      }

      // Case B: Status Update (delivered, read, etc)
      if (value?.statuses) {
        for (const status of value.statuses) {
          const wa_message_id = status.id
          const currentStatus = status.status 
          const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString()
          
          console.log(`Processing status update for ${wa_message_id}: ${currentStatus}`)

          let updateData: any = { status: currentStatus, updated_at: timestamp }
          if (status.errors) updateData.error_message = JSON.stringify(status.errors)

          const { error } = await supabase
            .from('whatsapp_message_logs')
            .update(updateData)
            .eq('wa_message_id', wa_message_id)
          
          if (error) console.error(`Error updating log for ${wa_message_id}:`, error)
          else console.log(`Successfully updated log for ${wa_message_id} to ${currentStatus}`)
        }
      }

      return new Response('EVENT_RECEIVED', { status: 200 })
    } catch (e) {
      console.error('Webhook Global Error:', e)
      return new Response('Error', { status: 500 })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
})
