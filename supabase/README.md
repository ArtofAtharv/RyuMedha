# Supabase Directory

## Purpose
Contains all database schemas, migrations, and serverless Edge Functions for the Ryu Medha platform.

## Responsibilities
- Defining the single source of truth for the database schema.
- Enforcing security via Row Level Security (RLS) policies.
- Hosting Edge Functions for background tasks (reminders, engagement) and alternative webhook handlers.

## Architecture
PostgreSQL database hosted on Supabase. Edge Functions are written in TypeScript and run on Deno. `pg_cron` is used for scheduled tasks.

## Important Files
- `ULTIMATE_CONSOLIDATED_SCHEMA.sql`: The primary schema definition.
- `functions/whatsapp-engagement/`: Background job for user engagement.
- `functions/auth/`: Handles OTP generation and validation.
- `functions/whatsapp-webhook/`: Alternative/experimental webhook handler.

## Related Systems
- The foundational layer for both the `bot/` and `web/` applications.
