
// supabase/functions/whatsapp-bot/index.ts
// Consolidated WhatsApp Bot handler
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { processMessage } from "./processor.ts"
import webpush from "npm:web-push@3.6.7"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || "ryumedha_secret_token"
const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

const ENGAGEMENT_TEMPLATES = [
  "Namaste! Quick check-in: Have you made progress on your tasks today? 📚",
  "Hey there! Ready for a productive session? Let us know if you need your task list! 🚀",
  "Studying today? Don't forget to track your hours to stay ahead! ⏳",
  "Ryu Medha is here! Are you staying on track with your goals? 🎯",
  "Focus time! Need a reminder of what's due next? Reply to keep our window open! ✨"
]

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function sendWhatsAppMessage(to: string, content: any, message_type: string = 'bot_reply', profileId?: string) {
  const url = `https://graph.facebook.com/v18.0/${waPhoneId}/messages`
  const body: any = typeof content === 'string'
    ? { messaging_product: 'whatsapp', to: to, type: 'text', text: { body: content } }
    : { messaging_product: 'whatsapp', to: to, type: 'interactive', interactive: content }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error("Failed to send WA message:", await res.text())
    return
  }

  const waData = await res.json()
  const waMessageId = waData.messages?.[0]?.id
  if (!waMessageId) return

  let pId = profileId;
  if (!pId) {
    const { data: profile } = await supabase.from('profiles').select('id').in('whatsapp_number', [to, `+${to}`]).maybeSingle()
    pId = profile?.id
  }
  
  if (pId) {
    const msgStr = typeof content === 'string' ? content : (content.body?.text || 'Interactive Message');
    await supabase.from('whatsapp_message_logs').insert({
      profile_id: pId,
      wa_message_id: waMessageId,
      status: 'sent',
      body: msgStr,
      message_type: message_type
    })
  }
}

