# Repository Overview

This repository contains the source code for Ryu Medha, a study assistant and analytics dashboard with a Next.js frontend, Supabase backend with serverless bot functions, and comprehensive documentation.

## Major Systems
- **WhatsApp Bot**: Supabase Edge Functions handling WhatsApp interactions. See [Edge Functions Bot Architecture](../deployment/edge-functions-bot.md) for technical details.
- **Web Dashboard**: Next.js application in `web/`, provides analytics and management interfaces.
- **Supabase Backend**: Database, Edge Functions, and serverless bot infrastructure in `supabase/`.
- **Documentation**: Comprehensive guides in `docs/` for users, developers, and operations.

## Responsibilities
- The WhatsApp Bot is responsible for quick data entry via natural language commands
- The Web Dashboard is responsible for data visualization, analytics, and complex data management
- Supabase is the central system for state persistence, security (RLS), and background processing
- Documentation provides setup, deployment, features, and troubleshooting guides
