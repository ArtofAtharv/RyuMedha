import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || "ryumedha_secret_token"
const waToken = Deno.env.get('WHATSAPP_TOKEN') || ""
const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ""

async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${waPhoneId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: text }
  }

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
  }
}

async function handleGetRequest(url: URL): Promise<Response> {
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
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (messages && messages.length > 0) {
      for (const message of messages) {
        const from = message.from
        if (from) {
          console.log(`📩 Message from ${from}, responding with maintenance message.`)
          await sendWhatsAppMessage(from, "The bot is under maintenance and upgrade, please visit ryumedha.in.")
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 })
  } catch (e: any) {
    console.error('Webhook Error:', e)
    return new Response('Error', { status: 500 })
  }
}

serve(async (req: Request) => {
  if (req.method === 'GET') return handleGetRequest(new URL(req.url))
  if (req.method === 'POST') return handlePostRequest(req)
  return new Response('Method Not Allowed', { status: 405 })
})
