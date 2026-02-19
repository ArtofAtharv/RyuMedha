// supabase/functions/send-otp/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')!
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function successResponse(message: string) {
  return new Response(
    JSON.stringify({ success: true, message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone_number } = await req.json()

    if (!phone_number) {
      return errorResponse('phone_number is required', 400)
    }

    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('whatsapp_number', phone_number)
      .single()

    // If not registered, tell them to sign up via WhatsApp
    // We do NOT return a different status code — avoids phone enumeration
    if (!profile) {
      return successResponse(
        'not_registered'
        // The Next.js side will show: "Please send a message to our WhatsApp bot first to register."
      )
    }

    // Rate limit: max 3 OTP sends per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recentOtp } = await supabase
      .from('otp_codes')
      .select('last_sent_at, attempts')
      .eq('whatsapp_number', phone_number)
      .single()

    if (recentOtp && recentOtp.last_sent_at > tenMinutesAgo && recentOtp.attempts >= 3) {
      return errorResponse('Too many OTP requests. Please wait 10 minutes before trying again.', 429)
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min expiry

    // Upsert OTP record — reset attempts if last send was over 10 min ago
    const isNewWindow = !recentOtp || recentOtp.last_sent_at <= tenMinutesAgo
    const { error: otpError } = await supabase
      .from('otp_codes')
      .upsert({
        whatsapp_number: phone_number,
        code: otp,
        expires_at: expiresAt,
        used: false,
        attempts: isNewWindow ? 1 : (recentOtp?.attempts ?? 0) + 1,
        last_sent_at: new Date().toISOString()
      })

    if (otpError) {
      console.error('OTP save error:', otpError)
      return errorResponse('Failed to generate OTP. Please try again.', 500)
    }

    // Send OTP via WhatsApp
    const waResponse = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone_number,
          type: 'text',
          text: {
            body: `🔐 Your RyuMedha login code: *${otp}*\n\nExpires in 5 minutes.\nDo not share this with anyone.`
          }
        })
      }
    )

    if (!waResponse.ok) {
      const err = await waResponse.json()
      console.error('WhatsApp API error:', err)
      return errorResponse('Failed to send WhatsApp message. Please try again.', 500)
    }

    return successResponse('otp_sent')

  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse('Internal server error', 500)
  }
})
