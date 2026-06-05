# Edge Functions Bot Architecture

## Overview

Ryu Medha's WhatsApp bot is implemented entirely as Supabase Edge Functions (serverless TypeScript running on Deno). Unlike traditional bot architectures, this approach eliminates the need for persistent Node.js servers and provides automatic scaling.

## Core Edge Functions

### 1. **whatsapp-webhook** (`/supabase/functions/whatsapp-webhook/`)

The primary entry point for all WhatsApp messages from Meta/Facebook.

**Responsibilities:**
- **GET requests**: Verify webhook ownership with Meta's `hub.verify_token`
- **POST requests**: Receive incoming messages and route to `processMessage()`

**Key Flow:**
```
Meta WhatsApp → POST /whatsapp-webhook
  ├─ Extract phone & message text
  ├─ Detect if message is interactive (buttons/lists) or text
  ├─ Call processMessage(phone, text, metadata)
  └─ Send replies back via WhatsApp Cloud API
```

**Submodules:**
- `index.ts` — Webhook entry point and verification
- `processor.ts` — Intent parsing and message handling
- `nlp.ts` — Natural Language Processing for intent detection
- `messages.ts` — Pre-defined message templates
- `setup.ts` — Onboarding workflow
- `db.ts` — Database operations

### 2. **whatsapp-bot** (`/supabase/functions/whatsapp-bot/`)

An alternative or supplementary bot function with the same internal structure as `whatsapp-webhook`. Used for direct message processing or testing.

**Same modules as whatsapp-webhook**, allowing:
- Independent testing
- A/B testing different message flows
- Parallel processing if needed

### 3. **whatsapp-engagement** (`/supabase/functions/whatsapp-engagement/`)

Sends proactive engagement messages to users based on their activity window status.

**Modes:**
- **Manual**: Send to a specific user (`?type=manual&profile_id=<id>`)
- **Auto**: Scan for users with `window_status='closing_soon'` and send reminders
- **Daily**: Send to all users with `window_status='open'` at 4 PM (via cron)

**Features:**
- Rate limiting (max 1 engagement per 2 hours)
- Message templating with random selections
- Logs all sent messages to `whatsapp_message_logs`

### 4. **auth** (`/supabase/functions/auth/`)

Handles OTP generation and verification for web dashboard login.

**Actions:**
- `?action=request` — Generate and send OTP to WhatsApp
- `?action=verify` — Validate OTP and return JWT token

**Features:**
- Rate limiting (3 OTP requests per 10 minutes)
- 5-minute OTP expiration
- User registration check before sending OTP

## Message Processing Flow

### Intent Detection (NLP)

The `nlp.ts` module uses the Compromise library to extract intents from user messages:

**Intents:**
- `stats` — View attendance statistics
- `profile` — View/edit profile
- `subjects` — Manage subjects (add/list/delete)
- `help` — Display help menu
- `tasks` — Manage tasks
- `attendance` — Mark attendance (present/absent/deemed)
- `timers` — Start/stop study timers
- `categories` — Manage personal categories

**Example:**
```
User: "I attended Constitutional Law and Contracts"
↓ (NLP parsing)
Intent: attendance
Action: Mark present
Subjects: ["Constitutional Law", "Contracts"]
```

### Message Processing (`processor.ts`)

Main message handler with branching logic:

1. **Onboarding Check** — If user is new or incomplete setup, redirect to `startOnboarding()`
2. **Intent Routing** — Route message to appropriate handler based on detected intent
3. **Response Generation** — Return formatted message(s) with rich text and interactive buttons
4. **Database Persistence** — Log messages to `whatsapp_message_logs`

**Key Functions:**
- `processMessage(phone, text, metadata)` — Main entry point
- `handleAddSubject()` — Create academic or personal subject
- `handleAttendance()` — Mark attendance and compute statistics
- `handleTimer()` — Start/stop study timers
- `handleTasks()` — Manage task lists

### Onboarding Workflow (`setup.ts`)

Multi-step flow for new users:

1. **Welcome** — Show setup choices (web or chat)
2. **Name** — Collect user's display name
3. **Track Selection** — Choose academic, personal, or both tracking
4. **University Selection** — Pick university/institution
5. **Program Selection** — Select academic program
6. **Semester Selection** — Choose current semester
7. **Course Selection** — Add academic courses to track
8. **Target Attendance** — Set attendance goal

