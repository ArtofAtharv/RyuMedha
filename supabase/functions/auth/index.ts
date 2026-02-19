// supabase/functions/auth/index.ts
// Consolidates send-otp and verify-otp logic.
// Dispatch based on ?action=request or ?action=verify

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') // 'request' or 'verify'
    const body = await req.json()

    // ── Shared: Supabase Admin Client ─────────────────────────────────────────
    // Used for DB operations (check profile, otp_codes)
    // SUPABASE_SERVICE_ROLE_KEY is auto-injected by Supabase platform
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Action: REQUEST OTP ───────────────────────────────────────────────────
    if (action === 'request') {
      const { phone_number } = body

      if (!phone_number || typeof phone_number !== 'string') {
        return json({ success: false, error: 'phone_number is required' }, 400)
      }
      if (!phone_number.startsWith('+')) {
        return json({ success: false, error: 'phone_number must include country code' }, 400)
      }

      // Check if user is registered
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', phone_number)
        .single()

      if (!profile) {
        return json({ success: true, status: 'not_registered' })
      }

      // Rate limiting: max 3 sends per 10 minutes
      const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('otp_codes')
        .select('attempts, last_sent_at')
        .eq('whatsapp_number', phone_number)
        .single()

      const inWindow = existing && existing.last_sent_at > TEN_MINUTES_AGO
      if (inWindow && existing.attempts >= 3) {
        return json({ success: false, error: 'Too many OTP requests. Wait 10 mins.' }, 429)
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      const newAttempts = inWindow ? (existing.attempts ?? 0) + 1 : 1

      const { error: upsertError } = await supabase
        .from('otp_codes')
        .upsert({
          whatsapp_number: phone_number,
          code: otp,
          expires_at: expiresAt,
          used: false,
          attempts: newAttempts,
          last_sent_at: new Date().toISOString(),
        }, { onConflict: 'whatsapp_number' })

      if (upsertError) {
        console.error('OTP upsert error:', upsertError)
        return json({ success: false, error: 'Failed to generate OTP' }, 500)
      }

      // Send via WhatsApp Cloud API
      const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
      const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')!

      const waRes = await fetch(
        `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone_number,
            type: 'text',
            text: {
              body: `🔐 Your RyuMedha login code: *${otp}*\n\nExpires in 5 minutes.`,
            },
          }),
        }
      )

      if (!waRes.ok) {
        const err = await waRes.json()
        console.error('WhatsApp API error:', err)
        return json({ success: false, error: 'Failed to send WhatsApp message' }, 500)
      }

      return json({ success: true, status: 'otp_sent', expiresIn: 300 })
    }

    // ── Action: VERIFY OTP ────────────────────────────────────────────────────
    if (action === 'verify') {
      const { phone_number, otp } = body
      const MAX_ATTEMPTS = 5

      if (!phone_number || !otp) return json({ success: false, error: 'Missing phone/otp' }, 400)

      const { data: record, error: fetchErr } = await supabase
        .from('otp_codes')
        .select('code, expires_at, used, attempts')
        .eq('whatsapp_number', phone_number)
        .single()

      if (fetchErr || !record) return json({ success: false, error: 'No OTP found' }, 400)

      if ((record.attempts ?? 0) >= MAX_ATTEMPTS) return json({ success: false, error: 'Too many attempts' }, 429)
      if (record.used) return json({ success: false, error: 'OTP already used' }, 400)
      if (new Date(record.expires_at) < new Date()) return json({ success: false, error: 'OTP expired' }, 400)

      if (record.code !== String(otp)) {
        const newAttempts = (record.attempts ?? 0) + 1
        await supabase
          .from('otp_codes')
          .update({ attempts: newAttempts })
          .eq('whatsapp_number', phone_number)
        return json({ success: false, error: `Incorrect OTP. ${MAX_ATTEMPTS - newAttempts} attempts left.` }, 400)
      }

      // Mark used
      await supabase.from('otp_codes').update({ used: true }).eq('whatsapp_number', phone_number)

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('whatsapp_number', phone_number)
        .single()

      if (!profile) return json({ success: false, error: 'User profile not found' }, 400)

      // Sign JWT
      const jwtSecret = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET')
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is missing. Please set it via: supabase secrets set JWT_SECRET=...')
      }
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(jwtSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      )

      const token = await create(
        { alg: 'HS256', typ: 'JWT' },
        {
          sub: phone_number,
          role: 'authenticated',
          iat: getNumericDate(0),
          exp: getNumericDate(7 * 24 * 60 * 60),
        },
        key
      )

      return json({
        success: true,
        token,
        phone_number,
        profile,
      })
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400)

  } catch (err) {
    console.error('Auth function error:', err)
    return json({ 
      success: false, 
      error: `Internal server error: ${err.message || err}`,
      details: String(err)
    }, 500)
  }
})
