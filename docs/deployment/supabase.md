# Supabase Deployment

Supabase hosts the PostgreSQL database, Row Level Security policies, and serverless Edge Functions.

## Database Setup

### 1. Initialize Supabase Project

```bash
supabase start  # Local development
# OR
supabase link   # Connect to remote project
```

### 2. Apply Database Schema

Apply the consolidated schema:

```bash
supabase db push
# This applies supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql
```

Or manually execute in Supabase SQL Editor:

```bash
cat supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql | psql
```

### 3. Enable Row Level Security (RLS)

All tables should have RLS enabled with policies:

- **profiles** → Users see only their own row
- **subjects** → Users see only their own subjects
- **attendance_logs** → Users see only their own attendance
- **tasks**, **grades**, **study_timers** → Same pattern

Policies use the JWT `sub` claim (phone number) to identify users.

## Edge Functions Deployment

### 1. Set Environment Variables

In Supabase Dashboard → Function Settings:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<public_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<secret_for_jwt_generation>
WHATSAPP_TOKEN=<meta_api_token>
WHATSAPP_PHONE_NUMBER_ID=<meta_phone_id>
WA_VERIFY_TOKEN=<custom_webhook_verification_token>
WEBSITE_URL=https://ryumedha.in
```

### 2. Deploy Functions

```bash
# Deploy individual function
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-engagement
npx supabase functions deploy auth

# Deploy all
npx supabase functions deploy --no-verify-jwt
```

### 3. Configure Webhook in Meta Developer Portal

- Go to Meta Developer Portal → WhatsApp → Configuration
- Set Webhook URL to: `https://<project>.supabase.co/functions/v1/whatsapp-webhook`
- Set Verify Token: (use same as `WA_VERIFY_TOKEN`)
- Subscribe to: `messages`, `message_status`

## Database Monitoring

### Monitor Performance

In Supabase Dashboard → Database:
- Check query execution times
- Monitor slow queries using `pg_stat_statements`
- Optimize indexes as needed

### Backup & Recovery

- Supabase provides daily automated backups (7-day retention)
- Manual backups: Dashboard → Settings → Backups
- Point-in-time recovery available within backup window

## Edge Function Monitoring

### View Logs

Supabase Dashboard → Edge Functions → [Function Name] → Logs

### Monitor Invocations

- Check success/error rates
- Monitor execution duration
- View memory usage and CPU

## Security Best Practices

### Key Management

- **Service Role Key**: Never expose to frontend; use only in edge functions
- **Anon Key**: Safe for frontend; enforced by RLS
- **JWT Secret**: Keep secure; used to generate user-scoped JWTs

### Rate Limiting

- Configure rate limits in Edge Function code
- OTP requests: Max 3 per 10 minutes per phone
- Engagement messages: Max 1 per 2 hours per user

### Data Protection

- Enable encryption at rest (Supabase default)
- Use HTTPS only (automatic)
- RLS policies prevent unauthorized data access
- Audit logging: All changes logged in `audit.logged_actions`

## Cost Optimization

- **Database**: Included in Supabase tier; scales automatically
- **Edge Functions**: Charged per invocation (~$0.000004 per execution)
- **Bandwidth**: Included in tier; egress charges for large exports

### Cost Reduction Tips

- Cache frequently accessed data
- Batch operations to reduce function invocations
- Use appropriate indexes for common queries
- Archive inactive user data periodically