**Session Management:** Uses `setSession(phone, step, data)` to persist state across interactions.

## Database Integration

### User Scoping & Row Level Security (RLS)

Each user's data is accessed through a scoped Supabase client:

```typescript
// Generate user-specific JWT
const token = await generateUserToken(phone);

// Create user-scoped client
const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  headers: { Authorization: `Bearer ${token}` }
});

// All queries are RLS-enforced
userClient.from('subjects').select().eq('whatsapp_number', phone);
```

**Admin Operations:** The bot uses `supabaseAdmin` (service role key) for:
- Creating new profiles
- Initial setup operations
- Cross-user operations (engagement broadcasts)

### Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts with settings |
| `subjects` | Academic and personal subjects |
| `study_timers` | Recorded study sessions |
| `attendance_logs` | Class attendance records |
| `tasks` | User to-do items |
| `grades` | Academic grade records |
| `otp_codes` | OTP tokens for web login |
| `bot_sessions` | Onboarding state persistence |
| `whatsapp_message_logs` | Message history for auditing |
| `whatsapp_window_status` | User engagement window status |

## Environment Variables

Required in Supabase Function settings:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<public_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<secret_for_jwt_generation>
WHATSAPP_TOKEN=<meta_api_token>
WHATSAPP_PHONE_NUMBER_ID=<meta_phone_id>
WA_VERIFY_TOKEN=<custom_webhook_verification_token>
WEBSITE_URL=https://ryumedha.in
```

## Deployment & Scaling

### Deployment

Deploy a function with:
```bash
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-engagement
npx supabase functions deploy auth
```

### Scaling

- **Automatic** — Supabase handles scaling based on request volume
- **No Server Management** — No need to provision EC2/containers
- **Cold Start** — First request takes ~1-3 seconds; subsequent requests are faster
- **Concurrency** — Can handle thousands of concurrent webhook deliveries

### Monitoring

- View logs in Supabase Dashboard → Functions
- Check `whatsapp_message_logs` for message delivery tracking
- Monitor `whatsapp_window_status` for user engagement metrics

## Session Management

### In-Memory vs. Database

The bot uses a hybrid approach:

1. **In-Memory** — Fast access for the current request context
2. **Database** — Persistent storage in `bot_sessions` table for multi-step workflows

```typescript
// Hybrid session retrieval
async function getSession(phone) {
  if (sessions.has(phone)) return sessions.get(phone); // In-memory
  return await supabaseAdmin.from('bot_sessions')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle(); // From DB
}
```

## Message Logging & Analytics

### whatsapp_message_logs Table

Tracks every message:
- Sent by bot (`message_type: 'bot_reply'`)
- Engagement blasts (`message_type: 'engagement'`)
- Task reminders (`message_type: 'tasks_blast'`)
- Status: sent, delivered, read, failed

### User Engagement Tracking

The `whatsapp_window_status` table tracks:
- Last message timestamp
- Current window status (`open`, `closing_soon`, `closed`)
- Used for proactive engagement targeting

## Error Handling & Retry Logic

- **Webhook Verification Failures** — Return 403 Forbidden
- **Message Send Failures** — Log to console; continue without blocking
- **Database Errors** — Return user-friendly error messages
- **Rate Limiting** — Return 429 Too Many Requests (OTP function)

## API Endpoints Reference

### Webhook
- **POST** `/whatsapp-webhook` — Receive incoming messages
- **GET** `/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=...` — Verify webhook

### Bot (Supplementary)
- **POST** `/whatsapp-bot` — Alternative message processing

### Engagement
- **POST** `/whatsapp-engagement?type=manual&profile_id=...` — Send manual engagement
- **POST** `/whatsapp-engagement?type=auto` — Auto scan and send
- **POST** `/whatsapp-engagement?type=daily` — Daily broadcast

### Auth
- **POST** `/auth?action=request` — Request OTP
- **POST** `/auth?action=verify` — Verify OTP and get JWT

## Future Improvements

- [ ] Implement caching layer for frequently accessed data
- [ ] Add analytics dashboard for bot conversation metrics
- [ ] Implement advanced NLP models (vs. regex-based intent matching)
- [ ] Add A/B testing framework for message variations
- [ ] Implement conversation turn limiting to prevent infinite loops
