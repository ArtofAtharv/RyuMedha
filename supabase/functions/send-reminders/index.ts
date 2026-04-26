import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import webpush from "npm:web-push@3.6.7"

console.log("Hello from Send Reminders edge function!")

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
    
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || ""
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || ""
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || "mailto:admin@ryumedha.in"

    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    }

    const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
      let msg = `🔔 *Reminder: ${taskTitle}*\n\n`
      if (reminder.reminder_type === 'due_date') {
        msg += `This task is due today!`
      } else if (reminder.reminder_type === '1_day_prior') {
        msg += `This task is due tomorrow!`
      } else {
        msg += `Don't forget to complete this task!`
      }

      if (!whatsAppSuccess && profile?.whatsapp_number && waToken && waPhoneId) {
        try {
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
              to: cleanTo,
              text: { body: msg },
            }),
          })
          if (res.ok) {
            whatsAppSuccess = true
          } else {
            console.error("WhatsApp error for reminder", reminder.id, await res.text())
          }
        } catch (e) {
          console.error("Failed to send WhatsApp", e)
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
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
