# Project Files & Directory Structure

## Root Supabase Directory

```
supabase/
├── docs/                              (Documentation - 9 files)
│   ├── INDEX.md                       (Navigation hub)
│   ├── QUICK_START.md                 (5-min setup guide)
│   ├── OVERVIEW.md                    (System overview)
│   ├── ARCHITECTURE.md                (System architecture)
│   ├── DATABASE.md                    (Schema reference)
│   ├── EDGE_FUNCTIONS.md              (Functions guide)
│   ├── WORKFLOWS.md                   (Data flows)
│   ├── FILES.md                       (This file)
│   ├── DEPENDENCIES.md                (Package info)
│   └── VULNERABILITIES.md             (Security notes)
│
├── functions/                         (Serverless Edge Functions)
│   ├── whatsapp-webhook/              (Main message processor)
│   ├── whatsapp-bot/                  (Alternative processor)
│   ├── whatsapp-engagement/           (Engagement messaging)
│   ├── auth/                          (OTP authentication)
│   └── send-reminders/                (Scheduled reminders)
│
├── package.json                       (Node.js dependencies)
├── README.md                          (README)
├── ULTIMATE_CONSOLIDATED_SCHEMA.sql   (Full database schema)
├── RYU_MEDHA_MASTER_SCHEMA.sql        (Master schema)
├── nlp_updated.ts                     (NLP implementation)
├── processor_updated.ts               (Message processor)
└── (Other migration/config files)
```

## functions/ Directory

### whatsapp-webhook/ (Main Bot Function)

**Purpose:** Receive and process incoming WhatsApp messages from Meta

**Files:**
- `index.ts` — Webhook entry point, request validation, response handling
- `processor.ts` — Intent routing and handler execution
- `nlp.ts` — NLP intent detection (Compromise library)
- `messages.ts` — Pre-defined message templates
- `setup.ts` — Onboarding workflow state machine
- `db.ts` — Database utilities and RLS-scoped queries
- `deno.json` — Dependencies configuration

**Key Dependencies:**
- @supabase/supabase-js — Supabase client
- compromise — NLP library for intent parsing

**Entry Point:** Receives POST requests from Meta Webhook URL

### whatsapp-bot/ (Alternative Processor)

**Purpose:** Alternative bot processor for testing or A/B testing

**Files:**
- Same structure as whatsapp-webhook/
- Can be configured to handle different intents or use different NLP models

### whatsapp-engagement/

**Purpose:** Send proactive engagement messages to inactive users

**Files:**
- `index.ts` — Main engagement logic

**Triggers:**
- Cron job hourly
- Manual HTTP call

**Modes:** auto (closing_soon users), manual (single user), daily (all users)

### auth/

**Purpose:** OTP generation and verification for web dashboard login

**Files:**
- `index.ts` — OTP and JWT logic

**Actions:**
- `?action=request` — Generate and send OTP
- `?action=verify` — Validate OTP and return JWT

**Rate Limiting:** 3 OTP per 10 minutes per phone

### send-reminders/

**Purpose:** Send scheduled reminders via cron jobs

**Files:**
- `index.ts` — Reminder scheduling and sending logic

**Triggers:**
- Cron job daily
- Cron job hourly

**Types:** pending_tasks, attendance, study_goals

## Schema Files

### ULTIMATE_CONSOLIDATED_SCHEMA.sql

**Size:** ~2000 lines

**Contains:**
- All 20+ table definitions
- Foreign key constraints
- RLS policies for all tables
- Indexes on key columns
- Triggers for automatic timestamps
- Custom functions for utility operations

**Structure:**
1. Extension activation (uuid-ossp, pg_cron)
2. Enum types definition
3. Base tables (profiles, subjects, etc.)
4. Reference tables (universities, programs, etc.)
5. Log tables (whatsapp_message_logs, etc.)
6. RLS policies (20+ policies)
7. Indexes (15+ indexes)
8. Triggers (automatic created_at, updated_at)

### RYU_MEDHA_MASTER_SCHEMA.sql

**Purpose:** Master schema definition (may be superceded by ULTIMATE_CONSOLIDATED_SCHEMA.sql)

## Migration Files

### Migration SQL Files
- `fix_otp_schema.sql` — OTP table schema fixes
- `reminders_migration.sql` — Reminders table migration
- `whatsapp_tracking_migration.sql` — WhatsApp tracking tables
- `sqlfile.sql` — General SQL utilities

**Usage:**
```bash
# Apply migration to local Supabase
supabase db push -f migration_file.sql

# Or manually in Supabase Dashboard SQL Editor
# Copy and paste migration content
```

## TypeScript Files

### nlp_updated.ts

**Purpose:** NLP intent detection logic

**Exports:**
- Intent dictionary with keywords
- Intent matching function
- Text preprocessing utilities

**Used by:** whatsapp-webhook and whatsapp-bot functions

### processor_updated.ts

**Purpose:** Message processing and handler routing

**Exports:**
- Message processor function
- Intent handlers (stats, attendance, etc.)
- Response formatter

**Used by:** whatsapp-webhook function

### processor_webhook_updated.ts

**Purpose:** Webhook-specific processing logic

**Used by:** whatsapp-webhook function

## Configuration Files

### package.json

**Purpose:** Project metadata and dependencies

**Key Dependencies:**
- @supabase/supabase-js@^2.x
- compromise@14.x
- Other utilities

**Scripts:**
```bash
npm install        # Install dependencies
npm run dev        # Local development (uses supabase functions serve)
npm run build      # Build for deployment
```

### deno.json (in each function directory)

**Purpose:** Deno configuration for Edge Functions

**Imports:**
```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2",
    "compromise": "npm:compromise@^14"
  }
}
```

## Documentation Files

### INDEX.md
- Navigation hub
- Role-based guides (dev, DevOps, LLM)
- Common task links

### QUICK_START.md
- 5-minute setup guide
- Prerequisites
- Step-by-step instructions

### OVERVIEW.md
- High-level system overview
- Technology stack
- Performance metrics

### ARCHITECTURE.md
- System layers and interactions
- Data flow diagrams
- Security architecture
- Component interactions

### DATABASE.md
- Schema documentation
- Table descriptions
- RLS policies
- Common queries

### EDGE_FUNCTIONS.md
- Function reference
- API documentation
- Environment variables
- Deployment guide

### WORKFLOWS.md
- Message processing flow
- Onboarding flow
- Cron job flows
- Debugging workflows

### DEPENDENCIES.md
- Package versions
- Version constraints
- Update procedures

## Naming Conventions

**Directories:** kebab-case (whatsapp-webhook, send-reminders)

**Files:** snake_case for utilities (nlp_updated.ts), camelCase for classes/functions

**Functions:** Descriptive with purpose (sendMessage, getUserProfile, parseIntent)

**Variables:** camelCase for local, UPPER_CASE for constants

**Database Tables:** snake_case (attendance_logs, otp_codes)

**Table Columns:** snake_case (whatsapp_number, created_at)

---

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) | [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) | [INDEX.md](./INDEX.md)
