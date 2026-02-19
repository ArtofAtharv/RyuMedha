// supabase/functions/send-whatsapp-otp/index.ts
// Supabase Edge Function to generate and send OTP via WhatsApp

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { whatsappNumber } = await req.json()

    // Validate phone number
    if (!whatsappNumber || !whatsappNumber.startsWith('+')) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number. Must include country code (e.g., +91...)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if user exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Phone number not registered. Please sign up via WhatsApp bot first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Store OTP in database (expires in 5 minutes)
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 5)

    const { error: otpError } = await supabase
      .from('otp_codes')
      .upsert({
        whatsapp_number: whatsappNumber,
        code: otp,
        expires_at: expiresAt.toISOString(),
        used: false
      }, {
        onConflict: 'whatsapp_number'
      })

    if (otpError) {
      console.error('Error storing OTP:', otpError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send OTP via WhatsApp
    const whatsappToken = Deno.env.get('WHATSAPP_TOKEN')!
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!

    const message = `🔐 Your SadhyaSmriti login OTP: *${otp}*

This code expires in 5 minutes.

If you didn't request this, please ignore.`

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: whatsappNumber,
          text: { body: message }
        })
      }
    )

    if (!whatsappResponse.ok) {
      const error = await whatsappResponse.json()
      console.error('WhatsApp API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send OTP via WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`OTP sent to ${whatsappNumber}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expiresIn: 300 // 5 minutes in seconds
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
