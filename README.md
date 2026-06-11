# 📚 Ryu Medha

> A comprehensive study assistant and academic analytics platform with real-time WhatsApp integration.

Ryu Medha helps students track attendance, manage study sessions, organize tasks, and receive intelligent reminders—all via an intuitive web dashboard and WhatsApp bot.

---

## ✨ Features

- **📊 Academic Dashboard** — Track attendance, grades, study progress
- **⏱️ Study Timer** — Log study sessions with automatic tracking
- **📋 Task Management** — Create, organize, and complete academic tasks
- **🤖 WhatsApp Bot** — Interact with the system via natural WhatsApp messages
- **🔔 Smart Reminders** — Automatic reminders for pending tasks and attendance
- **📈 Analytics** — Visualize academic performance and trends
- **🔐 Secure** — Row Level Security (RLS) enforced at database level

---

## 🏗️ Architecture

```
Ryu Medha/
├── web/                    Next.js 15+ web dashboard
├── supabase/               Backend infrastructure
│   ├── functions/          5 Edge Functions (Deno)
│   │   ├── whatsapp-webhook    (Message processor)
│   │   ├── whatsapp-bot        (Alternative processor)
│   │   ├── whatsapp-engagement (Proactive messaging)
│   │   ├── auth                (OTP verification)
│   │   └── send-reminders      (Scheduled tasks)
│   ├── docs/               Comprehensive backend documentation
│   └── ULTIMATE_CONSOLIDATED_SCHEMA.sql
└── docs/                   Project documentation (5 categories)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase CLI
- Git

### Setup Web Dashboard

```bash
cd web
npm install
npm run dev
```

Web dashboard runs on `http://localhost:3000`

### Setup Supabase Backend

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_ID

# Apply database schema
supabase db push -f ULTIMATE_CONSOLIDATED_SCHEMA.sql

# Deploy Edge Functions
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-engagement
supabase functions deploy auth
supabase functions deploy send-reminders
```

---

## 📖 Documentation

### For New Developers
Start here: [`supabase/docs/QUICK_START.md`](supabase/docs/QUICK_START.md) (5-minute setup)

### For Backend Development
- **[Architecture Guide](supabase/docs/ARCHITECTURE.md)** — System design and data flows
- **[Database Reference](supabase/docs/DATABASE.md)** — Complete schema with 20+ tables
- **[Edge Functions](supabase/docs/EDGE_FUNCTIONS.md)** — All 5 functions documented
- **[Data Workflows](supabase/docs/WORKFLOWS.md)** — Message processing, onboarding, debugging

### For DevOps/SRE
- **[Dependencies](supabase/docs/DEPENDENCIES.md)** — Versions and update procedures
- **[File Structure](supabase/docs/FILES.md)** — Project organization
- **[Index](supabase/docs/INDEX.md)** — Complete navigation hub

### Main Project Docs
See [`docs/`](docs/) directory:
- Getting started guides
- Architecture documentation
- Database design
- Deployment procedures
- Troubleshooting

---

## 🏢 Repository Structure

| Directory | Purpose |
|-----------|---------|
| `web/` | Next.js 15+ web dashboard (React, TypeScript, Tailwind) |
| `supabase/` | Backend infrastructure |
| `supabase/functions/` | 5 Edge Functions (Deno serverless) |
| `supabase/docs/` | 9 comprehensive backend guides (1,354 lines) |
| `docs/` | Main project documentation (5 categories) |
| `docs/getting-started/` | Setup and onboarding guides |
| `docs/architecture/` | System design documents |
| `docs/database/` | Database schema & design |
| `docs/deployment/` | Bot features, data flows, deployment |
| `docs/reference/` | Glossary and technical reference |

---

## 🔑 Key Technologies

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15+, React, TypeScript, Tailwind CSS |
| **Backend API** | Supabase PostgREST (auto-generated REST) |
| **Database** | PostgreSQL 14+ with Row Level Security (RLS) |
| **Serverless** | Deno Edge Functions (Supabase) |
| **Authentication** | JWT + OTP verification |
| **External API** | Meta WhatsApp Cloud API |
| **Messaging** | WhatsApp Business API integration |

---

## 🔄 Development Workflow

### Local Development

```bash
# Terminal 1: Start web app
cd web && npm run dev

