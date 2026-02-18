# Technical Requirements Document (TRD)
## RyuMedha - WhatsApp-First Student Productivity SaaS

**Version:** 1.0  
**Last Updated:** February 16, 2026  
**Document Owner:** Atharv  
**Status:** Approved for Implementation

---

## 📋 Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Database Design](#3-database-design)
4. [API Specifications](#4-api-specifications)
5. [Security Architecture](#5-security-architecture)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [Performance Requirements](#7-performance-requirements)
8. [Testing Strategy](#8-testing-strategy)
9. [Monitoring & Observability](#9-monitoring--observability)
10. [Disaster Recovery](#10-disaster-recovery)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                          │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  WhatsApp App    │              │  Web Browser     │         │
│  │  (iOS/Android)   │              │  (Mobile/Desktop)│         │
│  └────────┬─────────┘              └────────┬─────────┘         │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │                                  │
┌───────────▼──────────────────────────────────▼──────────────────┐
│                     ENTRY POINTS                                 │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  WhatsApp Cloud  │              │  Vercel CDN      │         │
│  │  API (Meta)      │              │  (Edge Network)  │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │                                  │
┌───────────▼──────────────────────────────────▼──────────────────┐
│                     APPLICATION LAYER                            │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  WhatsApp Bot    │              │  Next.js Web App │         │
│  │  (Node.js)       │◄────JWT─────►│  (React 19)      │         │
│  │  Local/Mini-PC   │              │  (Vercel)        │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │          ┌───────────────────────┤
            │          │                       │
            │          │                       │
┌───────────▼──────────▼───────────────────────▼──────────────────┐
│                     SERVICE LAYER                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Supabase Edge   │  │  Supabase Auth   │  │  Supabase     │ │
│  │  Functions       │  │  (JWT)           │  │  Realtime     │ │
│  │  (Deno)          │  │                  │  │  (WebSocket)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            └────────────────────┴────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                     DATA LAYER                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Supabase PostgreSQL (Primary Database)                  │   │
│  │  • 14 Tables (profiles, subjects, timers, tasks, etc.)   │   │
│  │  • Row Level Security (RLS) enabled                      │   │
│  │  • Real-time subscriptions                               │   │
│  │  • Automatic backups (daily)                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Component Architecture

#### **Frontend (Next.js Web App)**
```
app/
├── (auth)/
│   ├── login/              # Phone + OTP entry
│   └── verify/             # OTP verification
├── (dashboard)/
│   ├── layout.tsx          # Sidebar navigation
│   ├── dashboard/          # Overview stats
│   ├── subjects/           # Subject CRUD
│   ├── tasks/              # Task management
│   ├── timers/             # Study timer UI
│   ├── attendance/         # Academic: Calendar view
│   ├── grades/             # Academic: Grade entry
│   └── settings/           # Profile + module toggles
├── api/
│   └── auth/
│       └── [...nextauth]/  # Auth.js endpoints
└── components/
    └── ui/                 # Shadcn components
```

#### **Backend (WhatsApp Bot)**
```
sadhyasmriti-bot/
├── src/
│   ├── index.js            # Express server
│   ├── config/
│   │   ├── supabase.js     # DB client
│   │   └── schedule.js     # Bot runtime config
│   ├── handlers/
│   │   ├── webhook.js      # WhatsApp webhook
│   │   ├── commands.js     # Command router
│   │   └── queue.js        # Offline message processing
│   ├── services/
│   │   ├── whatsapp.js     # WhatsApp API client
│   │   ├── timer.js        # Study timer logic
│   │   ├── tasks.js        # Task operations
│   │   └── stats.js        # User statistics
│   └── utils/
│       ├── jwt.js          # JWT generation
│       └── validation.js   # Input sanitization
```

#### **Edge Functions (Supabase)**
```
supabase/functions/
├── send-otp/
│   └── index.ts            # Generate & send OTP via WhatsApp
├── verify-otp/
│   └── index.ts            # Validate OTP, issue JWT
└── whatsapp-webhook/
    └── index.ts            # Alternative: Edge-based bot
```

---

### 1.3 Data Flow Diagrams

#### **Authentication Flow**
```
┌────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ User   │         │ Web App  │         │ Edge Fn  │         │ WhatsApp │
│ (Web)  │         │ (Next.js)│         │ (send-   │         │ Cloud    │
│        │         │          │         │  otp)    │         │ API      │
└───┬────┘         └─────┬────┘         └─────┬────┘         └─────┬────┘
    │ Enter phone        │                    │                     │
    │ +919876543210      │                    │                     │
    ├────────────────────>                    │                     │
    │                    │ POST /send-otp     │                     │
    │                    ├────────────────────>                     │
    │                    │ {phone_number}     │                     │
    │                    │                    │ Generate OTP        │
    │                    │                    │ (123456)            │
    │                    │                    │ Store in DB         │
    │                    │                    │ (5 min expiry)      │
    │                    │                    │                     │
    │                    │                    │ POST /messages      │
    │                    │                    ├────────────────────>│
    │                    │                    │ {to, text: "123456"}│
    │                    │                    │                     │
    │                    │                    │ 200 OK              │
    │                    │                    │<────────────────────┤
    │                    │ 200 {success}      │                     │
    │                    │<────────────────────                     │
    │ OTP sent message   │                    │                     │
    │<───────────────────┤                    │                     │
    │                    │                    │                     │
    │    Receive WhatsApp notification        │                     │
    │<──────────────────────────────────────────────────────────────┤
    │ "🔐 Your login code: 123456"            │                     │
    │                    │                    │                     │
    │ Enter OTP: 123456  │                    │                     │
    ├────────────────────>                    │                     │
    │                    │ POST /verify-otp   │                     │
    │                    ├────────────────────>                     │
    │                    │ {phone, otp}       │                     │
    │                    │                    │ Validate OTP        │
    │                    │                    │ Mark as used        │
    │                    │                    │ Generate JWT        │
    │                    │                    │ (7 day expiry)      │
    │                    │ 200 {token, phone} │                     │
    │                    │<────────────────────                     │
    │ Redirect /dashboard│                    │                     │
    │<───────────────────┤                    │                     │
    │ (JWT in session)   │                    │                     │
```

#### **Study Timer Flow**
```
┌────────┐         ┌──────────┐         ┌──────────┐
│ User   │         │ WhatsApp │         │ Bot      │
│        │         │ App      │         │ Server   │
└───┬────┘         └─────┬────┘         └─────┬────┘
    │                    │                    │
    │ Type "start python"│                    │
    ├───────────────────>│ Webhook POST       │
    │                    ├───────────────────>│
    │                    │ {from, text}       │
    │                    │                    │ Check JWT from
    │                    │                    │ phone number
    │                    │                    │
    │                    │                    │ Find subject
    │                    │                    │ matching "python"
    │                    │                    │
    │                    │                    │ Check active timer
    │                    │                    │ (none found)
    │                    │                    │
    │                    │                    │ INSERT INTO
    │                    │                    │ study_timers
    │                    │                    │ (started_at=NOW())
    │                    │                    │
    │                    │ WhatsApp response  │
    │                    │<───────────────────┤
    │                    │ "✅ Timer started" │
    │ Notification       │                    │
    │<───────────────────┤                    │
    │                    │                    │
    │                    │                    │
    │ [1 hour later]     │                    │
    │ Type "stop"        │                    │
    ├───────────────────>│ Webhook POST       │
    │                    ├───────────────────>│
    │                    │ {from, text}       │
    │                    │                    │ Find active timer
    │                    │                    │
    │                    │                    │ UPDATE study_timers
    │                    │                    │ SET ended_at=NOW()
    │                    │                    │
    │                    │                    │ Calculate duration
    │                    │                    │ (1h 3m)
    │                    │                    │
    │                    │ WhatsApp response  │
    │                    │<───────────────────┤
    │                    │ "⏹️ Duration: 1h 3m"│
    │ Notification       │                    │
    │<───────────────────┤                    │
```

---

## 2. Technology Stack

### 2.1 Frontend Stack

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Framework** | Next.js | 15+ (App Router) | Server components, streaming, built-in API routes |
| **UI Library** | React | 19.2.3 | Latest with concurrent features, RSC support |
| **Language** | TypeScript | 5.x | Type safety, better DX, catch errors at compile-time |
| **Styling** | Tailwind CSS | 4.x | Utility-first, fast, component-friendly |
| **Components** | Shadcn UI | Latest | Accessible, customizable, no runtime overhead |
| **State** | React Context + Hooks | Built-in | Simple state needs, no Redux overkill |
| **Forms** | React Hook Form | 7.x | Performance, validation, easy integration |
| **Auth** | Auth.js (NextAuth) | 5.0-beta | Custom provider support, session management |
| **Icons** | Lucide React | Latest | Consistent, tree-shakeable, open source |
| **Date Handling** | date-fns | Latest | Functional, tree-shakeable, no mutability |

**Why Next.js over alternatives?**
- ✅ Best React framework for production
- ✅ Vercel deployment is seamless
- ✅ Server components reduce client bundle
- ✅ Built-in image optimization
- ✅ API routes for edge functions fallback

**Why Shadcn over Material UI / Ant Design?**
- ✅ Copy-paste components (no package bloat)
- ✅ Full control over code
- ✅ Radix UI primitives (accessible by default)
- ✅ Tailwind-native styling

---

### 2.2 Backend Stack (WhatsApp Bot)

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Runtime** | Node.js | 20 LTS | Stable, long-term support, large ecosystem |
| **Language** | JavaScript | ES2023 | Faster iteration, no compilation step |
| **Framework** | Express.js | 4.x | Lightweight, battle-tested, simple for webhooks |
| **Database Client** | @supabase/supabase-js | Latest | Official client, realtime support, RLS aware |
| **HTTP Client** | Native fetch | Built-in | Node 18+ has fetch, no external dependency |
| **Validation** | Joi / Zod | Latest | Schema validation for user inputs |
| **Process Manager** | PM2 | Latest | Auto-restart, clustering, log management |
| **Tunnel** | Cloudflare Tunnel | Latest | Free, secure, no port forwarding |

**Why Node.js over Python/Go?**
- ✅ Shared language with frontend (TypeScript)
- ✅ Massive npm ecosystem
- ✅ Non-blocking I/O perfect for webhooks
- ✅ Team familiarity (faster development)

**Why Express over NestJS/Fastify?**
- ✅ Simple use case (webhook handler)
- ✅ Less abstraction = easier debugging
- ✅ Smaller bundle size
- ✅ More online resources for troubleshooting

---

### 2.3 Database Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Database** | PostgreSQL 15 | ACID compliance, mature, great for structured data |
| **Hosting** | Supabase | Managed Postgres, built-in auth, realtime, generous free tier |
| **ORM** | Raw SQL + Views | No abstraction overhead, full control, performance |
| **Migrations** | Supabase Migrations | Version-controlled schema changes |
| **Security** | Row Level Security (RLS) | Built-in user isolation, no application-layer checks |
| **Backups** | Supabase Auto Backups | Daily backups, point-in-time recovery |

**Why PostgreSQL over MongoDB/MySQL?**
- ✅ JSONB support for flexible fields
- ✅ Excellent indexing (GIN, BRIN)
- ✅ Full-text search capability
- ✅ Mature ecosystem (pgAdmin, Hasura)
- ✅ Better for complex joins (attendance → subjects → programs)

**Why Supabase over AWS RDS / Railway?**
- ✅ Free tier: 500MB DB (enough for 1,000 users)
- ✅ Built-in auth (saves development time)
- ✅ Real-time subscriptions (live updates)
- ✅ Edge functions (Deno runtime)
- ✅ Great DX (table editor, query logs)

---

### 2.4 Infrastructure Stack

| Component | Provider | Tier | Cost (MVP) |
|-----------|----------|------|------------|
| **Web Hosting** | Vercel | Hobby | Free |
| **Database** | Supabase | Free | $0 |
| **Bot Server** | Local Laptop → Mini-PC | Custom | $0 → $3/month |
| **Tunnel** | Cloudflare | Free | $0 |
| **WhatsApp API** | Meta Cloud API | Pay-per-message | $0 (user-initiated) |
| **Domain** | Namecheap | .com | $12/year |
| **Monitoring** | Supabase Logs | Free | $0 |
| **Error Tracking** | Console Logs | Free (MVP) | $0 |

**Total MVP Cost: ~$1/month**

---

## 3. Database Design

### 3.1 Entity Relationship Diagram

```
┌──────────────┐
│   profiles   │────────┐
│ (users)      │        │
└──────┬───────┘        │
       │                │
       │ 1:N            │ 1:N
       │                │
┌──────▼────────┐   ┌───▼──────────────┐
│ subject_      │   │  subjects        │
│ categories    │   │  (THE BRIDGE)    │
└───────────────┘   └───┬──────────┬───┘
                        │          │
                   1:N  │          │ 1:N
                        │          │
               ┌────────▼──┐  ┌────▼─────────┐
               │ study_    │  │ tasks        │
               │ timers    │  └──────────────┘
               └───────────┘
                   
                        
    ┌───────────────┐
    │ universities  │
    └───────┬───────┘
            │ 1:N
    ┌───────▼───────┐
    │   programs    │
    └───────┬───────┘
            │ 1:N
    ┌───────▼───────┐
    │  semesters    │
    └───────┬───────┘
            │ 1:N
    ┌───────▼────────┐
    │ academic_      │────┐
    │ courses        │    │
    └────────────────┘    │ 1:1
                          │
                    ┌─────▼──────┐
                    │  subjects  │
                    │  (type:    │
                    │  academic) │
                    └─────┬──────┘
                          │ 1:N
                 ┌────────┴────────┐
                 │                 │
        ┌────────▼────────┐  ┌─────▼──────┐
        │ attendance_logs │  │  grades    │
        └─────────────────┘  └────────────┘
```

---

### 3.2 Core Tables Schema

#### **profiles (Users)**
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number TEXT UNIQUE NOT NULL,        -- E.164: +919876543210
    display_name TEXT NOT NULL,
    email TEXT,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    
    -- Module toggles
    academics_enabled BOOLEAN DEFAULT false,
    personal_enabled BOOLEAN DEFAULT true,
    
    -- Academic settings (if enabled)
    current_university_id UUID,
    current_program_id UUID,
    current_semester_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_number);

-- RLS Policy
CREATE POLICY "Users see only own profile"
    ON profiles FOR SELECT
    USING (id = get_profile_id_from_jwt());
```

**Storage Estimate:**
- 1,000 users × 500 bytes/row = 0.5 MB
- Negligible impact on 500 MB free tier

---

#### **subjects (The Bridge)**
```sql
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Type: 'academic' or 'personal'
    type subject_type NOT NULL,
    name TEXT NOT NULL,
    
    -- For academic subjects
    source_course_id UUID REFERENCES academic_courses(id),
    instructor_name TEXT,
    expected_total_lectures INTEGER,
    
    -- For personal subjects
    category_id UUID REFERENCES subject_categories(id),
    label TEXT,
    
    -- Common
    color_hex TEXT DEFAULT '#8b5cf6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: academic → must have source_course_id
    CONSTRAINT academic_must_have_course CHECK (
        (type = 'academic' AND source_course_id IS NOT NULL) OR
        (type = 'personal')
    )
);

-- Indexes
CREATE INDEX idx_subjects_profile ON subjects(profile_id);
CREATE INDEX idx_subjects_type ON subjects(type);
CREATE INDEX idx_subjects_active ON subjects(profile_id, is_active);

-- RLS Policy
CREATE POLICY "Users manage own subjects"
    ON subjects FOR ALL
    USING (profile_id = get_profile_id_from_jwt());
```

**Storage Estimate:**
- 1,000 users × 5 subjects avg × 300 bytes = 1.5 MB

---

#### **study_timers**
```sql
CREATE TABLE study_timers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    
    -- Auto-calculated duration
    duration_seconds INTEGER GENERATED ALWAYS AS 
        (EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER) STORED,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_timers_profile ON study_timers(profile_id);
CREATE INDEX idx_timers_active ON study_timers(profile_id, ended_at) 
    WHERE ended_at IS NULL;
CREATE INDEX idx_timers_date ON study_timers(profile_id, started_at);

-- RLS Policy
CREATE POLICY "Users manage own timers"
    ON study_timers FOR ALL
    USING (profile_id = get_profile_id_from_jwt());
```

**Storage Estimate:**
- 1,000 users × 10 sessions/week × 4 weeks × 200 bytes = 8 MB

---

### 3.3 Helper Function (RLS)

**CRITICAL: Fixed version that works**
```sql
CREATE OR REPLACE FUNCTION get_profile_id_from_jwt()
RETURNS UUID AS $$
DECLARE
    phone_number TEXT;
    user_profile_id UUID;
BEGIN
    -- Extract phone from JWT 'sub' claim
    phone_number := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
    
    -- Return NULL if no JWT
    IF phone_number IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Lookup profile_id from phone
    SELECT id INTO user_profile_id 
    FROM profiles 
    WHERE whatsapp_number = phone_number;
    
    RETURN user_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Why this works:**
- JWT contains: `{ "sub": "+919876543210", "role": "authenticated" }`
- Function extracts phone number (TEXT)
- Queries profiles table to get UUID
- Returns UUID for RLS policies to use

**Previous bug:**
- Tried to cast `"+919876543210"` directly to UUID → PostgreSQL error
- This lookup approach is correct and performant (indexed query)

---

### 3.4 Database Performance

**Query Optimization:**
```sql
-- Slow: Full table scan
SELECT * FROM study_timers WHERE profile_id = 'some-uuid';

-- Fast: Uses idx_timers_profile
SELECT * FROM study_timers 
WHERE profile_id = 'some-uuid' 
ORDER BY started_at DESC 
LIMIT 20;

-- Very Fast: Uses idx_timers_active (partial index)
SELECT * FROM study_timers 
WHERE profile_id = 'some-uuid' 
  AND ended_at IS NULL;
```

**View Performance:**
```sql
-- Pre-computed aggregation
CREATE MATERIALIZED VIEW study_stats_summary AS
SELECT 
    profile_id,
    subject_id,
    COUNT(*) as total_sessions,
    SUM(duration_seconds) as total_seconds
FROM study_timers
WHERE ended_at IS NOT NULL
GROUP BY profile_id, subject_id;

-- Refresh daily via cron job
REFRESH MATERIALIZED VIEW study_stats_summary;
```

---

### 3.5 Data Retention Policy

| Table | Retention | Archival Strategy |
|-------|-----------|-------------------|
| **profiles** | Indefinite | Delete on user request |
| **subjects** | Indefinite | Soft delete (is_active=false) |
| **study_timers** | 2 years | Move to cold storage table |
| **tasks** | 1 year (completed) | Delete after 1 year |
| **attendance_logs** | Indefinite | Academic record |
| **grades** | Indefinite | Academic record |
| **otp_codes** | 5 minutes | Auto-delete after use |
| **message_queue** | 7 days | Delete after processing |

---

## 4. API Specifications

### 4.1 WhatsApp Cloud API Integration

**Base URL:** `https://graph.facebook.com/v18.0`

#### **Send Message**
```http
POST /{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "text",
  "text": {
    "body": "✅ Timer started for Python Programming"
  }
}
```

**Response:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "+919876543210",
    "wa_id": "919876543210"
  }],
  "messages": [{
    "id": "wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABIYIDNBN0I4QjM3RjFDMEI0NjcwRDI4RkY4QzQxNDg0NTU4AA=="
  }]
}
```

**Error Handling:**
```javascript
async function sendWhatsAppMessage(to, text) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text }
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp API error:', error);
      
      // Handle specific errors
      if (error.error?.code === 131026) {
        // Recipient not on WhatsApp
        throw new Error('User not on WhatsApp');
      }
      
      throw new Error(`WhatsApp API failed: ${error.error?.message}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err);
    throw err;
  }
}
```

---

#### **Webhook Verification**
```http
GET /webhook?
  hub.mode=subscribe
  &hub.verify_token=YOUR_VERIFY_TOKEN
  &hub.challenge=CHALLENGE_STRING

Response: CHALLENGE_STRING (plain text)
```

**Implementation:**
```javascript
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

---

#### **Receive Message Webhook**
```json
POST /webhook

{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": {
            "name": "Rajesh Kumar"
          },
          "wa_id": "919876543210"
        }],
        "messages": [{
          "from": "919876543210",
          "id": "wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYIDNBN0I4QjM3RjFDMEI0NjcwRDI4RkY4QzQxNDg0NTU4AA==",
          "timestamp": "1634648156",
          "text": {
            "body": "start python"
          },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Webhook Handler:**
```javascript
app.post('/webhook', async (req, res) => {
  // Acknowledge immediately (WhatsApp requires <20s response)
  res.sendStatus(200);
  
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    if (!value?.messages) return;
    
    const message = value.messages[0];
    const from = message.from;
    const text = message.text?.body;
    
    // Process message asynchronously
    await handleMessage(from, text);
  } catch (error) {
    console.error('Webhook error:', error);
  }
});
```

---

### 4.2 Supabase Edge Functions API

#### **Send OTP**
```http
POST https://your-project.supabase.co/functions/v1/send-otp
Content-Type: application/json

{
  "phone_number": "+919876543210"
}
```

**Response (Success):**
```json
{
  "success": true,
  "expires_in": 300
}
```

**Response (Error - User Not Found):**
```json
{
  "error": "User not found. Message the bot first to sign up."
}
```

**Response (Error - Rate Limit):**
```json
{
  "error": "Too many OTP requests. Try again in 1 hour."
}
```

---

#### **Verify OTP**
```http
POST https://your-project.supabase.co/functions/v1/verify-otp
Content-Type: application/json

{
  "phone_number": "+919876543210",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "phone_number": "+919876543210"
}
```

**Response (Error):**
```json
{
  "error": "Invalid or expired OTP"
}
```

---

### 4.3 Next.js API Routes

#### **Bot Status Check**
```http
GET /api/bot/status

Response:
{
  "status": "online" | "offline",
  "current_session_id": "uuid",
  "uptime_seconds": 3600,
  "messages_processed_today": 142,
  "next_online_at": "2026-02-16T19:00:00Z",
  "next_offline_at": "2026-02-16T23:00:00Z"
}
```

---

#### **User Stats**
```http
GET /api/users/me/stats
Authorization: Bearer {JWT}

Response:
{
  "total_subjects": 5,
  "active_subjects": 5,
  "total_study_hours_today": 6.5,
  "total_study_hours_week": 42,
  "pending_tasks": 3,
  "attendance_percentage": 87.5,
  "current_sgpa": 8.7
}
```

---

## 5. Security Architecture

### 5.1 Authentication & Authorization

**Identity Model:**
```
WhatsApp Number (E.164)
    ↓
Profile UUID (PostgreSQL)
    ↓
JWT Token (7-day expiry)
    ↓
Session (Auth.js)
```

**JWT Structure:**
```json
{
  "sub": "+919876543210",        // Subject (phone number)
  "role": "authenticated",        // User role
  "iat": 1708091234,             // Issued at
  "exp": 1708696034              // Expires at (7 days)
}
```

**JWT Generation (Edge Function):**
```typescript
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(SUPABASE_JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"]
);

const jwt = await create(
  { alg: "HS256", typ: "JWT" },
  {
    sub: phone_number,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
  },
  key
);
```

---

### 5.2 Row Level Security (RLS)

**How it works:**
1. Client sends request with JWT in `Authorization: Bearer {token}` header
2. Supabase validates JWT signature
3. Supabase extracts claims and sets `auth.jwt()` context
4. RLS policies check `auth.jwt() ->> 'sub'` against `whatsapp_number`
5. Query only returns rows matching user's phone number

**Example Policy:**
```sql
CREATE POLICY "Users manage own subjects"
    ON subjects FOR ALL
    USING (profile_id = get_profile_id_from_jwt());

-- Breakdown:
-- FOR ALL: Applies to SELECT, INSERT, UPDATE, DELETE
-- USING: Filter condition for SELECT
-- WITH CHECK: Validation for INSERT/UPDATE (implicit from USING)
```

**Testing RLS:**
```sql
-- Set JWT claim manually (for testing)
SET request.jwt.claims = '{"sub": "+919876543210"}';

-- This should only return one user's subjects
SELECT * FROM subjects;

-- Reset
RESET request.jwt.claims;
```

---

### 5.3 Input Validation

**Phone Number Validation:**
```javascript
function isValidE164(phone) {
  // E.164: +[country code][number]
  // Example: +919876543210
  const regex = /^\+[1-9]\d{1,14}$/;
  return regex.test(phone);
}

// Usage
if (!isValidE164(phone_number)) {
  return res.status(400).json({ 
    error: 'Invalid phone number format. Use E.164: +919876543210' 
  });
}
```

**SQL Injection Prevention:**
```javascript
// ❌ BAD: String concatenation
const query = `SELECT * FROM subjects WHERE name = '${userInput}'`;

// ✅ GOOD: Parameterized query
const { data } = await supabase
  .from('subjects')
  .select('*')
  .eq('name', userInput);  // Supabase handles escaping
```

**XSS Prevention:**
```typescript
// Next.js automatically escapes JSX expressions
<h1>{user.name}</h1>  // Safe

// For dangerouslySetInnerHTML (avoid if possible)
import DOMPurify from 'isomorphic-dompurify';

<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(userInput) 
}} />
```

---

### 5.4 Rate Limiting

**OTP Requests:**
```typescript
// In send-otp edge function
const recentAttempts = await supabase
  .from('otp_attempts')
  .select('*')
  .eq('whatsapp_number', phone_number)
  .gte('attempt_time', new Date(Date.now() - 3600000).toISOString())
  .count();

if (recentAttempts.count >= 5) {
  return new Response(
    JSON.stringify({ error: 'Too many OTP requests. Try in 1 hour.' }),
    { status: 429 }
  );
}
```

**Bot Commands:**
```javascript
// In-memory rate limiter (resets on bot restart)
const rateLimits = new Map();

function checkRateLimit(phone, limit = 20, windowMs = 3600000) {
  const now = Date.now();
  const userLimit = rateLimits.get(phone);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimits.set(phone, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= limit) {
    return false;  // Rate limited
  }
  
  userLimit.count++;
  return true;
}

// Usage
if (!checkRateLimit(from)) {
  await sendWhatsAppMessage(from, 
    "⚠️ Too many commands. Please slow down. (Limit: 20/hour)"
  );
  return;
}
```

---

### 5.5 Secrets Management

**Environment Variables:**
```bash
# .env.local (Never commit!)
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... # Very sensitive!
WHATSAPP_ACCESS_TOKEN=EAABsb...
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=random-secret-string
AUTH_SECRET=generated-secret-32-chars
NEXTAUTH_URL=https://sadhyasmriti.com
```

**Vercel Deployment:**
```bash
# Set via Vercel dashboard or CLI
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
# ... (repeat for all secrets)
```

**Supabase Edge Functions:**
```bash
# Set secrets for edge functions
supabase secrets set WHATSAPP_ACCESS_TOKEN=EAABsb...
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=123456789
supabase secrets set SUPABASE_JWT_SECRET=your-jwt-secret
```

---

## 6. Infrastructure & Deployment

### 6.1 Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      PRODUCTION                           │
└──────────────────────────────────────────────────────────┘

┌─────────────────┐      ┌──────────────────┐
│  Vercel Edge    │      │  Cloudflare      │
│  (Next.js App)  │      │  Tunnel          │
│                 │      │  (Bot Proxy)     │
│  • Auto-deploy  │      │                  │
│  • Global CDN   │      │  • Secure tunnel │
│  • Zero config  │      │  • No port fwd   │
└────────┬────────┘      └────────┬─────────┘
         │                        │
         │                        │
         └────────────┬───────────┘
                      │
         ┌────────────▼─────────────┐
         │  Supabase PostgreSQL     │
         │  • RLS enabled           │
         │  • Daily backups         │
         │  • Real-time subs        │
         └──────────────────────────┘

┌─────────────────┐
│  Mini-PC / Mac  │
│  (Bot Server)   │
│                 │
│  • PM2 managed  │
│  • Auto-restart │
│  • Log rotation │
└─────────────────┘
```

---

### 6.2 Next.js Deployment (Vercel)

**Deployment Flow:**
```bash
# 1. Connect GitHub repo to Vercel (one-time setup)
# Via Vercel dashboard: New Project → Import Git Repository

# 2. Configure build settings (auto-detected)
Build Command: next build
Output Directory: .next
Install Command: npm install

# 3. Set environment variables
# Via Vercel dashboard: Settings → Environment Variables
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
AUTH_SECRET=...
NEXTAUTH_URL=https://sadhyasmriti.com

# 4. Deploy (automatic on git push)
git push origin main
# Vercel auto-deploys in ~60 seconds
```

**Custom Domain:**
```bash
# 1. Add domain in Vercel dashboard
# 2. Add DNS records at domain registrar:
A record: @ → 76.76.21.21
CNAME: www → cname.vercel-dns.com

# 3. Verify (takes 5-30 minutes)
```

**Performance Optimization:**
```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['supabase.co'], // Allow Supabase images
  },
  compress: true, // Enable gzip
  poweredByHeader: false, // Remove X-Powered-By header
  reactStrictMode: true,
};
```

---

### 6.3 Bot Server Deployment

#### **Phase 1: Laptop (Week 1-2)**
```bash
# 1. Clone repo
git clone https://github.com/your-username/sadhyasmriti-bot.git
cd sadhyasmriti-bot

