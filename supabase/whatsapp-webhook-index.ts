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

async function sendWhatsAppMessage(to: string, content: any, message_type: string = 'bot_reply', profileId?: string) {
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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.ok) {
    const waData = await res.json()
    const waMessageId = waData.messages?.[0]?.id
    if (waMessageId) {
      let pId = profileId;
      if (!pId) {
         const { data: profile } = await supabase.from('profiles').select('id').or(`whatsapp_number.eq.${to},whatsapp_number.eq.+${to}`).maybeSingle()
         pId = profile?.id
      }
      
      if (pId) {
         let msgStr = typeof content === 'string' ? content : (content.body?.text || 'Interactive Message');
         await supabase.from('whatsapp_message_logs').insert({
            profile_id: pId,
            wa_message_id: waMessageId,
            status: 'sent',
            body: msgStr,
            message_type: message_type
         })
      }
    }
  } else {
    console.error("Failed to send WA message:", await res.text())
  }
}

serve(async (req) => {
  const { method } = req
  const url = new URL(req.url)

  if (method === 'GET') {
    const trigger = url.searchParams.get('trigger')
    if (trigger === 'tasks') {
      try {
        const { data: users, error } = await supabase
          .from('profiles')
          .select('id, whatsapp_number');
          
        if (error) throw error;
        
        let sentCount = 0;
        if (users) {
          for (const user of users) {
            const phone = `+${user.whatsapp_number.replace(/\D/g, '')}`;
            // We use processMessage with 'tasks' command to get their formatted task list
            const reply = await processMessage(phone, 'tasks', { isInteractive: false });
            
            // If they have tasks, it will not return the "all caught up" or empty messages
            if (reply && !reply.includes("caught up") && !reply.includes("don't have any pending tasks") && !reply.includes("No pending tasks")) {
               const cleanTo = user.whatsapp_number.replace(/\D/g, '');
               await sendWhatsAppMessage(cleanTo, `🔔 *Pending Tasks Reminder*\n\nHere is your current task list:\n\n${reply}`, 'tasks_blast', user.id);
               sentCount++;
            }
          }
        }
        
        return new Response(JSON.stringify({ success: true, sent: sentCount }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      } catch (err: any) {
        console.error('Error in daily tasks guardian:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

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
                  { type: 'reply', reply: { id: 'stats', title: '📊 Show Stats' } },
                  { type: 'reply', reply: { id: 'log_menu', title: '✍️ Log Specific' } }
                ]
              }
            };
            await sendWhatsAppMessage(cleanTo, interactiveMsg, 'attendance_guardian', user.id);
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
            } else if (text === 'log_menu' || text === 'subjects') {
              const { data: profile } = await supabase.from('profiles').select('id, academics_enabled, current_semester_id').or(`whatsapp_number.eq.${from},whatsapp_number.eq.+${from}`).single();
              if (profile?.academics_enabled) {
                const { data: subjects } = await supabase.from('subjects')
                  .select('name')
                  .eq('profile_id', profile.id)
                  .eq('type', 'academic')
                  .eq('is_active', true);

                if (subjects && subjects.length > 0) {
                  const rows = subjects.slice(0, 10).map((s: any) => ({
                    id: `attended ${s.name}`,
                    title: s.name.substring(0, 24),
                    description: `Mark present for ${s.name}`
                  }));

                  const interactiveList = {
                    type: 'list',
                    header: { type: 'text', text: '✍️ Log Attendance' },
                    body: { text: 'Select a subject to mark it as *Present* for today. \n\n(To mark absent, type "missed [subject]")' },
                    footer: { text: 'Ryu Medha' },
                    action: {
                      button: 'Select Subject',
                      sections: [{ title: 'Your Subjects', rows }]
                    }
                  };
                  await sendWhatsAppMessage(from, interactiveList, 'bot_reply', profile.id);
                } else {
                  await sendWhatsAppMessage(from, "You don't have any active academic subjects to log. Type 'add subject [name]' to start!");
                }
              } else {
                await sendWhatsAppMessage(from, "Academic tracking is not enabled for your profile.");
              }
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
