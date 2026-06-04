# Background Jobs

Background tasks are handled by Supabase `pg_cron` which invokes Edge Functions.
- `whatsapp-engagement`: Scans for inactive users and sends them a message via Meta API.
- `send-reminders`: Can act as a scheduler to send periodic reminders.
