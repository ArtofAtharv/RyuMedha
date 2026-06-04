# Service Interactions

1. WhatsApp user talks to Meta.
2. Meta sends webhooks to `bot` (via Cloudflare tunnel).
3. `bot` processes text using NLP and reads/writes to `supabase`.
4. Hourly cron on `supabase` triggers `whatsapp-engagement` edge function.
5. Web client connects to `supabase` directly using REST/GraphQL via Supabase JS client.