async function handleTasksTrigger(): Promise<Response> {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, whatsapp_number');
      
    if (error) throw error;
    
    let sentCount = 0;
    if (users) {
      for (const user of users) {
        if (!user.whatsapp_number) continue;
        const phone = `+${user.whatsapp_number.replace(/\D/g, '')}`;
        const reply = await processMessage(phone, 'tasks', { isInteractive: false });
        
        // Wait, processMessage can return an interactive message object or a string
        const textReply = typeof reply === 'string' ? reply : (reply?.body?.text || "");

        if (textReply && !textReply.includes("caught up") && !textReply.includes("don't have any pending tasks") && !textReply.includes("No pending tasks")) {
          const cleanTo = user.whatsapp_number.replace(/\D/g, '');
          await sendWhatsAppMessage(cleanTo, `🔔 *Pending Tasks Reminder*\n\nHere is your current task list:\n\n${textReply}`, 'tasks_blast', user.id);
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

async function handleDailyTrigger(): Promise<Response> {
  try {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, whatsapp_number')
      .eq('academics_enabled', true)

    let sentCount = 0;
    if (users) {
      for (const user of users) {
        if (!user.whatsapp_number) continue;
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

async function handleRemindersTrigger(): Promise<Response> {
  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || ""
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || ""
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || "mailto:admin@ryumedha.in"

    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    }

    const { data: reminders, error } = await supabase
      .from('task_reminders')
      .select(`
        id, scheduled_for, reminder_type, whatsapp_sent, push_sent,
        profile_id,
        profiles (whatsapp_number, display_name, push_notifications_enabled),
        tasks (title, due_date, subject_id, priority)
      `)
      .lte('scheduled_for', new Date().toISOString())
      .or('whatsapp_sent.eq.false,push_sent.eq.false')
      .limit(50)

    if (error) throw error

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ status: "success", message: "No reminders due" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    let processedCount = 0

    for (const reminder of reminders) {
      const profile = Array.isArray(reminder.profiles) ? reminder.profiles[0] : reminder.profiles
      const task = Array.isArray(reminder.tasks) ? reminder.tasks[0] : reminder.tasks
      
      let whatsAppSuccess = reminder.whatsapp_sent
      let pushSuccess = reminder.push_sent

      const taskTitle = task?.title || 'Unknown Task'
      let dueStr = ""
      if (task?.due_date) {
        const d = new Date(task.due_date)
        const datePart = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
        dueStr = `${datePart} at ${timeStr}`
      }
      
      let msg = `🔔 *Reminder: ${taskTitle}*\n\n`
      if (dueStr) {
        msg += `Due: ${dueStr}`
      } else {
        msg += `Don't forget to complete this task!`
      }

      if (!whatsAppSuccess && profile?.whatsapp_number && waToken && waPhoneId) {
        try {
          const cleanTo = profile.whatsapp_number.replace(/\D/g, '')
          await sendWhatsAppMessage(cleanTo, msg, 'reminder', reminder.profile_id)
          whatsAppSuccess = true
        } catch (e) {
          console.error("Failed to send WhatsApp reminder", e)
        }
      } else if (!profile?.whatsapp_number) {
        whatsAppSuccess = true
      }

      if (!pushSuccess && profile?.push_notifications_enabled) {
        try {
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('profile_id', reminder.profile_id)
            
          if (subs && subs.length > 0) {
            let allSent = true
            for (const sub of subs) {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              }
              const payload = JSON.stringify({
                title: "Ryu Medha Reminder",
                body: msg.replace(/\*/g, ''), 
                url: "/dashboard/tasks"
              })
              try {
                await webpush.sendNotification(pushSubscription, payload)
              } catch (pushErr: any) {
                console.error("Web Push Error", pushErr)
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                  await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                }
                allSent = false
              }
            }
            if (allSent) pushSuccess = true
          } else {
            pushSuccess = true
          }
        } catch (e) {
          console.error("Failed to send push", e)
        }
      } else {
        pushSuccess = true 
      }

      await supabase
        .from('task_reminders')
        .update({ whatsapp_sent: whatsAppSuccess, push_sent: pushSuccess })
        .eq('id', reminder.id)

      processedCount++
    }

    return new Response(JSON.stringify({ status: "success", processedCount }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    console.error('Error in reminders trigger:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

async function handleEngageTrigger(profileId: string): Promise<Response> {
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single()
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 })
    }

    const msg = ENGAGEMENT_TEMPLATES[Math.floor(Math.random() * ENGAGEMENT_TEMPLATES.length)]
    const cleanTo = profile.whatsapp_number.replace(/\D/g, '')

    const interactiveMsg = {
      type: 'button',
      body: { text: msg },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'show_tasks', title: 'Show My Tasks' } },
          { type: 'reply', reply: { id: 'all_done', title: 'All Done!' } }
        ]
      }
    }

    await sendWhatsAppMessage(cleanTo, interactiveMsg, 'engagement', profile.id)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err: any) {
    console.error('Engage Trigger Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

async function handleLogMenuCommand(from: string, profile: any) {
  if (!profile?.academics_enabled) {
    await sendWhatsAppMessage(from, "Academic tracking is not enabled for your profile.");
    return;
  }
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
}

async function sendBotReplies(to: string, reply: any) {
  if (!reply) return;
  if (Array.isArray(reply)) {
    for (const r of reply) await sendWhatsAppMessage(to, r);
  } else {
    await sendWhatsAppMessage(to, reply);
  }
}

async function processSingleMessage(message: any) {
  const from = message.from;
  const phone = from?.startsWith('+') ? from : `+${from || ''}`;
  const timestamp = new Date(Number.parseInt(message.timestamp, 10) * 1000).toISOString();

  await supabase
    .from('profiles')
    .update({ last_user_message_at: timestamp })
    .in('whatsapp_number', [from, `+${from}`]);

  const isInteractive = !!(message.button?.text || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id);
  const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;

  if (!text) return;
  console.log(`📩 [${phone}] (interactive: ${isInteractive}): ${text}`);

  if (isInteractive && text === 'all_done') {
    await sendWhatsAppMessage(from, "That's fantastic! Keep up the great momentum. 🌟");
    return;
  }
  
  if (text === 'log_menu' || text === 'subjects') {
    const { data: profile } = await supabase.from('profiles').select('id, academics_enabled, current_semester_id').in('whatsapp_number', [from, `+${from}`]).single();
    await handleLogMenuCommand(from, profile);
    return;
  }

  if (isInteractive && text === 'show_tasks') {
    await sendWhatsAppMessage(from, "Checking your list... 📂 (I will send your tasks shortly!)");
    const reply = await processMessage(phone, 'tasks', { isInteractive: false });
    await sendBotReplies(from, reply);
    return;
  }

  const reply = await processMessage(phone, text, { isInteractive });
  await sendBotReplies(from, reply);
}

async function handleMessages(messages: any[]) {
  for (const message of messages) {
    await processSingleMessage(message);
  }
}

async function handleStatuses(statuses: any[]) {
  for (const status of statuses) {
    const wa_message_id = status.id
    const currentStatus = status.status 
    const timestamp = new Date(Number.parseInt(status.timestamp, 10) * 1000).toISOString()
    const updateData: any = { status: currentStatus, updated_at: timestamp }
    if (status.errors) updateData.error_message = JSON.stringify(status.errors)

    await supabase
      .from('whatsapp_message_logs')
      .update(updateData)
      .eq('wa_message_id', wa_message_id)
  }
}

async function handleGetRequest(url: URL): Promise<Response> {
  const trigger = url.searchParams.get('trigger')
  if (trigger === 'tasks') return handleTasksTrigger();
  if (trigger === 'daily') return handleDailyTrigger();

  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge || "", { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

async function handlePostRequest(req: Request): Promise<Response> {
  try {
    const body = await req.json()

    // Handle custom triggers from the web dashboard securely
    if (body && body.trigger) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      }

      // Create a temporary Supabase client with the caller's JWT to verify their role
      const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } }
      })

      const { data: profile, error: profileErr } = await userSupabase
        .from('profiles')
        .select('is_admin')
        .single()

      if (profileErr || !profile || !profile.is_admin) {
        return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      }

      if (body.trigger === 'tasks') return handleTasksTrigger();
      if (body.trigger === 'daily') return handleDailyTrigger();
      if (body.trigger === 'reminders') return handleRemindersTrigger();
      if (body.trigger === 'engage') return handleEngageTrigger(body.profile_id);

      return new Response(JSON.stringify({ error: "Invalid trigger" }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (value?.messages) await handleMessages(value.messages);
    if (value?.statuses) await handleStatuses(value.statuses);

    return new Response('EVENT_RECEIVED', { status: 200 })
  } catch (e) {
    console.error('Webhook Error:', e)
    return new Response('Error', { status: 500 })
  }
}

serve(async (req: Request) => {
  if (req.method === 'GET') return handleGetRequest(new URL(req.url))
  if (req.method === 'POST') return handlePostRequest(req)
  return new Response('Method Not Allowed', { status: 405 })
})
