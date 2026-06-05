# Development Guide

## Local Setup

1. Clone the repository.
2. Ensure you have Node.js and npm installed.
3. For the web interface, navigate to `web/`, run `npm install`, and `npm run dev`.
4. For Supabase, install the CLI and configure your project.

## Authentication

Authentication is handled via Supabase OTP. Ensure the `supabase/functions/auth/` edge function is deployed and configured correctly with your WhatsApp API keys.
