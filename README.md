# Ryu Medha - Auto-Pilot Study Assistant

## Project Overview
Ryu Medha is a WhatsApp-integrated study assistant designed to track study time, manage academic attendance, monitor grades, and help students organize their tasks. The system consists of a WhatsApp bot backend and a web-based dashboard for advanced analytics.

## System Overview
The platform seamlessly bridges conversational interactions (via WhatsApp) with rich dashboard views. Users can start study timers, log attendance, and query their stats entirely through a natural language interface on WhatsApp, while accessing deep insights via the web dashboard.

## Repository Structure
- `bot/` - Core NodeJS bot application, handling WhatsApp messages and NLP processing.
- `production-bot/` - Production configuration and setup for the bot.
- `testing-bot/` - Environment for testing bot changes and new features safely.
- `web/` - NextJS frontend application providing the user dashboard and web interface.
- `web-legacy/` & `web-clone/` - Alternate/legacy versions of the web frontend.
- `supabase/` - Database schemas, migrations, Edge Functions, and database utilities.
- `docs/` - Comprehensive technical documentation for the repository.

## Applications and Services
1. **WhatsApp Bot (Node.js)**: Listens to webhooks from Cloudflare/Meta, processes user intents using NLP, interacts with Supabase, and replies to the user.
2. **Web Dashboard (Next.js)**: A frontend allowing users to log in via an OTP sent to their WhatsApp, giving them visual access to their study metrics, grades, and subjects.
3. **Supabase Backend**: Provides the PostgreSQL database, Authentication, Row Level Security (RLS) policies, and serverless Edge Functions (like auto-engagement and reminders).

## Technologies Used
- **Backend/Bot**: Node.js, NLP.js, Compromise (NLP), Supabase JS Client
- **Frontend**: Next.js 15+, React 19, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL (Supabase)
- **Infrastructure**: Cloudflare Tunnels (for webhooks), Supabase Edge Functions, Cron Jobs (pg_cron)

## Architecture Summary
The system centers around Supabase as the single source of truth. The WhatsApp Bot relies on webhooks and processes incoming text through an NLP worker to determine user intent (e.g., 'start studying math'). The NextJS frontend consumes the same Supabase database via standard client libraries, protected by JWT authentication and Row Level Security. Background jobs, handled by Supabase Edge Functions and cron, trigger reminders and engagement messages.

## Getting Started

### Local Development
1. Clone the repository.
2. Set up a Supabase project locally or connect to a remote instance.
3. Apply the database schemas located in `supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql`.
4. Configure `.env` files in both `bot/` and `web/` directories with your Supabase URL, Service Role Key (for bot setup), and Anon Key (for web).
5. For the bot: `cd bot && npm install && npm start`
6. For the web: `cd web && npm install && npm run dev`
7. Set up a Cloudflare tunnel to route WhatsApp webhook traffic to your local bot instance.

### Environment Variables
**Bot (`bot/.env`):**
- `SUPABASE_URL`: URL of the Supabase instance
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (used for webhook verification and initial user setup)
- `WHATSAPP_TOKEN`: Meta WhatsApp API token
- `WHATSAPP_PHONE_ID`: Meta WhatsApp phone ID

**Web (`web/.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `NEXTAUTH_SECRET`: Secret for NextAuth
- `NEXTAUTH_URL`: URL of the NextJS application

### Development Workflow
- Follow branch naming conventions based on the branching strategy.
- Develop frontend features in `web/` and bot features in `bot/` or `testing-bot/`.
- Validate schema changes against `supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql`.
- Test webhooks locally using Cloudflare tunnels.

### Deployment Overview
- **Web**: Can be deployed to Vercel or any Next.js compatible hosting.
- **Bot**: Should be deployed to a persistent server (like an EC2 instance or Mini-PC) with Node.js installed.
- **Edge Functions**: Deploy using Supabase CLI (`npx supabase functions deploy <function-name>`).

### Troubleshooting
- **Bot not responding**: Check the webhook URL configuration in the Meta Developer Portal and ensure the Cloudflare tunnel is active. Check `bot/server.js` logs.
- **Login OTP not arriving**: Ensure the `auth` or `whatsapp-webhook` edge functions are deployed and configured with correct WhatsApp API credentials.
- **RLS Errors**: Ensure operations originating from the bot use the JWT-scoped client once a user's phone number is identified.

### Important Directories
- **`/bot`**: Main backend logic for the WhatsApp assistant.
- **`/web`**: NextJS user-facing dashboard.
- **`/supabase`**: Contains all Edge Functions (`/supabase/functions/`) and SQL schemas.
- **`/docs`**: Automatically generated documentation.

## Documentation Index
- [Repository Overview](docs/repository-overview.md)
- [Repository Map](docs/repository-map.md)
- [Navigation Guide](docs/navigation-guide.md)
- [Development Guide](docs/development-guide.md)
- [Troubleshooting Guide](docs/troubleshooting.md)
- [Glossary](docs/glossary.md)
- [Onboarding](docs/onboarding.md)
- [Technical Debt](docs/technical-debt.md)
- [Legacy Analysis](docs/legacy-analysis.md)
- [Database Overview](docs/database/schema-overview.md)
- [Architecture Overview](docs/architecture/system-overview.md)

---

## Repository Governance

### Branching Strategy
Recommended workflow:
- `main` → production-ready code.
- `develop` → integration branch for new features.
- `feature/*` → new features and enhancements.
- `bugfix/*` → fixes for non-critical bugs found in develop/main.
- `hotfix/*` → emergency fixes for production.
- `release/*` → preparation for a new version release.

### Environment Strategy
Recommended environments:
- **Development**: Local development using a local Supabase instance or a dedicated dev project.
- **Testing**: A staging environment mirroring production, utilizing the `testing-bot/` configurations.
- **Production**: The live environment utilizing `production-bot/`.

Separation should be achieved using distinct Supabase projects and environment variables rather than hardcoding differences.

### Recommended Future Structure
**Current Structure:**
```
.
├── bot/
├── production-bot/ (duplicate logic)
├── testing-bot/ (duplicate logic)
├── web/
├── web-clone/ (duplicate)
├── web-legacy/ (duplicate)
├── supabase/
│   └── functions/
└── docs/
```

**Recommended Future Structure:**
```
.
├── apps/
│   ├── bot/ (Single source of truth for bot, parameterized by ENV)
│   └── web/ (Single source of truth for web frontend)
├── packages/
│   ├── shared-types/ (Shared TS interfaces)
│   └── database/ (Prisma/Supabase client wrappers)
├── supabase/
│   ├── functions/
│   ├── migrations/
│   └── seed.sql
├── docs/
└── .github/ (CI/CD workflows)
```