# 2. Install dependencies
npm install

# 3. Create .env file
cat > .env << EOF
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
WHATSAPP_ACCESS_TOKEN=EAABsb...
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=random-secret
PORT=3001
EOF

# 4. Start Cloudflare Tunnel (separate terminal)
cloudflared tunnel run sadhyasmriti-bot

# 5. Start bot
npm start

# Bot runs at http://localhost:3001
# Accessible via https://bot.sadhyasmriti.com (Cloudflare Tunnel)
```

#### **Phase 2: Mini-PC (After 500 users)**
```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Start bot with PM2
pm2 start src/index.js --name sadhyasmriti-bot

# 3. Save PM2 config
pm2 save

# 4. Set up auto-start on boot
pm2 startup
# Run the command it outputs (system-specific)

# 5. Monitor
pm2 monit
pm2 logs sadhyasmriti-bot

# 6. Restart on code changes
pm2 restart sadhyasmriti-bot
```

**PM2 Ecosystem File:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sadhyasmriti-bot',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};

// Deploy
pm2 start ecosystem.config.js
```

---

### 6.4 Cloudflare Tunnel Setup

**Installation:**
```bash
# Linux/Mac
brew install cloudflared

# Or download from GitHub releases
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

**Configuration:**
```bash
# 1. Authenticate
cloudflared tunnel login
# Opens browser, select domain

