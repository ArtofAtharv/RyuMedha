# Supabase Architecture

## System Layers

```
Web Layer (Next.js) 
    ↓ (JWT)
API Layer (PostgREST) 
    ↓ (RLS Policy Check)
Database Layer (PostgreSQL)
    ↑ (Queries)
Edge Functions (Deno)
    ↑ (supabase-js library)
Meta WhatsApp API (Incoming Webhooks)
```

## 1. Client Layer
- **Web Dashboard** (Next.js in /web/)
- **WhatsApp Users** (via Meta)
- **Mobile Apps** (future)

## 2. API Layer (PostgREST)

Auto-generated REST from PostgreSQL schema.

**Examples:**
```
GET    /rest/v1/profiles                    # List profiles
POST   /rest/v1/subjects                    # Create subject
PUT    /rest/v1/subjects?id=eq.X            # Update
DELETE /rest/v1/subjects?id=eq.X            # Delete
GET    /rest/v1/subjects?profile_id=eq.X    # Filter
```

**Features:**
- Automatic JOIN support
- Built-in filtering/sorting
- Real-time WebSocket subscriptions
- JWT authentication
- RLS policy enforcement

## 3. Edge Functions (Deno)

Serverless compute layer.

**whatsapp-webhook Flow:**
```
Incoming Message
    ↓
Extract phone, text
    ↓
NLP Intent Parse (nlp.ts)
    ↓
Route to Handler (processor.ts)
    ↓
Query Database (RLS-scoped)
    ↓
Format Response (messages.ts)
    ↓
Send via WhatsApp API
    ↓
Log to whatsapp_message_logs
```

**Characteristics:**
- Auto-scales with demand
- Cold start: 500-1500ms
- Warm: <100ms
- Logs in Supabase Dashboard

## 4. Database Layer (PostgreSQL)

20+ tables with:
- ACID transactions
- Foreign key constraints
- Row Level Security (RLS)
- Indexes for performance
- Audit logging
- Daily automated backups

**Core Tables:**
| Table | Purpose |
|-------|---------|
| profiles | User accounts |
| subjects | Study items |
| attendance_logs | Class attendance |
| study_timers | Study sessions |
| tasks | To-do items |
| grades | Academic grades |
| otp_codes | OTP tokens |
| bot_sessions | Onboarding state |
| whatsapp_message_logs | Message audit |
| whatsapp_window_status | Engagement tracking |

## Row Level Security (RLS)

**Concept:** Database-level access control

**Flow:**
1. Client sends JWT in Authorization header
2. PostgREST extracts JWT and gets user identity
3. RLS policies check if user owns the row
4. Only matching rows returned/modified

**Example:**
```sql
CREATE POLICY user_subjects ON subjects
FOR SELECT USING (
  profile_id = (
    SELECT id FROM profiles
    WHERE whatsapp_number = get_jwt_claim('sub')
  )
);
```

**Benefits:**
- Security at database level
- Impossible to bypass via API
- Consistent across all clients

## Authentication Flow

```
1. User sends phone to /auth?action=request
    ↓
2. OTP generated and sent via WhatsApp
    ↓
3. User enters OTP
    ↓
4. Client calls /auth?action=verify
    ↓
5. JWT returned (contains phone in 'sub')
    ↓
6. Client stores JWT in localStorage
    ↓
7. All requests include JWT in Authorization header
    ↓
8. PostgREST validates and extracts user identity
    ↓
9. RLS policies enforce data access
```

## Component Interactions

### Frontend → API → Database
```
Next.js → supabase-js → HTTP → PostgREST → PostgreSQL
         (sends JWT)     (with JWT)      (RLS check)
```

### Edge Function → Database
```
Edge Function → supabase-js → HTTP → PostgREST → PostgreSQL
                (admin key)    (admin) (bypasses RLS, logs to audit)
```

## Performance Architecture

### Indexes
- `profiles(whatsapp_number)` — User lookup
- `subjects(profile_id, is_active)` — Active subjects
- `attendance_logs(profile_id, subject_id, date)` — Attendance
- `study_timers(profile_id, ended_at)` — Active timers
- `tasks(profile_id, completed_at)` — Task filtering
- `otp_codes(whatsapp_number)` — OTP lookup

### Query Targets
| Operation | Target | Actual |
|-----------|--------|--------|
| Get profile | <10ms | 5-8ms |
| List subjects | <20ms | 15-20ms |
| Create attendance | <30ms | 20-25ms |
| Query stats | <50ms | 30-40ms |

## Disaster Recovery

- **Backups:** Daily (7-day retention)
- **Replication:** Synchronous hot standby
- **Failover:** Automatic (<1 min RTO)
- **Recovery:** Point-in-time to any backup

---

**Next:** [DATABASE.md](./DATABASE.md) | [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)
