require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY; // Note: Ensure you add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY to bot/.env
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@ryumedha.in';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAndSendReminders() {
    try {
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
            .limit(50);

        if (error) throw error;
        if (!reminders || reminders.length === 0) return;

        console.log(`[${new Date().toISOString()}] Processing ${reminders.length} due reminders...`);

        for (const reminder of reminders) {
            const profile = Array.isArray(reminder.profiles) ? reminder.profiles[0] : reminder.profiles;
            const task = Array.isArray(reminder.tasks) ? reminder.tasks[0] : reminder.tasks;

            let whatsAppSuccess = reminder.whatsapp_sent;
            let pushSuccess = reminder.push_sent;

            const taskTitle = task?.title || 'Unknown Task';
            let msg = `🔔 *Reminder: ${taskTitle}*\n\n`;
            if (reminder.reminder_type === 'due_date') {
                msg += `This task is due today!`;
            } else if (reminder.reminder_type === '1_day_prior') {
                msg += `This task is due tomorrow!`;
            } else {
                msg += `Don't forget to complete this task!`;
            }

            // WhatsApp
            if (!whatsAppSuccess && profile?.whatsapp_number && WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
                try {
                    const cleanTo = profile.whatsapp_number.replace(/\D/g, '');
                    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
                    await axios.post(url, {
                        messaging_product: 'whatsapp',
                        to: cleanTo,
                        text: { body: msg },
                    }, {
                        headers: {
                            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                            'Content-Type': 'application/json',
                        }
                    });
                    whatsAppSuccess = true;
                } catch (e) {
                    console.error("WhatsApp error for reminder", reminder.id, e.response?.data || e.message);
                }
            } else if (!profile?.whatsapp_number) {
                whatsAppSuccess = true;
            }

            // Web Push
            if (!pushSuccess && profile?.push_notifications_enabled) {
                try {
                    const { data: subs } = await supabase
                        .from('push_subscriptions')
                        .select('*')
                        .eq('profile_id', reminder.profile_id);

                    if (subs && subs.length > 0) {
                        let allSent = true;
                        for (const sub of subs) {
                            const pushSubscription = {
                                endpoint: sub.endpoint,
                                keys: { p256dh: sub.p256dh, auth: sub.auth }
                            };
                            const payload = JSON.stringify({
                                title: "Ryu Medha Reminder",
                                body: msg.replace(/\*/g, ''), 
                                url: "/dashboard/tasks"
                            });
                            try {
                                await webpush.sendNotification(pushSubscription, payload);
                            } catch (pushErr) {
                                console.error("Web Push Error", pushErr.statusCode);
                                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                                    await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                                }
                                allSent = false;
                            }
                        }
                        if (allSent) pushSuccess = true;
                    } else {
                        pushSuccess = true;
                    }
                } catch (e) {
                    console.error("Failed to send push", e.message);
                }
            } else {
                pushSuccess = true;
            }

            await supabase
                .from('task_reminders')
                .update({ whatsapp_sent: whatsAppSuccess, push_sent: pushSuccess })
                .eq('id', reminder.id);
        }
    } catch (err) {
        console.error("Reminder Worker Error:", err);
    }
}

// Run every minute (60000 ms)
console.log("🚀 Reminder Worker started. Checking every minute...");
setInterval(checkAndSendReminders, 60000);
checkAndSendReminders(); // Run immediately once