# 2. Create tunnel
cloudflared tunnel create sadhyasmriti-bot
# Saves credentials to ~/.cloudflared/TUNNEL-ID.json

# 3. Create config file
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: sadhyasmriti-bot
credentials-file: /home/user/.cloudflared/TUNNEL-ID.json

ingress:
  - hostname: bot.sadhyasmriti.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# 4. Create DNS record
cloudflared tunnel route dns sadhyasmriti-bot bot.sadhyasmriti.com

# 5. Run tunnel
cloudflared tunnel run sadhyasmriti-bot
```

**Run as Service (Linux):**
```bash
# Create systemd service
sudo nano /etc/systemd/system/cloudflared.service

[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=youruser
ExecStart=/usr/local/bin/cloudflared tunnel run sadhyasmriti-bot
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

---

## 7. Performance Requirements

### 7.1 Response Time Targets

| Operation | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| **Dashboard Load** | <1s | <2s | >3s |
| **Bot Command Response** | <1s | <2s | >5s |
| **OTP Delivery** | <5s | <10s | >30s |
| **Login (OTP → Dashboard)** | <3s | <5s | >10s |
| **Timer Start/Stop** | <500ms | <1s | >2s |
| **Task Create** | <500ms | <1s | >2s |

### 7.2 Scalability Targets

| Metric | Current (MVP) | 6 Months | 1 Year |
|--------|---------------|----------|--------|
| **Concurrent Users** | 10 | 500 | 2,000 |
| **DB Connections** | 5 | 20 | 50 |
| **Bot Messages/Hour** | 50 | 2,000 | 10,000 |
| **API Requests/Min** | 100 | 1,000 | 5,000 |
| **Database Size** | 10 MB | 500 MB | 2 GB |

### 7.3 Optimization Strategies

**Database Query Optimization:**
```sql
-- Use covering indexes for common queries
CREATE INDEX idx_timers_profile_date_covering 
  ON study_timers(profile_id, started_at) 
  INCLUDE (duration_seconds);

-- Query benefits from covering index (no table lookup needed)
SELECT started_at, duration_seconds 
FROM study_timers 
WHERE profile_id = 'uuid' 
ORDER BY started_at DESC 
LIMIT 10;
```

**Next.js Performance:**
```typescript
// Use dynamic imports for heavy components
const AttendanceCalendar = dynamic(() => import('@/components/AttendanceCalendar'), {
  loading: () => <Skeleton />,
  ssr: false
});

// Prefetch critical data
export async function generateMetadata({ params }) {
  // This runs on server, data available instantly
  const subject = await getSubject(params.id);
  return { title: subject.name };
}
```

**Bot Performance:**
```javascript
// Connection pooling
const supabase = createClient(url, key, {
  db: {
    pool: {
      min: 2,
      max: 10
    }
  }
});

// Batch inserts
await supabase
  .from('attendance_logs')
  .insert(bulkRecords);  // Single transaction
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Frontend (Jest + React Testing Library):**
```typescript
// __tests__/components/SubjectCard.test.tsx
import { render, screen } from '@testing-library/react';
import SubjectCard from '@/components/SubjectCard';

test('renders subject name', () => {
  render(<SubjectCard subject={{ name: 'Python', color: '#3b82f6' }} />);
  expect(screen.getByText('Python')).toBeInTheDocument();
});

test('shows active timer indicator when timer is running', () => {
  render(<SubjectCard subject={{ name: 'Python' }} hasActiveTimer={true} />);
  expect(screen.getByTestId('timer-indicator')).toBeInTheDocument();
});
```

**Backend (Jest):**
```javascript
// __tests__/handlers/commands.test.js
const { handleTimerStart } = require('../src/handlers/commands');

describe('Timer Commands', () => {
  test('starts timer for valid subject', async () => {
    const result = await handleTimerStart('+919876543210', 'Python');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Timer started');
  });

  test('rejects timer start when one is already active', async () => {
    await handleTimerStart('+919876543210', 'Python');
    const result = await handleTimerStart('+919876543210', 'JavaScript');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already have an active timer');
  });
});
```

---

### 8.2 Integration Tests

**API Integration:**
```typescript
// __tests__/api/auth.test.ts
describe('Auth Flow', () => {
  test('OTP flow end-to-end', async () => {
    // 1. Send OTP
    const sendRes = await fetch('/functions/v1/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone_number: '+919876543210' })
    });
    expect(sendRes.ok).toBe(true);

    // 2. Get OTP from test database
    const { data: otpRecord } = await supabase
      .from('otp_codes')
      .select('code')
      .eq('whatsapp_number', '+919876543210')
      .single();

    // 3. Verify OTP
    const verifyRes = await fetch('/functions/v1/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ 
        phone_number: '+919876543210', 
        otp: otpRecord.code 
      })
    });
    const { token } = await verifyRes.json();
    expect(token).toBeDefined();
  });
});
```

---

### 8.3 End-to-End Tests (Playwright)

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('user can login via WhatsApp OTP', async ({ page }) => {
  // Navigate to login
  await page.goto('https://sadhyasmriti.com/login');

  // Enter phone number
  await page.fill('[name="phone"]', '+919876543210');
  await page.click('button:has-text("Send OTP")');

  // Wait for OTP sent message
  await expect(page.locator('text=OTP sent')).toBeVisible();

  // Enter OTP (mock for test)
  await page.fill('[name="otp"]', '123456');
  await page.click('button:has-text("Verify")');

  // Should redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
});
```

