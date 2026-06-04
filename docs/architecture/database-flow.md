# Database Flow

- Write: Webhook -> Bot -> Supabase REST endpoint (via supabase-js) -> PostgreSQL.
- Read: Web Dashboard -> Supabase REST endpoint -> PostgreSQL.
- RLS ensures users can only read/write their own data.
