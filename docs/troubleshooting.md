# Troubleshooting

## Common Issues

### Webhooks Not Receiving Messages
- Verify that your Cloudflare tunnel is running and the URL matches the Meta Developer Portal.
- Check `bot/server.js` logs for incoming requests. Ensure the `VERIFY_TOKEN` matches.

### RLS Errors (Row Level Security)
- When interacting with the database from the bot, ensure you are creating a JWT-scoped client using `getUserClient(phone)` rather than using the `supabaseAdmin` client. The admin client should only be used for profile creation.

### Database Schema Mismatches
- Ensure your local or remote Supabase instance matches `supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql`.