---

### 8.4 Load Testing (k6)

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests < 2s
  },
};

export default function () {
  // Test bot webhook
  const res = http.post('https://bot.sadhyasmriti.com/webhook', JSON.stringify({
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '919876543210',
            text: { body: 'stats' }
          }]
        }
      }]
    }]
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
```

Run: `k6 run load-test.js`

---

## 9. Monitoring & Observability

### 9.1 Application Monitoring

**Supabase Logs:**
```sql
-- View recent errors
SELECT * FROM postgres_logs 
WHERE level = 'ERROR' 
ORDER BY timestamp DESC 
LIMIT 100;

-- View slow queries
SELECT query, duration_ms 
FROM query_performance 
WHERE duration_ms > 1000 
ORDER BY duration_ms DESC;
```

**Bot Monitoring:**
```javascript
// Log all commands
async function logCommand(phone, command, success, error = null) {
  await supabase.from('command_logs').insert({
    whatsapp_number: phone,
    command,
    success,
    error: error?.message,
    timestamp: new Date().toISOString()
  });
}

// Usage
try {
  await handleTimerStart(phone, subject);
  await logCommand(phone, 'start', true);
} catch (err) {
  await logCommand(phone, 'start', false, err);
}
```

---

### 9.2 Key Metrics Dashboard

**Grafana + Prometheus (Future):**
```yaml
# Metrics to track
- bot_uptime_seconds
- bot_messages_processed_total
- bot_errors_total
- db_connections_active
- db_query_duration_p95
- api_request_duration_p95
- user_signups_total
- study_timers_started_total
- tasks_created_total
```

**MVP: Simple Stats View**
```sql
-- Daily active users
SELECT COUNT(DISTINCT profile_id) as dau
FROM study_timers
WHERE started_at >= CURRENT_DATE;

