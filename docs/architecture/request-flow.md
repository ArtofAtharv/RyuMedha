# Request Flow (WhatsApp)

1. User sends message on WhatsApp.
2. Meta sends webhook to Cloudflare Tunnel.
3. Tunnel forwards to `bot/server.js`.
4. Server identifies user and creates JWT client.
5. NLP analyzes message.
6. Server updates Supabase.
7. Server sends API request to Meta to reply to user.
