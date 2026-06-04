# Technical Debt Analysis

Based on repository inspection, the following technical debt items have been identified:

## Duplicate Code & Repeated Logic
- **Bot Directories**: The directories `bot/`, `production-bot/`, and `testing-bot/` contain nearly identical code. Maintaining these as separate directories rather than using environment variables (`NODE_ENV`) leads to code duplication and drift.
- **Web Directories**: The directories `web/`, `web-legacy/`, and `web-clone/` contain duplicate Next.js applications. The primary application appears to be `web/`.

## Architecture Concerns
- **Webhook Processing**: Webhook processing logic appears to exist both in the Node.js application (`bot/server.js`) and in Supabase Edge Functions (`supabase/functions/whatsapp-webhook/`). It is unclear which is the definitive source of truth in production without checking live routing configurations.

## Missing Documentation
- While there are detailed markdown files for product requirements (`PRD_RyuMedha.md`), inline code documentation and API definitions within the frontend and backend are sparse.

## Configuration Duplication
- `package.json` and `package-lock.json` are duplicated across the bot and web directories, making dependency updates tedious.