-- Total study hours today
SELECT ROUND(SUM(duration_seconds) / 3600.0, 2) as total_hours
FROM study_timers
WHERE started_at >= CURRENT_DATE
  AND ended_at IS NOT NULL;

-- Bot uptime (last 7 days)
SELECT 
  DATE(started_at) as date,
  SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600 as hours_online
FROM bot_sessions
WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(started_at)
ORDER BY date DESC;
```

---

### 9.3 Alerting

**Critical Alerts:**
```javascript
// Bot down for >10 minutes
if (lastHeartbeat < Date.now() - 600000) {
  sendAdminAlert('🚨 Bot is down! Last seen: ' + lastHeartbeat);
}

// Database connection failures
if (dbConnectionAttempts > 5) {
  sendAdminAlert('⚠️ Database connection issues!');
}

// OTP delivery failures
if (otpFailureRate > 0.1) {
  sendAdminAlert('📱 WhatsApp API issues - 10% OTP failure rate');
}
```

**Admin Alert Channel:**
```javascript
async function sendAdminAlert(message) {
  // Send to admin WhatsApp
  await sendWhatsAppMessage(ADMIN_PHONE, message);
  
  // Also log to database
  await supabase.from('admin_alerts').insert({
    message,
    severity: 'critical',
    timestamp: new Date().toISOString()
  });
}
```

---

## 10. Disaster Recovery

### 10.1 Backup Strategy

**Database Backups:**
- **Supabase Auto-Backups:** Daily (retained 7 days on free tier)
- **Manual Exports:** Weekly (download as SQL dump)
- **Point-in-Time Recovery:** Available on paid tier

**Backup Script:**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="./backups"

mkdir -p $BACKUP_DIR

# Export all tables
supabase db dump > "$BACKUP_DIR/sadhyasmriti-$DATE.sql"

# Compress
gzip "$BACKUP_DIR/sadhyasmriti-$DATE.sql"

# Upload to S3 (optional)
# aws s3 cp "$BACKUP_DIR/sadhyasmriti-$DATE.sql.gz" s3://my-backups/

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup complete: $BACKUP_DIR/sadhyasmriti-$DATE.sql.gz"
```

