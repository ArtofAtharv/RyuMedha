# Repository Map

- `/web` — Next.js 15+ dashboard application for analytics and management
- `/supabase` — Database, Edge Functions, and backend infrastructure
  - `functions/whatsapp-webhook/` — Main message handler from Meta/WhatsApp
  - `functions/whatsapp-bot/` — Bot processor with NLP intent detection
  - `functions/whatsapp-engagement/` — Proactive engagement messaging
  - `functions/auth/` — OTP authentication for web login
  - `ULTIMATE_CONSOLIDATED_SCHEMA.sql` — Complete database schema with RLS
- `/docs` — Comprehensive documentation
  - `deployment/` — Bot architecture and deployment guides (see edge-functions-bot.md)
  - `getting-started/` — Setup, development, and onboarding guides
  - `architecture/` — System design, navigation, and repository overview
  - `database/` — Schema, migrations, and RLS documentation
  - `reference/` — Glossary, troubleshooting, and technical debt
