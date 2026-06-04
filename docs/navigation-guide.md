# Navigation Guide

## User Flow Tracing
**User Request → Frontend → Backend → Database → Worker → Deployment**

1. **User Request (WhatsApp)**: User sends a message via WhatsApp.
2. **Backend (Webhook)**: Meta sends a webhook to Cloudflare tunnel, routing to `bot/server.js` or `supabase/functions/whatsapp-webhook/`.
3. **Database**: Bot resolves intent via `bot/nlp_worker.js`, executes SQL/Supabase client operations against tables like `study_timers` or `attendance_logs`.
4. **Worker/Background Jobs**: `supabase/functions/whatsapp-engagement/` runs via `pg_cron` hourly to check for inactive users and send engagement messages.
5. **Frontend (Web)**: User requests OTP via `web/app/login/page.tsx`. OTP is verified, a NextAuth session is created, and the user accesses `web/app/dashboard/page.tsx` pulling from the same database.

See individual directory documentation for deeper navigation.