# Terminal 2: Start Supabase locally
supabase start

# Terminal 3: Deploy functions locally
supabase functions serve
```

### Testing Edge Functions

```bash
# Test whatsapp-webhook locally
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{...webhook payload...}'
```

### Deploying

```bash
# Deploy web dashboard
cd web && npm run build && vercel deploy

# Deploy Edge Functions
supabase functions deploy whatsapp-webhook
supabase functions deploy auth
# ... deploy other functions
```

---

## 📊 Database Overview

**20+ core tables:**
- `profiles` — User accounts
- `subjects` — Academic/personal subjects
- `attendance_logs` — Class attendance
- `study_timers` — Study sessions
- `tasks` — To-do items
- `grades` — Academic grades
- `otp_codes` — OTP tokens
- `whatsapp_message_logs` — Message audit trail
- And more...

**Security:** All tables use Row Level Security (RLS) to ensure users only access their own data.

See [Database Reference](supabase/docs/DATABASE.md) for complete schema.

---

## 🤖 WhatsApp Bot Features

The bot handles 8+ intents via natural language processing:

- **📈 Stats** — View attendance, grades, progress
- **👤 Profile** — Manage profile information
- **📚 Subjects** — Add/remove subjects
- **✅ Tasks** — Create, complete, list tasks
- **⏱️ Timers** — Start/stop study timers
- **📍 Attendance** — Mark attendance
- **🆘 Help** — Get bot commands
- **🎯 Categories** — Manage task categories

Example interactions:
```
User: "I attended Math"
Bot: "✅ Marked present for Math. You can skip 3 more classes."

User: "How much time did I study today?"
Bot: "You studied 2 hours 30 minutes today."

User: "Create task: Finish project"
Bot: "📝 Task created: Finish project"
```

---

## 🔐 Security

- **JWT Authentication** — Secure token-based auth
- **Row Level Security** — Database-enforced data isolation
- **Encrypted OTP** — Secure phone verification
- **HTTPS Only** — All communications encrypted
- **Rate Limiting** — Protection against abuse
- **Environment Variables** — Secret keys never committed

---

## 📈 Performance

| Metric | Target |
|--------|--------|
| Database Query | 10-50ms |
| API Response | <200ms |
| Function Cold Start | 500-1500ms |
| Function Warm | <100ms |
| Page Load | <2s |

---

## 🛠️ Troubleshooting

**Issue:** Edge Function not responding
- Check: `supabase functions list`
- Logs: Supabase Dashboard → Functions → [Function Name] → Logs

**Issue:** RLS policy denying access
- Check: JWT token is valid
- Verify: User phone number in `profiles` table
- Debug: Try query with admin client

**Issue:** WhatsApp messages not received
- Check: Webhook URL is correct
- Verify: Meta webhook token matches
- Logs: [whatsapp_message_logs](supabase/docs/DATABASE.md) table

See [Troubleshooting Guide](docs/troubleshooting.md) for more.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes with tests
3. Follow existing code style
4. Create a pull request

---

## 📝 License

[Add your license here]

---

## 📞 Support

- **Documentation:** See [docs/](docs/) and [supabase/docs/](supabase/docs/)
- **Issues:** GitHub Issues
- **Questions:** [Contact information]

---

## 📌 Quick Links

- 🚀 [Quick Start Guide](supabase/docs/QUICK_START.md)
- 🏗️ [Architecture](supabase/docs/ARCHITECTURE.md)
- 📚 [Database Schema](supabase/docs/DATABASE.md)
- ⚡ [Edge Functions](supabase/docs/EDGE_FUNCTIONS.md)
- 🔄 [Workflows](supabase/docs/WORKFLOWS.md)
- 📖 [Full Documentation Index](supabase/docs/INDEX.md)

---

**Last Updated:** June 2026 | **Version:** 1.0 | **Status:** ✅ Production Ready