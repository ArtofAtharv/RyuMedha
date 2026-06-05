# Supabase Documentation Index

Welcome to the Ryu Medha Supabase backend documentation. This folder contains comprehensive documentation for developers working on the database, Edge Functions, and backend infrastructure.

## Quick Navigation

### 📋 Getting Started
- **[QUICK_START.md](./QUICK_START.md)** — 5-minute setup guide for new developers
- **[OVERVIEW.md](./OVERVIEW.md)** — High-level system overview

### 🏗️ Architecture & Design
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture and component design
- **[DATABASE.md](./DATABASE.md)** — Complete database schema, tables, relationships, RLS
- **[FILES.md](./FILES.md)** — Directory structure and file organization
- **[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)** — Edge Functions reference guide

### 🔄 Operations & Workflows
- **[WORKFLOWS.md](./WORKFLOWS.md)** — Data flows, processes, and event handling
- **[DEPENDENCIES.md](./DEPENDENCIES.md)** — External dependencies and versions

---

## Core Concepts

### Edge Functions (Serverless)
Supabase hosts serverless functions using the Deno runtime. These handle:
- **whatsapp-webhook** — Receives and processes incoming WhatsApp messages
- **whatsapp-bot** — Alternative/supplementary bot processor
- **whatsapp-engagement** — Sends proactive engagement messages
- **auth** — Generates and verifies OTP for web login
- **send-reminders** — Sends scheduled reminders

See [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) for details on each.

### Database (PostgreSQL + RLS)
- **PostgreSQL 14+** with Row Level Security enabled
- **5000+ records** of test data with live user simulation
- **RLS Policies** ensure users only access their own data via JWT
- **Indexes** on frequently queried columns for performance

See [DATABASE.md](./DATABASE.md) for complete schema.

### Data Flow
```
User Message → Meta WhatsApp API → whatsapp-webhook function 
  ↓
Parse intent (NLP) → Route to handler (processor.ts)
  ↓
Query database (RLS-enforced) ← getUserClient(phone)
  ↓
Generate response (messages.ts) → Send back via WhatsApp API
  ↓
Log interaction → whatsapp_message_logs table
```

See [WORKFLOWS.md](./WORKFLOWS.md) for detailed flows.

---

## For Different Roles

### 🆕 New Developer
1. Read [QUICK_START.md](./QUICK_START.md) — 5 minutes
2. Skim [OVERVIEW.md](./OVERVIEW.md) — Understand big picture
3. Review [DATABASE.md](./DATABASE.md) — Learn schema
4. Read [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) — Understand functions
5. Check [WORKFLOWS.md](./WORKFLOWS.md) — Understand data flows

### 🔧 Backend Developer
1. Reference [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) — Function details
2. Study [DATABASE.md](./DATABASE.md) — Schema and RLS
3. Review [WORKFLOWS.md](./WORKFLOWS.md) — Request/response flows
4. Check [DEPENDENCIES.md](./DEPENDENCIES.md) — Available libraries

### 🎯 DevOps / Deployment
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) — System overview
2. Review [FILES.md](./FILES.md) — Directory structure
3. Check [DEPENDENCIES.md](./DEPENDENCIES.md) — Version info
4. See [WORKFLOWS.md](./WORKFLOWS.md) — Cron jobs and scheduling

### 🤖 LLM / Code Generation
Use this structured documentation:
- **DATABASE.md** — For SQL understanding
- **EDGE_FUNCTIONS.md** — For function signatures and logic
- **WORKFLOWS.md** — For request/response patterns
- **ARCHITECTURE.md** — For component relationships

---

## Common Tasks

### Add a New Bot Feature
1. Review existing handler in `functions/whatsapp-bot/processor.ts`
2. Add NLP intent to `functions/whatsapp-bot/nlp.ts`
3. Implement handler function
4. Add message templates to `functions/whatsapp-bot/messages.ts`
5. Test with `supabase functions serve`
6. Deploy with `npx supabase functions deploy whatsapp-bot`

→ See [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md#adding-features)

### Query User Data
```typescript
// Always use getUserClient for RLS enforcement
const userClient = await getUserClient(phone);
const { data } = await userClient
  .from('subjects')
  .select('*')
  .eq('profile_id', user.id);
```

→ See [DATABASE.md](./DATABASE.md#row-level-security-rls)

### Add a Database Table
1. Create table in `ULTIMATE_CONSOLIDATED_SCHEMA.sql`
2. Add RLS policies
3. Add indexes for frequently queried columns
4. Deploy with `supabase db push`

→ See [DATABASE.md](./DATABASE.md#table-checklist)

### Debug a User Issue
1. Check `whatsapp_message_logs` for user's message history
2. Query `profiles` for user settings
3. Review relevant table (subjects, tasks, etc.)
4. Check Edge Function logs in Supabase Dashboard

→ See [WORKFLOWS.md](./WORKFLOWS.md#debugging)

---

## Documentation Philosophy

This documentation is designed to be:

- **Comprehensive** — No skipped details; everything documented
- **Structured** — Clear sections, consistent formatting
- **LLM-Friendly** — Structured data, examples, and code snippets
- **Practical** — Real examples from codebase
- **Linked** — Cross-references between documents
- **Up-to-Date** — Reflects current codebase state

---

## Version Info

| Component | Version |
|-----------|---------|
| Supabase | Latest |
| PostgreSQL | 14+ |
| Deno | Latest |
| Node.js (for CLI) | 18+ |

---

## Need Help?

- **Getting Started?** → Read [QUICK_START.md](./QUICK_START.md)
- **Understanding System?** → Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Writing Queries?** → Read [DATABASE.md](./DATABASE.md)
- **Creating Functions?** → Read [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)
- **Debugging?** → Read [WORKFLOWS.md](./WORKFLOWS.md)

---

**Last Updated:** June 2026 | **Status:** Current
