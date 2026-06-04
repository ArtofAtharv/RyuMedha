# Supabase Dependencies

## Core Systems
- **PostgreSQL**: The underlying relational database engine.
- **PostgREST**: Automatically exposes RESTful APIs based on the PostgreSQL schema.
- **pg_cron**: A PostgreSQL extension used to schedule cron jobs directly inside the database (used for the hourly engagement scan).
- **uuid-ossp**: Extension enabled in `ULTIMATE_CONSOLIDATED_SCHEMA.sql` to generate UUIDv4 primary keys.

## Edge Functions Framework
- **Deno**: The JavaScript/TypeScript runtime used to execute Supabase Edge Functions. It is selected for its security model and fast cold start times.
- **std/http/server.ts**: Deno standard library used to handle incoming HTTP requests to edge functions.
- **supabase-js**: Used within the edge functions to interact back with the database.
