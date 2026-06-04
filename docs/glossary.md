# Glossary

- **RLS (Row Level Security)**: PostgreSQL feature used to restrict data access based on the user's identity (in this case, tied to their WhatsApp number via JWT).
- **OTP (One-Time Password)**: A code sent via WhatsApp used to authenticate users on the web dashboard.
- **Supabase Edge Functions**: Serverless functions hosted on Supabase, used here for background tasks like auto-engagement and webhook processing.
- **NLP.js / Compromise**: Natural Language Processing libraries used by the bot to understand user intents (e.g., extracting subjects and commands from text).
