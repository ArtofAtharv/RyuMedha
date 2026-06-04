# Repository Overview

This repository contains the source code for Ryu Medha, a WhatsApp-based study tracking platform. It unifies a conversational bot interface built with Node.js and an analytical dashboard built with Next.js, all backed by a Supabase PostgreSQL database.

## Major Systems
- **Bot**: Found in `bot/`, processes WhatsApp messages.
- **Web**: Found in `web/`, provides the user interface.
- **Supabase**: Found in `supabase/`, handles database schemas and serverless functions for background jobs and webhooks.

## Responsibilities
- The Bot is responsible for fast, low-friction data entry (starting timers, logging tasks, checking stats).
- The Web interface is responsible for deep data visualization (charts, grading analysis, attendance tracking).
- Supabase is the central nervous system, holding state and enforcing security (RLS).