Run weekly: `crontab -e` → `0 2 * * 0 /path/to/backup-db.sh`

---

### 10.2 Recovery Procedures

**Scenario 1: Database Corruption**
```bash
# 1. Stop all services
pm2 stop sadhyasmriti-bot

# 2. Restore from backup
gunzip backups/sadhyasmriti-2026-02-15.sql.gz
psql $DATABASE_URL < backups/sadhyasmriti-2026-02-15.sql

# 3. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM profiles;"

# 4. Restart services
pm2 start sadhyasmriti-bot
```

**Scenario 2: Bot Server Failure**
```bash
# 1. Check if process is running
pm2 status

# 2. View logs
pm2 logs sadhyasmriti-bot --lines 100

# 3. Restart
pm2 restart sadhyasmriti-bot

# 4. If still failing, check Cloudflare Tunnel
sudo systemctl status cloudflared

# 5. Restart tunnel if needed
sudo systemctl restart cloudflared
```

**Scenario 3: WhatsApp API Outage**
```bash
# Fallback: Use SMS OTP instead
# 1. Implement Twilio SMS integration
# 2. Update send-otp edge function to use SMS
# 3. Notify users via dashboard banner
```

---

### 10.3 Rollback Plan

**Database Rollback:**
```sql
-- Create restore point before migration
BEGIN;
  -- Run migration
  -- ...
  -- If something goes wrong:
ROLLBACK;
```

