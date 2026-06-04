1. **Repository Summary**: Ryu Medha is a WhatsApp-based academic tracker with a Node.js bot and Next.js web frontend, backed by Supabase.
2. **Architecture Summary**: Webhook-driven bot (NLP.js), Next.js dashboard, Supabase PostgreSQL with RLS and Edge Functions.
3. **Service Inventory**: `bot` (webhook listener), `web` (Next.js UI), `supabase edge functions` (background tasks, auth).
4. **Database Inventory**: `profiles`, `subjects`, `study_timers`, `tasks`, `attendance_logs`, `grades`, `otp_codes`.
5. **Documentation Coverage Report**: Complete. Includes architecture, database, directories, workflows, tech debt, and legacy analysis.
6. **Legacy System Summary**: Duplicated bots (`production-bot`, `testing-bot`) and duplicate web apps (`web-clone`, `web-legacy`).
7. **Technical Debt Summary**: Heavy duplication across bot and web directories, missing standardized migration system.
8. **Recommended Future Structure**: Move to an `apps/` monorepo structure (e.g. Turborepo), merge bot configurations, and remove duplicate web folders.
9. **Recommended Branching Strategy**: standard GitFlow (`main`, `develop`, `feature/*`, `hotfix/*`).
