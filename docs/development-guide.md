# Development Guide

## Local Setup
1. Clone the repository.
2. Ensure you have Node.js and npm installed.
3. For the web interface, navigate to `web/`, run `npm install`, and `npm run dev`.
4. For the bot, navigate to `bot/`, run `npm install`. You will need to expose your local port (e.g., via Cloudflare Tunnels) and configure the Meta Developer Portal to point to your tunnel URL.

## Authentication
Authentication is handled via WhatsApp OTP. Ensure the `supabase/functions/auth/` edge function is deployed and correctly configured with your WhatsApp API keys to send OTPs for local testing.
