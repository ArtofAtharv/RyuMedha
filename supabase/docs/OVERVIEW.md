# Supabase Overview

Supabase provides the complete backend infrastructure for Ryu Medha: database, authentication, serverless Edge Functions, and REST API.

## What is Supabase?

Supabase is a backend-as-a-service (BaaS) combining:
- **PostgreSQL Database** — Relational data with RLS security
- **PostgREST API** — Auto-generated REST endpoints
- **Edge Functions** — Serverless compute (Deno runtime)
- **Authentication** — JWT-based user auth
- **Real-time** — WebSocket subscriptions

## Core Components

### 1. PostgreSQL Database
20+ tables with Row Level Security (RLS) for multi-user isolation.

**Key Tables:** profiles, subjects, attendance_logs, study_timers, tasks, grades, otp_codes, bot_sessions, whatsapp_message_logs, whatsapp_window_status

### 2. Edge Functions (Deno)
| Function | Purpose | Trigger |
|----------|---------|---------|
| whatsapp-webhook | Receive/process messages from Meta | HTTP POST |
| whatsapp-bot | Alternative bot processor | HTTP |
| whatsapp-engagement | Send engagement messages | Cron (hourly) |
| auth | Generate/verify OTP | HTTP |
| send-reminders | Send reminders | Cron (daily) |

### 3. PostgREST API
Auto-generated REST API from PostgreSQL schema. Used by Next.js frontend and Edge Functions.

### 4. Authentication
- JWT tokens (Authorization header)
- RLS policies enforce JWT user = row owner
- User phone in JWT 'sub' claim

## Technology Stack
| Layer | Technology |
|-------|-----------|
| Serverless | Deno + Edge Functions |
| API | PostgREST |
| Database | PostgreSQL 14+ |
| Security | RLS |
| Auth | JWT + HMAC-SHA256 |

## Performance
| Metric | Value |
|--------|-------|
| Query Latency | 10-50ms |
| Function Cold Start | 500-1500ms |
| Function Warm | <100ms |
| Users | 10,000+ DAU |

---

**Setup:** [QUICK_START.md](./QUICK_START.md) | **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