**Application Rollback (Vercel):**
```bash
# Via dashboard: Deployments → Select previous version → Promote to Production

# Or via CLI:
vercel rollback
```

**Bot Rollback:**
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or restore from backup
cp -r backups/sadhyasmriti-bot-2026-02-15/ .
pm2 restart sadhyasmriti-bot
```

---

## 11. Appendix

### 11.1 Development Environment Setup

**Prerequisites:**
- Node.js 20 LTS
- PostgreSQL (local testing)
- Supabase CLI
- Git

**Setup Steps:**
```bash
# 1. Clone repos
git clone https://github.com/your-username/sadhyasmriti-web.git
git clone https://github.com/your-username/sadhyasmriti-bot.git

# 2. Install dependencies
cd sadhyasmriti-web && npm install
cd ../sadhyasmriti-bot && npm install

# 3. Set up Supabase local
supabase init
supabase start

# 4. Run migrations
supabase db push

# 5. Start dev servers
cd sadhyasmriti-web && npm run dev    # Port 3000
cd sadhyasmriti-bot && npm run dev    # Port 3001

# 6. Open in browser
open http://localhost:3000
```

---

### 11.2 Troubleshooting Guide

**Issue: RLS returns no rows**
```sql
-- Check if JWT is set correctly
SELECT current_setting('request.jwt.claims', true);

