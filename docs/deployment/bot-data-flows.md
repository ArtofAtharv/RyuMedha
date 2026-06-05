# Bot Data Flows & Workflows

## Message Reception & Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Meta WhatsApp Cloud API                                     │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /whatsapp-webhook
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Function: whatsapp-webhook/index.ts                   │
│ • Extract phone, message text, message type                │
│ • Detect interactive (buttons) vs text                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ processMessage(phone, text, metadata)                       │
│ (whatsapp-bot/processor.ts)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
   ┌─────────┐ ┌────────┐ ┌─────────────┐
   │ Onboard │ │ Lookup │ │ Parse NLP   │
   │ ing?    │ │ User   │ │ Intent      │
   └─────────┘ └────────┘ └─────────────┘
         │           │           │
         └───────────┴───────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
         ▼                          ▼
   ┌─────────────────┐      ┌──────────────────┐
   │ Onboarding Flow │      │ Intent Handler   │
   │ (setup.ts)      │      │ (processor.ts)   │
   └────────┬────────┘      └────────┬─────────┘
            │                        │
            │      ┌────────────────┐│
            │      │                ││
            ▼      ▼                ▼▼
         ┌─────────────────────────────────┐
         │ Database Operations (RLS)       │
         │ • Query user data               │
         │ • Create/update records         │
         │ • Log activity                  │
         └────────────────┬────────────────┘
                          │
                          ▼
         ┌─────────────────────────────────┐
         │ Format Response                 │
         │ (messages.ts templates)         │
         └────────────────┬────────────────┘
                          │
                          ▼
         ┌─────────────────────────────────┐
         │ Send via WhatsApp Cloud API     │
         │ • Single text message           │
         │ • Interactive buttons/lists     │
         └────────────────┬────────────────┘
                          │
                          ▼
         ┌─────────────────────────────────┐
         │ Log to whatsapp_message_logs    │
         └─────────────────────────────────┘
```

## Specific Workflow Examples

### 1. New User Registration & Onboarding

```
User sends: "Hi"
           ↓
Bot checks: User exists in profiles?
           ↓
           NO → Create new profile with:
                • whatsapp_number (phone)
                • display_name = ""
                • academics_enabled = false
                • personal_enabled = false
           ↓
Bot detects: needsOnboarding() = true
           ↓
Bot calls: startOnboarding()
           ↓
Set session: phone → {step: "awaiting_onboarding_choice", data: {}}
           ↓
Return: Welcome message + 2 button options:
        1. Setup here (chat)
        2. Setup on website
```

**State Storage:**
```
bot_sessions table:
┌──────────────┬─────────────────────────────────────┐
│ phone_number │ session_data                        │
├──────────────┼─────────────────────────────────────┤
│ +91XXXXXX    │ {"step": "awaiting_onboarding...", │
│              │  "data": {}, "lastActivity": ...}  │
└──────────────┴─────────────────────────────────────┘
```

### 2. Adding an Academic Subject

```
Prerequisites:
• User must have completed setup
• User must have selected "academic" tracking
• User must have current_semester_id set

Flow:
User sends: "Add Constitutional Law"
           ↓
Bot checks: Subject exists?
           ↓
           NO → Check: Is user ready for academics?
               • display_name set?
               • academics_enabled = true?
               • current_semester_id set?
           ↓
           YES → Query academic_courses table:
                 • Filter by semester
                 • Case-insensitive search for "Constitutional Law"
           ↓
           NOT FOUND → Create new course:
                       • semester_id = user.current_semester_id
                       • course_name = "Constitutional Law"
           ↓
           Create subject record:
                • profile_id = user.id
                • type = "academic"
                • name = "Constitutional Law"
                • source_course_id = course.id
                • is_active = true
           ↓
Return: "✅ Added Constitutional Law to your academic list"
```

**RLS Enforcement:**
```typescript
// User's JWT contains: {sub: "+91XXXXXX", role: "authenticated"}
// Query: userClient.from('subjects').insert([...])
// RLS Policy automatically filters:
// subjects.profile_id = get_profile_id_from_jwt(sub)
```

### 3. Marking Attendance

```
User sends: "I attended Math and Physics"
           ↓
Bot NLP parses:
• Intent: attendance
• Action: present
• Subjects: ["Math", "Physics"]
           ↓
