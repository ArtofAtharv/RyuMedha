# Product Requirements Document (PRD)
## RyuMedha - WhatsApp-First Student Productivity SaaS

**Version:** 1.0  
**Last Updated:** February 16, 2026  
**Document Owner:** Atharv  
**Status:** Approved for Development

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Strategy](#2-product-vision--strategy)
3. [Target Audience](#3-target-audience)
4. [User Personas](#4-user-personas)
5. [Product Features](#5-product-features)
6. [User Flows](#6-user-flows)
7. [Success Metrics](#7-success-metrics)
8. [Release Plan](#8-release-plan)
9. [Dependencies & Risks](#9-dependencies--risks)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Executive Summary

### 1.1 Problem Statement

Students and professionals in India struggle with fragmented productivity tools:
- **Multiple apps** for different needs (attendance, study time, tasks, grades)
- **Complex signup processes** requiring email verification and passwords
- **Poor mobile experience** - most tools are desktop-first
- **No WhatsApp integration** - users must switch contexts constantly
- **Lack of flexibility** - tools are either academic-only or personal-only, not both

### 1.2 Solution Overview

**RyuMedha** is a WhatsApp-first productivity SaaS that unifies academic and personal tracking through a single, mobile-optimized platform. Users sign up via WhatsApp (no email/password required), access features through both a conversational bot and a web dashboard, and maintain complete control over their data.

### 1.3 Key Differentiators

| Feature | Traditional Tools | RyuMedha |
|---------|------------------|--------------|
| **Identity** | Email + Password | WhatsApp Number (OTP) |
| **Interface** | Web/App only | WhatsApp Bot + Web Dashboard |
| **Tracking** | Academic OR Personal | Both (user choice) |
| **Signup Time** | 5-10 minutes | 30 seconds |
| **Mobile UX** | Poor | Native (WhatsApp) |
| **Data Control** | Vendor lock-in | Export anytime |

### 1.4 Business Model

**Launch (0-500 users):** Free
- Goal: Validate product-market fit
- Gather usage data and feedback
- Build network effects via referrals

**Scale (500+ users):**
- **Free Tier:** Personal track only, 5 subjects max, basic features
- **Pro Tier ($5/month):** Unlimited subjects, academic track, analytics, priority bot
- **Team Tier ($15/month for 5 users):** Study groups, shared tasks, collaborative features

---

## 2. Product Vision & Strategy

### 2.1 Vision Statement

**"Make student productivity as simple as sending a WhatsApp message."**

### 2.2 Mission

Empower students and lifelong learners to track their academic progress and personal learning goals without the complexity of traditional productivity tools.

### 2.3 Strategic Goals (6 Months)

1. **Acquisition:** Reach 1,000 active users (50% students, 50% professionals)
2. **Engagement:** Average 15 bot interactions per user per week
3. **Retention:** 60% of users return after 7 days
4. **Revenue:** Convert 10% of users to Pro tier ($500 MRR)
5. **Product:** Ship both academic and personal tracks with <2s bot response time

### 2.4 Market Positioning

**Primary Market:** India (English + Hindi users)
- 40M+ college students
- 100M+ competitive exam aspirants (CA, UPSC, JEE, NEET)
- 200M+ working professionals upskilling

**Secondary Markets (Future):** Southeast Asia, Middle East

---

## 3. Target Audience

### 3.1 Primary Audience

**College Students (60% of users)**
- Age: 18-24
- Use case: Track attendance, grades, assignments, exam prep
- Pain: Manual attendance tracking, forgetting deadlines, no CGPA calculator
- Devices: Android phone (primary), occasional laptop access
- WhatsApp usage: 4+ hours/day

**Competitive Exam Aspirants (30% of users)**
- Age: 20-28
- Use case: Track study hours for CA/UPSC/GATE preparation
- Pain: No structured tracking, motivation issues, scattered notes
- Devices: Budget Android phone
- WhatsApp usage: 3+ hours/day

**Working Professionals (10% of users)**
- Age: 25-35
- Use case: Track skill development (coding, languages, certifications)
- Pain: Lack of time, need quick tracking, work-life balance
- Devices: Mid-range smartphone, laptop
- WhatsApp usage: 2+ hours/day (work + personal)

### 3.2 Non-Target Audience (Initially)

- School students (K-12) - simpler needs, parental involvement
- International users (English-only initially)
- Enterprise/corporate training - different requirements

---

## 4. User Personas

### Persona 1: Rajesh - Engineering Student

**Demographics:**
- Age: 20
- Location: Bangalore
- Education: B.Tech Computer Science, 3rd Year
- Device: Samsung Galaxy A52 (Android)

**Goals:**
- Maintain >85% attendance to qualify for placements
- Track study hours for competitive coding prep
- Manage assignment deadlines
- Calculate CGPA automatically

**Pain Points:**
- Forgets which classes he attended
- No central place for all subjects
- Manual CGPA calculation is tedious
- Too many apps (Google Calendar, Excel, Notes)

**Behavior:**
- Checks WhatsApp 50+ times/day
- Uses phone primarily (laptop only for coding)
- Shares memes and notes via WhatsApp groups
- Prefers voice notes over typing

**Motivations:**
- Get placed in FAANG company
- Stay ahead of peers
- Avoid attendance shortage panic

**Frustrations:**
- Current attendance apps require college credentials (privacy concern)
- Excel sheets don't work on mobile
- Notion too complex for simple tracking

**How RyuMedha Helps:**
- "Start data structures" command starts timer instantly
- Weekly attendance summary via WhatsApp
- CGPA updates after entering marks
- Dashboard accessible on phone browser

---

### Persona 2: Priya - CA Aspirant

**Demographics:**
- Age: 24
- Location: Pune
- Education: B.Com graduate, preparing for CA Inter
- Device: Redmi Note 11 (Budget Android)

**Goals:**
- Study 8 hours/day consistently
- Track progress for 5 subjects (Tax, Audit, Costing, FM, Law)
- Stay motivated through long preparation period
- Prove to parents she's serious about CA

**Pain Points:**
- Loses track of study hours
- No accountability system
- Gets distracted by social media
- Feels isolated (self-study)

**Behavior:**
- Studies in 2-hour blocks
- Takes breaks every 30 minutes
- Active in CA WhatsApp groups
- Listens to motivational podcasts

**Motivations:**
- Clear CA Inter in first attempt
- Build a career in finance
- Make parents proud

**Frustrations:**
- Study tracker apps are too technical
- Forest app doesn't track subject-wise hours
- No way to share progress with study partner

**How RyuMedha Helps:**
- "Start income tax" → timer begins
- Daily summary: "You studied 7.5 hours today - great job! 🎉"
- Weekly report shared with accountability partner
- Personal subjects (not academic) fit her use case

---

### Persona 3: Arjun - Working Professional

**Demographics:**
- Age: 28
- Location: Hyderabad
- Education: B.E. Mechanical, working in IT
- Device: iPhone 12, MacBook Pro

**Goals:**
- Learn Python for career switch to data science
- Track progress on Udemy courses
- Maintain work-life balance
- Get AWS certification in 6 months

**Pain Points:**
- Limited time (only 2 hours/day after work)
- Needs to track multiple learning paths
- Forgets what he studied yesterday
- No motivation when progress isn't visible

**Behavior:**
- Studies after dinner (9 PM - 11 PM)
- Weekend study sessions (4-5 hours)
- Reads tech blogs during commute
- Active in tech communities

**Motivations:**
- Career growth (higher salary)
- Intellectual challenge
- Build side projects

**Frustrations:**
- Toggl too enterprise-focused
- Notion overkill for simple tracking
- Coursera progress tracking limited to platform

**How RyuMedha Helps:**
- "Start python" while opening laptop
- Tracks Udemy + LeetCode + Projects separately
- Weekly digest: "20 hours this week - you're on track! 💪"
- Works seamlessly across phone and laptop

---

## 5. Product Features

### 5.1 Feature Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RyuMedha Features                     │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
      ┌─────▼──────┐                     ┌─────▼──────┐
      │  CORE      │                     │  PLATFORM  │
      │  FEATURES  │                     │  FEATURES  │
      └─────┬──────┘                     └─────┬──────┘
            │                                   │
    ┌───────┴────────┐                 ┌────────┴────────┐
    │                │                 │                 │
┌───▼───┐      ┌─────▼─────┐      ┌───▼────┐      ┌────▼────┐
│Subject│      │ Study     │      │WhatsApp│      │   Web   │
│Manager│      │ Tracker   │      │  Bot   │      │Dashboard│
└───┬───┘      └─────┬─────┘      └───┬────┘      └────┬────┘
    │                │                 │                 │
    └────────────────┴─────────────────┴─────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
        ┌─────▼──────┐       ┌─────▼──────┐
        │ ACADEMIC   │       │  PERSONAL  │
        │   TRACK    │       │   TRACK    │
        └─────┬──────┘       └─────┬──────┘
              │                     │
      ┌───────┴────────┐    ┌──────┴───────┐
      │                │    │              │
  ┌───▼────┐    ┌─────▼──┐ │   ┌─────▼────┐
  │Attend- │    │ Grades │ │   │Categories│
  │ance    │    │ & CGPA │ │   │& Labels  │
  └────────┘    └────────┘ │   └──────────┘
                            │
                     ┌──────▼──────┐
                     │   Tasks     │
                     │ Management  │
                     └─────────────┘
```

---

### 5.2 Core Features (MVP - Week 1-2)

#### **5.2.1 WhatsApp Authentication**

**Description:** Passwordless signup and login using phone number verification.

**User Stories:**
- As a new user, I want to sign up by messaging a WhatsApp number, so I don't need email/password
- As a returning user, I want to login via OTP sent to WhatsApp, so it's fast and secure

**Acceptance Criteria:**
1. User sends any message to bot WhatsApp number
2. Bot creates profile with phone number as identity
3. Bot responds with welcome message + dashboard link
4. User visits dashboard → enters phone number → receives OTP via WhatsApp
5. User enters OTP → logs in within 5 minutes of code generation
6. Invalid/expired OTP shows clear error message

**Technical Notes:**
- WhatsApp number stored in E.164 format (+919876543210)
- OTP: 6 digits, 5-minute expiry
- JWT issued after OTP verification (7-day expiry)
- Rate limit: 5 OTP requests per hour per phone

---

#### **5.2.2 Subject Management**

**Description:** Create and organize subjects (academic or personal).

**User Stories:**
- As a student, I want to create subjects from my semester courses, so I can track institutional learning
- As a professional, I want to create custom subjects like "Python" or "Spanish", so I can track personal goals
- As a user, I want to organize subjects by category, so I can see patterns

**Acceptance Criteria:**

**Personal Subjects:**
1. User clicks "Add Subject" on dashboard
2. User enters subject name (e.g., "Python Programming")
3. User selects category (Coding, Professional, Hobby, etc.) - optional
4. User chooses color for visual identification - optional
5. Subject appears in dashboard immediately

**Academic Subjects (Phase 2):**
1. User enables "Academic Track" in settings
2. User selects University → Program → Semester
3. System loads pre-defined courses for that semester
4. User creates subjects linked to courses
5. Each subject shows course code, credits, instructor

**Edge Cases:**
- Duplicate subject names allowed (different semesters)
- Category deletion doesn't delete subjects (sets category to null)
- Subject archive (soft delete) preserves historical data

---

#### **5.2.3 Study Timer**

**Description:** Track study sessions with start/stop functionality.

**User Stories:**
- As a user, I want to start a timer when I begin studying, so I can track time accurately
- As a user, I want to stop the timer when I take a break, so I don't inflate my study hours
- As a user, I want to see total hours per subject, so I know where I'm spending time

**Acceptance Criteria:**

**Via WhatsApp Bot:**
1. User sends "start [subject name]"
2. Bot confirms timer started + shows elapsed time
3. User sends "stop" when done
4. Bot shows session duration + total hours today
5. Bot queues commands if received offline, processes when online

**Via Web Dashboard:**
1. User clicks "Start Timer" button on subject card
2. Timer shows elapsed time (updates every second)
3. User clicks "Stop" to end session
4. Dashboard updates total hours for that subject
5. History shows all past sessions with date/time

**Edge Cases:**
- Only one active timer per user at a time
- If user starts timer for Subject A while Subject B is active, prompt to stop B first
- If user closes app/browser, timer continues (saved in DB)
- Manual entry option for forgot-to-track scenarios

**Analytics:**
- Daily breakdown: "You studied 7 hours today"
- Weekly summary: "Best streak: 5 days, Total: 42 hours"
- Subject-wise distribution pie chart

---

#### **5.2.4 Task Management**

**Description:** Microsoft To-Do style task tracking with subject linking.

**User Stories:**
- As a user, I want to create tasks with due dates, so I don't miss deadlines
- As a user, I want to link tasks to subjects (optional), so I can see all work for a subject
- As a user, I want to mark tasks complete, so I feel accomplished

**Acceptance Criteria:**
1. User creates task: Title, Description (optional), Due Date (optional), Priority, Subject link (optional)
2. Tasks appear in "My Tasks" section sorted by due date
3. User can filter by: Pending, Completed, Today, This Week, By Subject
4. User checks checkbox to mark complete → task moves to completed section
5. Overdue tasks highlighted in red with days overdue count

**Views:**
- **My Day:** Tasks due today + user-added tasks
- **Important:** High/Urgent priority tasks
- **Planned:** Tasks with due dates
- **All:** Complete task list

**Notifications (Future):**
- WhatsApp message 1 day before due date
- WhatsApp message 1 hour before due date (if enabled)

---

### 5.3 Academic Track Features (Phase 2 - Week 3-4)

#### **5.3.1 Attendance Tracking**

**Description:** Daily lecture attendance marking with percentage calculation.

**User Stories:**
- As a student, I want to mark attendance for each lecture, so I know my attendance status
- As a student, I want to see attendance percentage per subject, so I stay above minimum requirement
- As a student, I want to see warnings if attendance is low, so I can take action

**Acceptance Criteria:**
1. User creates academic subject with expected total lectures
2. User marks attendance: Present, Absent, Cancelled
3. Dashboard shows: Attended / Total lectures (XX%)
4. Color coding: Green (>75%), Yellow (65-75%), Red (<65%)
5. Calendar view shows all marked/unmarked dates
6. Holidays excluded from calculation

**Smart Features:**
- Predict future attendance based on schedule (Mon/Wed/Fri)
- "Mark Today's Classes" button - bulk mark all subjects for today
- Projection: "If you attend all remaining classes, final attendance: 82%"

**Data Entry Methods:**
1. Manual: Click date → select Present/Absent
2. Bulk: "Mark all as Present for this week"
3. Bot: "attended data structures" → marks today as present

---

#### **5.3.2 Grades & CGPA**

**Description:** Track assessment marks and calculate GPA automatically.

**User Stories:**
- As a student, I want to enter marks for MidSem/EndSem/Project, so I can calculate final grade
- As a student, I want to see SGPA for current semester, so I know my standing
- As a student, I want to see CGPA across all semesters, so I can track overall performance

**Acceptance Criteria:**
1. User enters marks for each assessment type: MidSem, EndSem, Viva, Project, Assignment, Quiz
2. Each assessment has max marks and weightage (e.g., MidSem: 30 marks, 30% weight)
3. System calculates total percentage
4. System assigns grade points based on percentage:
   - 90-100: 10 (A+)
   - 80-89: 9 (A)
   - 70-79: 8 (B+)
   - 60-69: 7 (B)
   - 50-59: 6 (C)
   - 40-49: 5 (D)
   - <40: 0 (F)
5. SGPA = Average of all subjects' grade points
6. CGPA = Weighted average across all semesters

**Visualizations:**
- Grade distribution chart (how many A+, A, B+, etc.)
- Semester-wise SGPA trend line
- Subject-wise performance bar chart

---

### 5.4 Platform Features

#### **5.4.1 WhatsApp Bot Commands**

**Description:** Natural language commands for common actions.

**Supported Commands (MVP):**

| Command | Action | Example Response |
|---------|--------|------------------|
| `help` | Show command list | "📚 Available commands: help, start, stop, stats, tasks" |
| `start [subject]` | Start study timer | "✅ Timer started for Python Programming" |
| `stop` | Stop active timer | "⏹️ Stopped! Duration: 1h 23m" |
| `stats` | Show today's summary | "⏱️ Study time: 5h 12m, ✅ Pending tasks: 3" |
| `tasks` | List pending tasks | "1. Complete assignment (Due: Tomorrow)" |

**Future Commands:**
- `attended [subject]` - Mark today as present
- `add task [title]` - Create task via bot
- `remind me to [action]` - Set reminder

**Conversation Design Principles:**
1. **Brevity:** Responses <160 characters (single WhatsApp message)
2. **Emoji:** Use emoji for visual hierarchy (✅ ⏱️ 📚 ❌)
3. **Clarity:** Avoid ambiguity, confirm actions explicitly
4. **Error Handling:** Suggest correction if command unclear

---

#### **5.4.2 Web Dashboard**

**Description:** Desktop/mobile web interface for detailed management.

**Pages:**

**1. Dashboard (Home):**
- Stats cards: Study Time Today, Active Subjects, Pending Tasks, SGPA (if academic)
- Quick actions: Start Timer, Add Task
- Recent activity feed

**2. Subjects:**
- Grid view of all subjects (cards with colors)
- Filter: Academic / Personal / All
- Search bar
- Add Subject button
- Each card shows: Name, Category/Course Code, Last studied, Total hours

**3. Tasks:**
- Microsoft To-Do clone
- Left sidebar: My Day, Important, Planned, By Subject
- Main area: Task list with checkboxes
- Right sidebar: Task details (when selected)
- Add Task button (floating)

**4. Study Timers:**
- Active timer display (large, prominent)
- Start/Stop/Pause controls
- History: Table of all sessions (Date, Subject, Duration)
- Charts: Daily trend, Subject distribution
- Export CSV button

**5. Attendance (Academic):**
- Subject selector dropdown
- Calendar view with color-coded dates
- Summary stats: XX% attended, YY lectures total
- Projection calculator

**6. Grades (Academic):**
- Subject cards with grade entry forms
- SGPA display (large number)
- CGPA across semesters
- Grade distribution chart

**7. Settings:**
- Profile: Name, Email, Timezone
- Module toggles: Enable/Disable Academic Track
- Academic setup: Select University, Program, Semester
- Notifications: Configure WhatsApp alerts
- Export data: Download all data as JSON/CSV
- Delete account

**Design System:**
- **Style:** Shadcn UI (New York variant, Neutral theme)
- **Colors:** Neutral grays + Purple accent (#8b5cf6)
- **Typography:** Variable fonts, clear hierarchy
- **Layout:** Responsive (mobile-first), sidebar navigation
- **Dark mode:** System preference auto-detect

---

### 5.5 Bot Operational Features

#### **5.5.1 Bot Availability**

**Description:** Manage bot runtime and offline message handling.

**Phase 1 (0-100 users):**
- Bot online: 7 PM - 11 PM IST (4 hours/day)
- Offline auto-response: "🤖 I'm offline. Use dashboard: RyuMedha.in"
- Messages queued for processing when bot comes online

**Phase 2 (100-500 users):**
- Bot online: 7 AM - 9 AM, 8 PM - 11 PM IST (5 hours/day)
- User notification 15 min before shutdown

**Phase 3 (500+ users):**
- Bot online: 24/7 (Mini-PC migration)

**Status Indicator:**
- Dashboard shows: 🟢 Bot Online / 🔴 Bot Offline (7 PM - 11 PM)
- Bot sends broadcast when coming online

---

#### **5.5.2 Offline Message Queue**

**Description:** Store messages received when bot is offline, process when online.

**Behavior:**
1. Message received while bot offline → stored in `message_queue` table
2. User receives instant auto-response: "Message saved, will respond when online"
3. Bot startup → processes all queued messages in FIFO order
4. Rate limit: Process 1 message per 100ms (prevent spam)
5. User receives delayed response with note: "⏱️ Processed offline message:"

---

## 6. User Flows

### 6.1 Onboarding Flow (New User)

```
┌──────────────────────────────────────────────────────────────┐
│  USER HEARS ABOUT RYUMEDHA FROM FRIEND                   │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User saves WhatsApp   │
              │ number: +91XXXXXXXXXX │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User sends "Hi"       │
              └───────────┬───────────┘
                          │
                          ▼
              ┌─────────────────────────────────┐
              │ Bot: "🎓 Welcome to RyuMedha!│
              │ I'm your study companion.        │
              │                                  │
              │ 📱 Visit: RyuMedha.in       │
              │ Type 'help' for commands"        │
              └───────────┬─────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User visits website   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Enter phone number    │
              │ +919876543210         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌─────────────────────────────────┐
              │ WhatsApp notification received:  │
              │ "🔐 Your login code: 123456"     │
              └───────────┬─────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User enters OTP       │
              │ on website            │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Redirected to         │
              │ Dashboard             │
              └───────────┬───────────┘
                          │
                          ▼
              ┌─────────────────────────────────┐
              │ Dashboard shows:                 │
              │ "Welcome! Let's add your first   │
              │  subject to start tracking."     │
              │                                  │
              │ [Add Subject Button]             │
              └───────────┬─────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User creates subject  │
              │ "Python Programming"  │
              └───────────┬───────────┘
                          │
                          ▼
              ┌─────────────────────────────────┐
              │ Onboarding complete! 🎉          │
              │ Total time: ~2 minutes           │
              └──────────────────────────────────┘
```

**Success Metrics:**
- 90% of users complete signup within 3 minutes
- 80% create first subject within 5 minutes
- 70% start first timer within 10 minutes

---

### 6.2 Daily Usage Flow (Returning User)

**Morning Routine:**
```
7:00 AM - Rajesh wakes up
7:30 AM - Opens WhatsApp, sees bot online notification
7:35 AM - Types "stats" → Sees yesterday's 6 hours study time
7:36 AM - Motivated, starts day
```

**Study Session:**
```
8:00 PM - Sits down to study
8:01 PM - Types "start data structures"
8:02 PM - Bot: "✅ Timer started for Data Structures"
8:03 PM - Opens laptop, starts coding practice
10:15 PM - Finishes session
10:16 PM - Types "stop"
10:17 PM - Bot: "⏹️ Stopped! Duration: 2h 15m. Great work! 💪"
```

**Task Management:**
```
10:30 PM - Remembers assignment due tomorrow
10:31 PM - Opens dashboard on phone
10:32 PM - Adds task: "Submit OS assignment"
10:33 PM - Sets due date: Tomorrow 11:59 PM
10:34 PM - Sets priority: Urgent
10:35 PM - Task saved, goes to sleep
```

**Next Day:**
```
5:00 PM - WhatsApp notification: "⏰ Reminder: Submit OS assignment due in 6 hours"
5:05 PM - Completes assignment
5:10 PM - Checks task on dashboard
5:11 PM - Feels accomplished, continues studying
```

---

### 6.3 Academic Setup Flow (College Student)

```
User clicks "Enable Academic Track" in Settings
              │
              ▼
┌──────────────────────────────────┐
│ Select your university:          │
│ [Search box]                     │
│ • Ramaiah Institute (Bangalore)  │
│ • Delhi University               │
│ • IIT Bombay                     │
│ + Can't find? Request addition   │
└────────────┬─────────────────────┘
             │
             ▼ (Selected: Ramaiah Institute)
┌──────────────────────────────────┐
│ Select your program:             │
│ • B.Tech Computer Science        │
│ • B.Tech Mechanical              │
│ • MCA                            │
└────────────┬─────────────────────┘
             │
             ▼ (Selected: B.Tech CS)
┌──────────────────────────────────┐
│ Select current semester:         │
│ • Semester 1                     │
│ • Semester 2                     │
│ ...                              │
│ • Semester 8                     │
└────────────┬─────────────────────┘
             │
             ▼ (Selected: Semester 5)
┌──────────────────────────────────────┐
│ Available courses for Semester 5:    │
│                                      │
│ ☐ CS501 - Operating Systems (4 cr)  │
│ ☐ CS502 - DBMS (4 cr)                │
│ ☐ CS503 - Computer Networks (4 cr)  │
│ ☐ CS504 - Software Engg (3 cr)      │
│ ☐ CS505 - Web Tech (3 cr)           │
│                                      │
│ Select courses you're enrolled in:  │
│ [Select All] [Create Subjects]      │
└────────────┬─────────────────────────┘
             │
             ▼ (Selected 5 courses)
┌──────────────────────────────────┐
│ Creating subjects...             │
│ ✓ Operating Systems              │
│ ✓ DBMS                           │
│ ✓ Computer Networks              │
│ ✓ Software Engineering           │
│ ✓ Web Technologies               │
│                                  │
│ Academic track setup complete! ✅ │
│ [Go to Dashboard]                │
└──────────────────────────────────┘
```

**Time to Complete:** 2-3 minutes

---

### 6.4 Error Handling Flows

#### **Scenario 1: Invalid OTP**
```
User enters OTP: 123456
    │
    ▼
System checks: OTP exists? Expired? Used?
    │
    ├─ Valid ─→ Login successful
    │
    └─ Invalid ─→ Show error: "Invalid or expired OTP. Request a new one?"
                  [Resend OTP Button]
```

#### **Scenario 2: Bot Offline Command**
```
User sends "start python" at 3 PM (bot offline)
    │
    ▼
Webhook receives message
    │
    ▼
Bot offline ─→ Save to message_queue
    │           │
    │           └─→ Auto-response: "🤖 I'm offline (online 7-11 PM).
    │                Your message is saved!"
    │
    ▼
7:00 PM - Bot starts
    │
    ▼
Process queued messages
    │
    ▼
Execute "start python" command
    │
    ▼
Send delayed response: "⏱️ Timer started (processed offline message)"
```

#### **Scenario 3: Duplicate Subject Name**
```
User creates subject "Python"
    │
    ▼
Check: Subject "Python" already exists?
    │
    ├─ No ─→ Create subject
    │
    └─ Yes ─→ Show warning: "Subject 'Python' already exists. 
                Create anyway? (Useful for different semesters)"
              [Create Anyway] [Cancel]
```

---

## 7. Success Metrics

### 7.1 Acquisition Metrics

| Metric | Target (Month 1) | Target (Month 3) | Target (Month 6) |
|--------|------------------|------------------|------------------|
| **Total Signups** | 100 | 500 | 1,000 |
| **Signup Rate** | 70% of visitors | 75% | 80% |
| **Referral Rate** | 10% | 20% | 30% |
| **Organic vs Paid** | 80% organic | 70% organic | 60% organic |

**Tracking:**
- WhatsApp signups tracked in `profiles` table
- Web logins tracked via Auth.js sessions
- Referral codes (future feature)

---

### 7.2 Engagement Metrics

| Metric | Target (Week 1) | Target (Month 1) | Target (Month 3) |
|--------|-----------------|------------------|------------------|
| **DAU** | 30 | 200 | 500 |
| **WAU** | 60 | 350 | 700 |
| **MAU** | 100 | 500 | 1,000 |
| **DAU/MAU Ratio** | 30% | 40% | 50% |
| **Avg Session Time** | 5 min | 8 min | 12 min |
| **Bot Messages/User/Week** | 5 | 10 | 15 |
| **Dashboard Visits/User/Week** | 3 | 5 | 7 |

**Key Actions Tracked:**
- Subject created
- Timer started/stopped
- Task created/completed
- Attendance marked
- Grade entered

---

### 7.3 Retention Metrics

| Metric | Target |
|--------|--------|
| **D1 Retention** | 60% |
| **D7 Retention** | 40% |
| **D30 Retention** | 25% |
| **Churn Rate** | <10% monthly |

**Cohort Analysis:**
- Group users by signup week
- Track retention over 12 weeks
- Identify drop-off points

---

### 7.4 Product Metrics

| Metric | Target |
|--------|--------|
| **Avg Subjects per User** | 3-5 |
| **Avg Study Hours/User/Week** | 10-15 hours |
| **Avg Tasks Created/User/Week** | 3-5 |
| **Task Completion Rate** | >70% |
| **Bot Response Time** | <2 seconds (95th percentile) |
| **Dashboard Load Time** | <1.5 seconds |
| **OTP Delivery Success** | >95% |

---

### 7.5 Business Metrics (Post-Launch)

| Metric | Month 3 | Month 6 |
|--------|---------|---------|
| **MRR** | $100 | $500 |
| **Paying Users** | 20 | 100 |
| **Conversion Rate (Free → Pro)** | 5% | 10% |
| **CAC** | $0 (organic) | $5 (if paid ads) |
| **LTV** | $60 (12 months) | $120 (24 months) |
| **LTV/CAC** | ∞ (organic) | 12x |

---

### 7.6 North Star Metric

**"Total Study Hours Tracked Per Week"**

**Why:**
- Directly measures core value delivery (time tracking)
- Reflects user engagement (active usage)
- Correlates with retention (users who track >5h/week stay longer)
- Easy to understand and communicate

**Target:**
- Month 1: 500 hours/week (100 users × 5 hours avg)
- Month 3: 5,000 hours/week (500 users × 10 hours avg)
- Month 6: 15,000 hours/week (1,000 users × 15 hours avg)

---

## 8. Release Plan

### 8.1 MVP Launch (Week 1-2)

**Scope:**
- ✅ WhatsApp authentication
- ✅ Personal subjects only
- ✅ Study timer (bot + web)
- ✅ Basic task management
- ✅ Bot commands: help, start, stop, stats
- ✅ Dashboard with stats cards

**Target Users:** 10-20 beta users (friends, classmates)

**Success Criteria:**
- 10 users signed up
- 50+ study timers created
- 30+ tasks created
- Zero critical bugs
- Avg bot response time <2s

---

### 8.2 Academic Track Launch (Week 3-4)

**Scope:**
- ✅ University/program selection
- ✅ Academic subjects (linked to courses)
- ✅ Attendance tracking
- ✅ Grade management + CGPA calculation
- ✅ Calendar view for attendance
- ✅ Performance charts

**Target Users:** 50-100 users (expand beyond beta)

**Success Criteria:**
- 50 users total (30 new)
- 20 users enable academic track
- 100+ attendance logs created
- 50+ grade entries
- 70% D7 retention

---

### 8.3 Polish & Scale (Month 2)

**Scope:**
- ✅ Bot natural language improvements
- ✅ Dashboard mobile optimization
- ✅ Export data feature
- ✅ Email notifications (optional backup)
- ✅ Referral program
- ✅ Help documentation

**Target Users:** 200-500 users

**Success Criteria:**
- 200 DAU
- 40% DAU/MAU ratio
- <5% churn rate
- NPS score >40

---

### 8.4 Monetization Launch (Month 3)

**Scope:**
- ✅ Free tier limits (5 subjects, basic features)
- ✅ Pro tier ($5/month): Unlimited subjects, analytics, priority bot
- ✅ Payment integration (Razorpay)
- ✅ Upgrade prompts
- ✅ Billing management

**Target Users:** 500-1,000 users

**Success Criteria:**
- 5% conversion to Pro tier
- $100 MRR
- <2% payment failures
- Clear value communication

---

## 9. Dependencies & Risks

### 9.1 Technical Dependencies

| Dependency | Risk Level | Mitigation |
|------------|-----------|------------|
| **WhatsApp Cloud API** | High | Have backup SMS OTP ready |
| **Supabase Uptime** | Medium | Monitor SLA, have data export |
| **Cloudflare Tunnel** | Low | Easy switch to ngrok if needed |
| **Bot Server Uptime** | High | Migrate to Mini-PC by 500 users |

---

### 9.2 Product Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Low user adoption** | High | Medium | Iterate based on feedback, pivot if needed |
| **WhatsApp API costs** | Medium | Low | User-initiated messages are free, optimize bot |
| **Bot downtime complaints** | Medium | High | Clear communication of 7-11 PM window |
| **Academic data accuracy** | High | Medium | Crowdsource university curricula, verify |
| **Competitor launch** | Medium | Low | Move fast, build network effects |

---

### 9.3 Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Data loss** | Critical | Daily Supabase backups + user export |
| **Security breach** | Critical | RLS policies, JWT validation, HTTPS |
| **GDPR/Data Privacy** | High | Clear terms, data deletion API |
| **Bot abuse (spam)** | Medium | Rate limiting, phone verification |

---

## 10. Future Roadmap

### 10.1 Phase 2 Features (Month 3-6)

**Collaboration:**
- Study groups (shared subjects, leaderboard)
- Task assignment to group members
- Group chat integration

**Advanced Analytics:**
- Focus score (time spent vs distractions)
- Productivity heatmap (best study hours)
- Subject difficulty analysis (hours/marks correlation)
- Predictive insights: "You need 8 more hours to maintain 75% attendance"

**AI Features:**
- Smart study scheduling: "Best time to study OS: 8-10 PM"
- Task prioritization assistant: "You should focus on DBMS assignment first"
- Motivational messages: Context-aware encouragement

**Integrations:**
- Google Calendar sync (tasks → calendar events)
- Notion export (weekly summaries)
- Zoom/Teams integration (auto-start timer during online classes)

---

### 10.2 Phase 3 Features (Month 6-12)

**Mobile App:**
- React Native app (iOS + Android)
- Offline mode with background sync
- Home screen widgets (active timer, today's tasks)

**Advanced Academic:**
- Syllabus tracking (mark topics as done)
- Past paper library with practice mode
- Peer comparison (anonymized): "You're in top 20% for study hours"

**Monetization Expansion:**
- Team tier for study groups ($15/month for 5 users)
- Institutional tier for colleges (bulk licensing)
- API access for developers

**Marketplace:**
- Study resources: Notes, videos, question banks
- Tutors: Book sessions directly in app
- Courses: Integrated with Udemy, Coursera

---

### 10.3 Long-Term Vision (1-2 Years)

**Platform Evolution:**
- Become the "WhatsApp for Education"
- 100,000+ active users
- Partnerships with universities
- B2B SaaS for institutions

**Geographic Expansion:**
- Localization: Hindi, Tamil, Bengali
- Country-specific features (different grading systems)
- Southeast Asia expansion

**Product Expansion:**
- Teacher/parent accounts (view student progress)
- Career guidance based on performance
- Scholarship/internship recommendations

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|------------|
| **CGPA** | Cumulative Grade Point Average (overall GPA across all semesters) |
| **SGPA** | Semester Grade Point Average (GPA for current semester only) |
| **RLS** | Row Level Security (database security feature) |
| **JWT** | JSON Web Token (authentication token format) |
| **OTP** | One-Time Password (6-digit code for login) |
| **E.164** | International phone number format (+919876543210) |
| **DAU/MAU** | Daily Active Users / Monthly Active Users (engagement ratio) |

---

### 11.2 Open Questions

1. **Attendance Scheduling:** Should we support alternate week schedules? (Answer: Yes, needed for lab courses)
2. **Multi-device:** Should same user login from phone + laptop simultaneously? (Answer: Yes, JWT works across devices)
3. **Data Export:** JSON or CSV format? (Answer: Both options)
4. **Bot Personality:** Formal or casual tone? (Answer: Casual + motivational, use emoji)
5. **Notifications:** Push notifications or WhatsApp only? (Answer: WhatsApp only for MVP)

---

### 11.3 Research & Validation

**User Interviews Completed:** 15
- 8 engineering students
- 4 CA aspirants
- 3 working professionals

**Key Findings:**
- 100% use WhatsApp daily (avg 3+ hours)
- 80% find current tools "too complex"
- 70% would pay $5/month for unified solution
- 60% prefer bot over app for quick actions
- 90% track study time inconsistently (forget to start/stop)

**Competitive Analysis:**
- Forest App: Good timer, no academic features, paid only
- Notion: Too complex for students, steep learning curve
- Google Calendar: Not built for study tracking
- College ERP systems: Slow, unreliable, institutional only

**Market Opportunity:**
- 40M college students in India
- 10% TAM = 4M potential users
- At $5/month, 1% conversion = $200K ARR

---

**END OF PRD**

---

**Document Approval:**

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Manager | TBD | Feb 16, 2026 | ✅ Approved |
| Engineering Lead | TBD | Feb 16, 2026 | ✅ Approved |
| Design Lead | TBD | Feb 16, 2026 | ✅ Approved |

**Next Review:** After MVP launch (Week 2)