-- Manually set JWT for testing
SET request.jwt.claims = '{"sub": "+919876543210"}';

-- Verify profile exists
SELECT * FROM profiles WHERE whatsapp_number = '+919876543210';

-- Check RLS policy
SELECT * FROM pg_policies WHERE tablename = 'subjects';
```

**Issue: Bot not responding**
```bash
# Check if server is running
curl http://localhost:3001/health

# Check Cloudflare Tunnel
cloudflared tunnel info sadhyasmriti-bot

# Check logs
pm2 logs sadhyasmriti-bot --lines 50

# Restart
pm2 restart sadhyasmriti-bot
```

**Issue: OTP not delivered**
```bash
# Check WhatsApp API status
curl https://graph.facebook.com/v18.0/health

# Check credentials
echo $WHATSAPP_ACCESS_TOKEN

# Test API directly
curl -X POST https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"+919876543210","type":"text","text":{"body":"Test"}}'
```

---

**END OF TRD**

---

**Document Approval:**

| Role | Name | Date | Status |
|------|------|------|--------|
| Engineering Lead | TBD | Feb 16, 2026 | ✅ Approved |
| DevOps Lead | TBD | Feb 16, 2026 | ✅ Approved |
| Security Lead | TBD | Feb 16, 2026 | ✅ Approved |

**Next Review:** After MVP launch (Week 2)
