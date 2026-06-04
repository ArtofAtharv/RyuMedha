# Deployment Flow

- **Database**: Apply `ULTIMATE_CONSOLIDATED_SCHEMA.sql`.
- **Edge Functions**: Deploy using `npx supabase functions deploy`.
- **Web**: Hosted on Vercel or Node.js server. Requires `NEXT_PUBLIC_SUPABASE_URL` and anon key.
- **Bot**: Hosted on a long-running Node.js process (PM2/systemd) with `.env` configured for Supabase Service Role and Meta API keys.