For each subject:
  ├─ Query subjects table:
  │  • Filter by user profile
  │  • Filter by name (case-insensitive)
  │  • Filter by is_active = true
  │
  ├─ Found Math?
  │  └─ Check: Is academic?
  │     ├─ YES → Can mark attendance
  │     └─ NO → Skip (personal subjects don't have attendance)
  │
  ├─ Create attendance_log:
  │  • profile_id, subject_id, date (today)
  │  • status = "present"
  │
  ├─ Query attendance_logs:
  │  • Count attended lectures
  │  • Count total lectures
  │  • Calculate percentage
  │
  └─ Get next prompt:
     ├─ Check user's target_attendance_pct
     ├─ Calculate: can still skip = (total - attended) - (target%)
     └─ If can skip: "You can skip X more classes"
        If warning: "You need to attend X more classes to reach target"
           ↓
Return: ✅ Marked present for Math and Physics
        💡 You can skip 3 more classes and stay on 75% goal
```

### 4. Starting a Study Timer

```
User sends: "Start studying Math"
           ↓
Bot checks: Is "Math" a valid subject?
           ├─ Query subjects table
           ├─ Check is_active = true
           └─ Both academic & personal allowed
           ↓
Bot checks: Already active timer?
           ├─ Query study_timers table
           ├─ Filter by profile_id, subject_id, ended_at = NULL
           └─ If YES → "⚠️ You already have an active timer"
           ↓
           NO → Create new timer:
           ├─ profile_id, subject_id
           ├─ started_at = NOW()
           ├─ ended_at = NULL
           └─ Store timer_id in session or memory
           ↓
Return: ⏱️ Study session started for Math
        📱 Or check live timer on Dashboard

When user says "Stop":
           ↓
Query study_timers:
• WHERE profile_id = user.id AND ended_at IS NULL
• Get started_at timestamp
           ↓
Update timer:
• SET ended_at = NOW()
• Calculate duration = ended_at - started_at
           ↓
Return: ⏹️ Great focus! You studied for 1h 45m
        📊 Added to study history
```

### 5. Engagement Message Broadcast

```
Trigger: Scheduled cron job every hour
         (or manual API call)
           ↓
Edge Function: whatsapp-engagement/index.ts
           ↓
Query whatsapp_window_status table:
• WHERE window_status = "closing_soon"
• These users haven't messaged in 22-24 hours
           ↓
For each user:
  ├─ Check recent engagement logs:
  │  • WHERE created_at >= NOW() - 2 hours
  │  • WHERE message_type = "engagement"
  │  └─ Skip if already sent in last 2 hours
  │
  ├─ Pick random engagement message
  │  └─ "Namaste! Quick check-in: Have you made..."
  │
  ├─ Send via WhatsApp Cloud API
  │  • Include 2 interactive buttons:
  │    - "Show My Tasks"
  │    - "All Done!"
  │
  └─ Log to whatsapp_message_logs:
     • profile_id, wa_message_id
     • status = "sent"
     • message_type = "engagement"
           ↓
Return: {success: true, sent: 45} (45 messages sent)
```

## Database Transaction Examples

### Atomic Onboarding Completion

```typescript
// All-or-nothing: Either all succeed or all fail

BEGIN TRANSACTION:
  ├─ UPDATE profiles:
  │  • academics_enabled = true
  │  • personal_enabled = true
  │  • current_semester_id = <id>
  │  • display_name = "John Doe"
  │
  ├─ For each selected course:
  │  └─ INSERT subject:
  │     • profile_id, type="academic", course_id
  │
  ├─ INSERT default categories:
  │  • "Professional Development", "Competitive Exams", etc.
  │
  ├─ DELETE FROM bot_sessions:
  │  • WHERE phone_number = <phone>
  │
  └─ COMMIT

If error at any step → ROLLBACK (undo all changes)
```

### Deduplication & Conflict Resolution

```typescript
// When adding subject: Check for duplicates

const { data: existing } = await userClient
  .from('subjects')
  .select('name, type')
  .eq('profile_id', user.id)
  .ilike('name', subjectName.trim())      // Case-insensitive
  .eq('is_active', true)
  .maybeSingle();                          // Return 0 or 1 row

if (existing) {
  return MESSAGES.subjects.duplicate(existing.name, existing.type);
}

// This prevents:
// • "Math" and "MATH" coexisting
// • Duplicate soft-deleted subjects from reappearing
// • Accidental double-adds from rapid clicks
```

## Session State Lifecycle

```
┌─────────────────────────────────────────┐
│ User sends first message                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Session created: setSession()           │
│ • In-memory: sessions.set(phone, {...}) │
│ • DB: upsert to bot_sessions            │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Multi-step interaction (onboarding)     │
│ • Each message retrieves: getSession()  │
│ • Updates via: setSession()             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Onboarding complete                     │
│ • Session cleared: clearSession()       │
│ • From in-memory: sessions.delete()     │
│ • From DB: DELETE FROM bot_sessions     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Session is NULL                         │
│ Future messages treated as new intents  │
└─────────────────────────────────────────┘
```

## Error Recovery & Retry Logic

### Failed WhatsApp Send

```
try {
  const res = await fetch("WhatsApp API");
  if (!res.ok) {
    console.error("Failed to send:", await res.text());
    // Do NOT throw - continue processing
    // Message still logged as "sent" (optimistic)
  }
} catch (err) {
  console.error("Network error:", err);
  // Still return 200 to webhook (don't retry)
}
```

### Database Constraint Violations

```
Example: Duplicate email in unique constraint

try {
  const { data, error } = await userClient
    .from('subjects')
    .insert([{ name: "Math", ... }]);
    
  if (error) {
    return MESSAGES.subjects.duplicate("Math");
  }
} catch (err) {
  return MESSAGES.subjects.addError("Math");
}
```

## Performance Considerations

### Query Optimization

- **Indexes**: profile_id, whatsapp_number, is_active
- **Pagination**: Used for large subject/task lists (50 items max per message)
- **Denormalization**: Cached computed fields like attendance percentage

### Cache Strategy

- **In-Memory Session Cache**: 1 request lifecycle
- **Message Template Cache**: Pre-loaded static messages.ts
- **User Profile Cache**: Reload on each request (no stale data)

### Concurrency Handling

- Each user request is independent
- Two simultaneous timers from same user:
  - Second request sees active timer
  - Returns "already running" message
  - No race condition (query before insert)
