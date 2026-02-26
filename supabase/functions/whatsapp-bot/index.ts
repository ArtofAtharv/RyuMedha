import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { processMessage } from "./processor.ts";
const VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN");
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
if (!WA_TOKEN) {
  console.warn("⚠️ Warning: WHATSAPP_TOKEN is not set. Outgoing messages will fail.");
}
if (!WA_PHONE_ID) {
  console.warn("⚠️ Warning: WHATSAPP_PHONE_NUMBER_ID is not set. Outgoing messages will fail.");
}
async function sendWhatsAppMessage(to, content) {
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
    return new Response("Forbidden", {
      status: 403
    });
  }
  // --- Message Handling (POST) ---
  if (req.method === "POST") {
    try {
      console.log("🚀 Edge Function: Received POST request");
      const payload = await req.json();
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      if (message) {
        let phone = message.from;
        if (phone && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
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
