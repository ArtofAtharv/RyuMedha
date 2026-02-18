
# 🚀 Complete Schema - Quick Start Guide

## What's Included

This schema supports **BOTH Academic AND Personal tracking** with all critical bugs fixed:

### ✅ Fixed Issues
1. **RLS Function** - No longer tries to cast phone number to UUID
2. **OTP Table** - Added for web login authentication
3. **Bot Infrastructure** - Added sessions + message queue tables

### 📊 Database Structure

**14 Tables:**
```
Core:
- profiles (users)
- otp_codes (web login)

Academic Track:
- universities → programs → semesters → academic_courses
- attendance_logs (lecture tracking)
- grades (assessment marks)

Personal Track:
- subject_categories (user-defined categories)
- subjects (THE BRIDGE - academic OR personal)
- study_timers (for both academic and personal subjects)
- tasks (optionally linked to subjects)

Bot Infrastructure:
- bot_sessions (uptime tracking)
- message_queue (offline message handling)
```

---

## 🎯 Deployment Steps (10 minutes)

### **Step 1: Open Supabase SQL Editor**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Click **SQL Editor** in left sidebar
3. Click **New Query**

### **Step 2: Run the Complete Schema**
1. Open `COMPLETE_SCHEMA.sql`
2. Copy entire contents (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor (Ctrl+V)
4. Click **Run** (or Ctrl+Enter)
5. Wait ~10-15 seconds for execution

### **Step 3: Verify Installation**

Run this query to check tables:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected output (14 tables):**
```
academic_courses
attendance_logs
bot_sessions
grades
message_queue
otp_codes
profiles
programs
semesters
study_timers
subject_categories
subjects
tasks
universities
```

Run this query to check ENUM types:
```sql
SELECT typname FROM pg_type 
WHERE typtype = 'e' 
ORDER BY typname;
```

**Expected output (4 types):**
```
attendance_status
grade_type
subject_type
task_priority
```

Run this query to check views:
```sql
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
ORDER BY viewname;
```

**Expected output (5 views):**
```
academic_performance_summary
active_study_sessions
attendance_summary
study_stats_by_subject
upcoming_tasks
```

### **Step 4: Test RLS Function (CRITICAL)**

This verifies the bug fix:
```sql
-- Test the RLS function
SELECT get_profile_id_from_jwt();
-- Should return NULL (no JWT set yet)
-- If it errors, the function is broken
```

### **Step 5: Create Test User**

```sql
-- Insert test profile
INSERT INTO profiles (whatsapp_number, display_name, timezone)
VALUES ('+919876543210', 'Test User', 'Asia/Kolkata')
RETURNING *;

-- Seed default categories
SELECT seed_default_categories(
    (SELECT id FROM profiles WHERE whatsapp_number = '+919876543210')
);

-- Check categories were created
SELECT * FROM subject_categories 
WHERE profile_id = (SELECT id FROM profiles WHERE whatsapp_number = '+919876543210');
```

### **Step 6: Test Personal Subject Flow**

```sql
-- Create a personal subject
INSERT INTO subjects (profile_id, type, name, category_id, color_hex)
SELECT 
    p.id,
    'personal',
    'Python Programming',
    (SELECT id FROM subject_categories WHERE profile_id = p.id AND name = 'Coding & Tech'),
    '#3b82f6'
FROM profiles p
WHERE p.whatsapp_number = '+919876543210'
RETURNING *;

-- Start a study timer
INSERT INTO study_timers (profile_id, subject_id, started_at)
SELECT 
    p.id,
    s.id,
    NOW()
FROM profiles p
JOIN subjects s ON s.profile_id = p.id
WHERE p.whatsapp_number = '+919876543210'
  AND s.name = 'Python Programming'
RETURNING *;

-- View active sessions
SELECT * FROM active_study_sessions 
WHERE profile_id = (SELECT id FROM profiles WHERE whatsapp_number = '+919876543210');
```

### **Step 7: Test Academic Subject Flow (Optional)**

```sql
-- First, create a university
INSERT INTO universities (name, location, country)
VALUES ('Test University', 'Test City', 'India')
RETURNING *;

-- Create a program
INSERT INTO programs (university_id, name, degree_type, total_semesters, duration_years)
SELECT id, 'B.Tech Computer Science', 'UG', 8, 4.0
FROM universities WHERE name = 'Test University'
RETURNING *;

-- Create a semester
INSERT INTO semesters (program_id, semester_number, name)
SELECT id, 1, 'Semester 1'
FROM programs WHERE name = 'B.Tech Computer Science'
RETURNING *;

-- Create an academic course
INSERT INTO academic_courses (semester_id, course_code, course_name, credits, course_type)
SELECT s.id, 'CS101', 'Data Structures', 4.0, 'Core'
FROM semesters s 
JOIN programs p ON s.program_id = p.id
WHERE p.name = 'B.Tech Computer Science' AND s.semester_number = 1
RETURNING *;

-- Link user to this academic structure
UPDATE profiles
SET 
    academics_enabled = true,
    current_university_id = (SELECT id FROM universities WHERE name = 'Test University'),
    current_program_id = (SELECT id FROM programs WHERE name = 'B.Tech Computer Science'),
    current_semester_id = (SELECT id FROM semesters WHERE semester_number = 1 AND program_id = (SELECT id FROM programs WHERE name = 'B.Tech Computer Science'))
WHERE whatsapp_number = '+919876543210';

-- Create an academic subject (linked to course)
INSERT INTO subjects (profile_id, type, name, source_course_id, instructor_name)
SELECT 
    p.id,
    'academic',
    ac.course_name,
    ac.id,
    'Prof. John Doe'
FROM profiles p
CROSS JOIN academic_courses ac
WHERE p.whatsapp_number = '+919876543210'
  AND ac.course_code = 'CS101'
RETURNING *;

-- Mark attendance
INSERT INTO attendance_logs (profile_id, subject_id, lecture_date, status)
SELECT 
    p.id,
    s.id,
    CURRENT_DATE,
    'present'
FROM profiles p
JOIN subjects s ON s.profile_id = p.id
WHERE p.whatsapp_number = '+919876543210'
  AND s.name = 'Data Structures'
RETURNING *;

-- View attendance summary
SELECT * FROM attendance_summary 
WHERE profile_id = (SELECT id FROM profiles WHERE whatsapp_number = '+919876543210');
```

### **Step 8: Clean Up Test Data**

```sql
-- Delete test profile (cascades to all related data)
DELETE FROM profiles WHERE whatsapp_number = '+919876543210';

-- Delete test university (cascades to programs, semesters, courses)
DELETE FROM universities WHERE name = 'Test University';
```

---

## ✅ Success Checklist

After running the schema, you should have:

- [x] 14 tables created
- [x] 4 ENUM types created
- [x] 5 views created
- [x] RLS function works (returns NULL without JWT)
- [x] Can create test user
- [x] Can create personal subjects
- [x] Can create academic subjects (after setting up university structure)
- [x] Study timers work
- [x] Tasks work
- [x] Attendance tracking works
- [x] Grades tracking works

---

## 🔍 Key Differences from Original Schema

### What Changed:

1. **RLS Function (CRITICAL FIX)**
   - **Before:** Tried to cast `"+919876543210"` to UUID → crashed
   - **After:** Looks up profile by phone number → returns UUID
   
2. **OTP Table (ADDED)**
   - Missing in original schema
   - Required for web login flow
   
3. **Bot Tables (ADDED)**
   - `bot_sessions` - Track uptime and message throughput
   - `message_queue` - Store offline messages
   
4. **Views Enhanced**
   - Added `academic_performance_summary` for CGPA calculation
   - All views now distinguish between academic/personal subjects

### What Stayed the Same:

- ✅ Academic hierarchy (universities → programs → semesters → courses)
- ✅ Personal subject categories
- ✅ Dual-track subject system (academic OR personal)
- ✅ Study timer tracking
- ✅ Task management
- ✅ Attendance logging
- ✅ Grade tracking

---

## 📚 Understanding the Subject Bridge

The `subjects` table is the **central bridge** between academic and personal tracking:

### Academic Subject Example:
```sql
{
  "type": "academic",
  "name": "Data Structures",
  "source_course_id": "uuid-of-CS101-course", -- MUST be set
  "instructor_name": "Prof. John Doe",
  "expected_total_lectures": 45,
  "category_id": null, -- Not used for academic
  "label": null -- Not used for academic
}
```

### Personal Subject Example:
```sql
{
  "type": "personal",
  "name": "Python Programming",
  "source_course_id": null, -- Must be NULL for personal
  "category_id": "uuid-of-coding-category", -- Optional
  "label": "Professional",
  "color_hex": "#3b82f6"
}
```

**Constraint:** Academic subjects MUST have `source_course_id`, enforced by CHECK constraint.

---

## 🎨 Data Flow Examples

### Personal Learning Journey:
```
1. User signs up via WhatsApp → Profile created
2. Default categories seeded (Professional Development, Competitive Exams, etc.)
3. User creates personal subject: "CA Intermediate - Income Tax"
4. User starts study timer for this subject
5. User adds tasks: "Complete Chapter 5", "Practice MCQs"
6. User tracks study hours via dashboard
```

### Academic Student Journey:
```
1. User signs up via WhatsApp → Profile created
2. User selects university + program in dashboard
3. System loads pre-defined courses for current semester
4. User creates academic subjects (linked to courses)
5. User marks daily attendance
6. User enters assessment marks (MidSem, EndSem, Project)
7. System calculates CGPA automatically
8. User can ALSO create personal subjects alongside academic ones
```

### Hybrid Use Case:
```
User can have:
- 6 academic subjects (from university curriculum)
- 3 personal subjects (side projects, interview prep)
- Study timers work for BOTH types
- Tasks can link to BOTH types
```

---

## 🔧 Common Queries

### Get all subjects for a user (both types):
```sql
SELECT 
    s.*,
    CASE 
        WHEN s.type = 'academic' THEN ac.course_name
        ELSE s.name
    END as display_name,
    CASE 
        WHEN s.type = 'academic' THEN ac.course_code
        ELSE sc.name
    END as category_or_code
FROM subjects s
LEFT JOIN academic_courses ac ON s.source_course_id = ac.id
LEFT JOIN subject_categories sc ON s.category_id = sc.id
WHERE s.profile_id = 'USER_UUID_HERE'
  AND s.is_active = true;
```

### Calculate total study hours today:
```sql
SELECT 
    s.name,
    s.type,
    COUNT(*) as sessions_today,
    ROUND(SUM(st.duration_seconds) / 3600.0, 2) as hours_today
FROM study_timers st
JOIN subjects s ON st.subject_id = s.id
WHERE st.profile_id = 'USER_UUID_HERE'
  AND st.started_at >= CURRENT_DATE
  AND st.ended_at IS NOT NULL
GROUP BY s.id, s.name, s.type;
```

### Get upcoming deadlines:
```sql
SELECT 
    t.title,
    t.due_date,
    t.priority,
    s.name as subject_name,
    s.type as subject_type,
    EXTRACT(DAY FROM (t.due_date - NOW())) as days_remaining
FROM tasks t
LEFT JOIN subjects s ON t.subject_id = s.id
WHERE t.profile_id = 'USER_UUID_HERE'
  AND NOT t.is_completed
  AND t.due_date >= CURRENT_DATE
ORDER BY t.due_date ASC, t.priority DESC
LIMIT 10;
```

### Calculate semester SGPA (academic subjects only):
```sql
SELECT 
    ROUND(AVG(aps.grade_points), 2) as sgpa,
    SUM(aps.credits) as total_credits
FROM academic_performance_summary aps
WHERE aps.profile_id = 'USER_UUID_HERE'
  AND aps.semester_id = 'SEMESTER_UUID_HERE';
```

---

## 🚨 Troubleshooting

### Error: "extension uuid-ossp does not exist"
**Fix:** Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Error: "type already exists"
**Fix:** You've run the schema before. Either:
```sql
-- Drop all types (will cascade delete tables)
DROP TYPE IF EXISTS subject_type CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS grade_type CASCADE;

-- Then re-run the full schema
```

### Error: "relation already exists"
**Fix:** Drop all tables and start fresh:
```sql
-- WARNING: This deletes all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then re-run the full schema
```

### RLS not working (seeing all users' data)
**Test:**
```sql
-- Set JWT claim to test RLS
SET request.jwt.claims = '{"sub": "+919876543210"}';

-- This should only return one user's profile
SELECT * FROM profiles;

-- Reset
RESET request.jwt.claims;
```

---

## 🎯 Next Steps

### Day 1 Afternoon (After DB Setup):
1. ✅ Schema deployed and verified
2. 📱 Set up WhatsApp Business API account
3. ⚡ Deploy edge functions (send-otp, verify-otp)
4. 🤖 Start building bot webhook handler

### Day 2:
1. 🖥️ Initialize Next.js project
2. 🔐 Implement Auth.js with WhatsApp OTP
3. 🎨 Build dashboard layout

### Day 3-5:
1. 📚 Subjects CRUD (both academic and personal)
2. ⏱️ Study timer UI
3. ✅ Tasks UI

### Day 6-7:
1. 📊 Attendance tracking (academic)
2. 📝 Grades entry (academic)
3. 🤖 Bot commands (start, stop, stats)

---

## 💡 Pro Tips

1. **Start with Personal Track**
   - Easier to test without needing university setup
   - Works for all user types
   - Add academic track later

2. **Seed Universities in Production**
   - Create a seeding script for common universities
   - Let users request additions via form
   - Keep reference data clean

3. **Use Views for Dashboard**
   - `study_stats_by_subject` for overview cards
   - `upcoming_tasks` for task list
   - `attendance_summary` for academic dashboard
   - `academic_performance_summary` for CGPA

4. **Monitor Bot Performance**
   - Check `bot_sessions` table regularly
   - Track `messages_processed` metric
   - Alert if session ends unexpectedly

---

## 📞 Need Help?

- Schema not working? Check verification queries above
- RLS issues? Test with sample JWT claim
- Want to understand relationships? See data flow examples
- Need query help? Check common queries section

**Ready to build!** 🚀 Your database is production-ready with both academic AND personal tracking support.
