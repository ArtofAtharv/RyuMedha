import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { processMessage } from "./processor.ts";
import { sendDailyAttendanceReminders } from "./reminder.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN");
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN");

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

if (!WA_TOKEN) {
  console.warn("⚠️ Warning: WHATSAPP_TOKEN is not set. Outgoing messages will fail.");
}
if (!WA_PHONE_ID) {
  console.warn("⚠️ Warning: WHATSAPP_PHONE_NUMBER_ID is not set. Outgoing messages will fail.");
}

async function sendWhatsAppMessage(to: any, content: any) {
  const url = `https://graph.facebook.com/v17.0/${WA_PHONE_ID}/messages`;
  const body: any = {
    messaging_product: "whatsapp",
    to
  };
  if (typeof content === "string") {
    body.type = "text";
    body.text = {
      body: content
    };
  } else {
    // Transparent wrapper for interactive messages (buttons, lists)
    body.type = "interactive";
    body.interactive = content;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WA_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    console.error("❌ WhatsApp Send Error:", await res.text());
  }
}

serve(async (req)=>{
  const url = new URL(req.url);
  // --- Webhook Verification (GET) ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook Verified!");
      return new Response(challenge, {
        status: 200
      });
    }

    // --- Manual/Cron Trigger for Daily Reminders ---
    if (url.searchParams.get("trigger") === "daily") {
      try {
        await sendDailyAttendanceReminders();
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    return new Response("Forbidden", {
      status: 403
    });
  }
  // --- Message Handling (POST) ---
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // [TRACKING LOGIC - ADDED LOCALLY]
      if (value?.statuses) {
        for (const status of value.statuses) {
          const wa_message_id = status.id
          const currentStatus = status.status 
          const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString()
          let updateData: any = { status: currentStatus, updated_at: timestamp }
          if (status.errors) updateData.error_message = JSON.stringify(status.errors)
          await supabaseAdmin.from('whatsapp_message_logs').update(updateData).eq('wa_message_id', wa_message_id)
        }
      }

      const message = value?.messages?.[0];
      if (message) {
        let phone = message.from;
        if (phone && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }

        // [WINDOW TRACKING - ADDED LOCALLY]
        const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString()
        await supabaseAdmin.from('profiles').update({ last_user_message_at: timestamp }).or(`whatsapp_number.eq.${phone},whatsapp_number.eq.${message.from}`)

        const isInteractive = !!(message.button?.text || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id);
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;
        
        if (text) {
          console.log(`📩 [${phone}] (interactive: ${isInteractive}): ${text}`);
          const reply = await processMessage(phone, text, { isInteractive });
          if (Array.isArray(reply)) {
            for (const r of reply) {
              await sendWhatsAppMessage(phone, r);
            }
          } else if (reply) {
            await sendWhatsAppMessage(phone, reply);
          }
        }
      }
      return new Response("OK", {
        status: 200
      });
    } catch (err) {
      console.error("❌ Webhook Handling Error:", err);
      return new Response("Internal Server Error", {
        status: 500
      });
    }
  }
  return new Response("Method Not Allowed", {
    status: 405
  });
});
