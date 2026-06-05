# Database Schema & Documentation

## Overview

PostgreSQL database with 20+ tables, RLS policies, indexes, and automated triggers.

## Core Tables

### profiles
User accounts and preferences.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,    -- "+91XXXXXX"
  display_name TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  academics_enabled BOOLEAN DEFAULT false,
  personal_enabled BOOLEAN DEFAULT false,
  current_semester_id UUID,
  target_attendance_pct INT DEFAULT 75,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**RLS Policy:** Users see only their own row.

### subjects
Academic and personal subjects being tracked.

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,               -- 'academic' or 'personal'
  source_course_id UUID,            -- academic courses
  category_id UUID,                 -- personal categories
  is_active BOOLEAN DEFAULT true,
  expected_total_lectures INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes:** (profile_id, is_active), (profile_id, type)

### attendance_logs
Class attendance records.

```sql
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  date DATE NOT NULL,
  status TEXT NOT NULL,             -- 'present', 'absent', 'deemed'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes:** (profile_id, subject_id, date)

### study_timers
Study session records.

```sql
CREATE TABLE study_timers (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,               -- NULL while active
  duration_minutes INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes:** (profile_id, ended_at)

### tasks
User to-do items.

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  due_date TIMESTAMP,
  completed_at TIMESTAMP,           -- NULL if pending
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes:** (profile_id, completed_at)

### otp_codes
OTP tokens for web login.

```sql
CREATE TABLE otp_codes (
  whatsapp_number TEXT PRIMARY KEY,
  code TEXT NOT NULL,               -- 6-digit OTP
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  attempts INT DEFAULT 0,
  last_sent_at TIMESTAMP,
  created_at TIMESTAMP
);
```

**Indexes:** (whatsapp_number)

### bot_sessions
Onboarding state persistence.

```sql
CREATE TABLE bot_sessions (
  phone_number TEXT PRIMARY KEY,
  session_data TEXT,                -- JSON stringified state
  updated_at TIMESTAMP
);
```

### whatsapp_message_logs
Message audit trail.

```sql
CREATE TABLE whatsapp_message_logs (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  wa_message_id TEXT,               -- Meta's message ID
  body TEXT,
  message_type TEXT,                -- 'bot_reply', 'engagement', etc
  status TEXT DEFAULT 'sent',       -- 'sent', 'delivered', 'read'
  created_at TIMESTAMP
);
```

## RLS Policies

All data tables use RLS policies ensuring users see only their own data.

**Example:**
```sql
CREATE POLICY user_subjects ON subjects
  FOR SELECT USING (profile_id = (
    SELECT id FROM profiles
    WHERE whatsapp_number = get_jwt_claim('sub')
  ));
```

**Applied to:** profiles, subjects, attendance_logs, study_timers, tasks, grades, bot_sessions, etc.

## Indexes

Performance-critical indexes:

```sql
CREATE INDEX idx_profiles_phone ON profiles(whatsapp_number);
CREATE INDEX idx_subjects_active ON subjects(profile_id, is_active);
CREATE INDEX idx_attendance ON attendance_logs(profile_id, subject_id, date);
CREATE INDEX idx_timers_active ON study_timers(profile_id, ended_at);
CREATE INDEX idx_tasks_pending ON tasks(profile_id, completed_at);
CREATE INDEX idx_otp ON otp_codes(whatsapp_number);
```

## Relationships

```
profiles (1) ──→ (M) subjects
         ├─→ (M) attendance_logs
         ├─→ (M) study_timers
         ├─→ (M) tasks
         ├─→ (M) grades
         └─→ (M) otp_codes

subjects (1) ──→ (M) attendance_logs
         └─→ (M) study_timers

academic_courses (1) ──→ (M) subjects
subject_categories (1) ──→ (M) subjects
```

## Common Queries

### Get User Profile
```sql
SELECT * FROM profiles WHERE whatsapp_number = '+91XXXXXX';
```

### List User''s Subjects
```sql
SELECT * FROM subjects 
WHERE profile_id = $1 AND is_active = true
ORDER BY created_at DESC;
```

### Get Attendance Stats
```sql
SELECT 
  s.name,
  COUNT(CASE WHEN al.status = 'present' THEN 1 END) as attended,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN al.status = 'present' THEN 1 END) / COUNT(*), 1) as percentage
FROM subjects s
LEFT JOIN attendance_logs al ON al.subject_id = s.id
WHERE s.profile_id = $1 AND s.is_active = true
GROUP BY s.id, s.name;
```

### Get Active Timer
```sql
SELECT * FROM study_timers
WHERE profile_id = $1 AND ended_at IS NULL
LIMIT 1;
```

## Extensions Used

- **uuid-ossp** — Generate UUIDs
- **pg_cron** — Schedule cron jobs
- **pgtap** — Unit testing (optional)

---

**Full Schema:** See ULTIMATE_CONSOLIDATED_SCHEMA.sql
