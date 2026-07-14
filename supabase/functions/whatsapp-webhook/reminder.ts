import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN");

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function sendDailyAttendanceReminders() {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, whatsapp_number')
    .not('whatsapp_number', 'is', null);

  if (error) throw error;

  console.log(`🤖 Sending daily attendance reminders to ${profiles.length} users...`);

  for (const profile of profiles) {
    const firstName = profile.display_name?.split(' ')[0] || "there";
    const message = `Hey ${firstName}! 🎓 It's 4 PM. Did you attend your lectures today?

Reply with *'Log'* to update your attendance here, or use your dashboard: https://ryumedha.vercel.app/dashboard`;

    await fetch(`https://graph.facebook.com/v17.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WA_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: profile.whatsapp_number,
        type: "text",
        text: { body: message }
      })
    });

    await supabaseAdmin.from('whatsapp_message_logs').insert({
      profile_id: profile.id,
      body: message,
      message_type: 'reminder_daily_attendance'
    });
  }
}
