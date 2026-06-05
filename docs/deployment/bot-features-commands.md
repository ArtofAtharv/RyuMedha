# Bot Features & Commands

## Overview

The Ryu Medha bot provides the following core features accessible via WhatsApp:

## 1. Profile Management

### Setup & Onboarding

**Command:** `setup`

Initiates multi-step profile configuration:
1. Choose setup method (chat or web)
2. Enter display name
3. Select tracking type (academic/personal/both)
4. (If academic) Select university, program, semester, courses
5. Set attendance target percentage

**Related Command:** `reset`
- Clears all profile settings
- Requires re-setup to use bot features

### View Profile

**Command:** `profile`

Displays current profile information:
- Display name
- Tracking type (academic/personal)
- University, program, semester (if academic)
- Target attendance percentage

## 2. Subject Management

### Add Subject

**Commands:**
- `Add <Subject Name>` (creates personal subject)
- `Add <Subject Name> to <Category Name>` (creates categorized personal subject)
- For academic subjects: added during setup

**Example:**
```
User: "Add Piano to Hobbies"
Bot: ✅ Category "Piano" created!
```

### List Subjects

**Command:** `subjects` or `list`

Displays all active subjects grouped by type:
- 🎓 Academic subjects (from current semester)
- 💼 Personal subjects (grouped by category)

### Delete Subject

**Command:** `Delete <Subject Name>`

Removes a subject from active tracking.

**Restrictions:**
- Cannot delete subjects with associated data (grades, attendance)
- Use soft delete to preserve history

### Rename Subject

**Command:** `Rename <Old Name> to <New Name>`

Updates subject name while preserving associated data.

## 3. Attendance Tracking

### Mark Attendance

**Commands:**
- `Present <Subject>` or `I attended <Subject>` — Mark present
- `Absent <Subject>` or `I missed <Subject>` — Mark absent
- `Deemed <Subject>` — Mark deemed/cancelled class

**Example:**
```
User: "I attended Constitutional Law and Contracts"
Bot: ✅ Marked present for Constitutional Law and Contracts
    💡 You can skip 2 more classes and stay on your 75% goal
```

### View Attendance Stats

**Command:** `stats` or `attendance`

Displays current semester attendance:
- Per-subject breakdown (attended/total, percentage)
- Classes can skip while maintaining target
- Warning if below target

### Undo Attendance

**Command:** `Undo <Subject>` or `Undo all`

Removes today's attendance log for one or all subjects.

## 4. Task Management

### Add Task

**Command:** `Add task <Task Title>`

Creates a new task with optional due date parsing:

**Examples:**
```
"Add task Assignment 1 due on 13th March 2026"
"Add task Study for midterm by Friday"
"Add task Call mom"
```

The bot attempts to parse natural language dates.

### View Tasks

**Command:** `tasks` or `list tasks`

Shows all pending tasks with:
- Task number (for marking done)
- Title and due date
- Count of remaining tasks

### Mark Task Done

**Command:** `Done <Task Number>` or `Mark task 1 as complete`

Marks a task as completed and removes from pending list.

## 5. Study Timers

### Start Timer

**Command:** `Start <Subject>` or `Start timer for <Subject>`

Initiates a study session:
- Records start timestamp
- Maintains active timer state
- Guides user to dashboard for live timer visualization

**Example:**
```
User: "Start studying Constitutional Law"
Bot: ⏱️ Study session started for Constitutional Law!
    🏃 I'll keep track. Say "stop" when you're done
    📱 Or check the live timer on Dashboard
```

### Stop Timer

**Command:** `Stop`

Ends active timer and records study duration:
- Calculates hours and minutes
- Saves to study history
- Displays completion message

**Example:**
```
User: "Stop"
Bot: ⏹️ Great focus! You studied for 1h 45m
    📊 Added to your study history
```

## 6. Categories (Personal Tracking)

### Add Category

**Command:** `Add category <Category Name>`

Creates a custom category for organizing personal subjects:

**Examples:**
```
"Add category Music"
"Add category Languages"
"Add category Competitive Exams"
```

### List Categories

**Command:** `List categories` or `Categories`

Shows all available categories with count of subjects.

### Delete Category

**Command:** `Delete category <Category Name>`

Removes category (only if no active subjects).

## 7. Help & Support

### View Help

**Command:** `help` or `?`

Displays context-aware help:
- **Academic Tracking:** Shows academic-specific commands
- **Personal Tracking:** Shows personal-specific commands
- **Both Modes:** Shows all available commands

## 8. Data Export

### Export Data

**Command:** `export`

Provides link to dashboard for CSV export of:
- All subjects
- All attendance records
- All grades
- All study timers

## Message Features

### Natural Language Processing

The bot understands variations of commands:

```
"I attended Math" ≈ "Present Math" ≈ "Math present"
"Add piano" ≈ "Add subject Piano" ≈ "Create piano"
"Check my tasks" ≈ "Show tasks" ≈ "What's my task list"
```

### Interactive Buttons

For setup and onboarding, the bot sends button menus:
- Single-select buttons for choices
- List menus for complex selections
- Fallback to text input if user prefers typing

### Message Templates

All bot messages follow consistent formatting:
- **Emojis** for visual hierarchy
- **Bold text** for emphasis (*text*)
- **Line breaks** for readability
- **Links** to web dashboard for advanced features

## Context & State Management

### Onboarding State

While setting up, the bot remembers:
- Current step in onboarding process
- Data collected so far (name, university, etc.)
- Allows users to continue from where they left off

### Active Timer State

The bot tracks:
- Currently active subject for user
- Start timestamp
- Prevents starting multiple timers simultaneously

### Session Persistence

State is stored in two places:
1. **In-Memory** — Fast access within same request
2. **Database (`bot_sessions`)** — Survives across multiple requests

## Rate Limiting & Throttling

### OTP Requests
- Max 3 OTP requests per 10 minutes
- Returns error after limit exceeded

### Engagement Messages
- Max 1 engagement message per user per 2 hours
- Prevents spam while maintaining engagement

## Error Handling

### User-Friendly Responses

Instead of technical errors, users see:
```
"I couldn't add that subject right now. Could you try again?"
"I'm not sure I understood that. Say 'help' for commands."
"Something went wrong. Please try again in a moment."
```

### Validation Feedback

- Duplicate subject detection
- Non-existent subject handling
- Invalid input guidance with examples

## Integration with Dashboard

Many commands suggest switching to the web dashboard for advanced features:

- **Timers** → View on dashboard for detailed analytics
- **Grades** → Manage on dashboard with GPA calculations
- **Data Export** → Available only on dashboard
- **Advanced Filters** → Dashboard provides filtering UI

## Command Reference Quick Reference

| Feature | Commands |
|---------|----------|
| **Setup** | setup, reset, profile |
| **Subjects** | add, delete, rename, list, subjects |
| **Attendance** | present, absent, deemed, stats, undo |
| **Tasks** | tasks, add task, done |
| **Timers** | start, stop |
| **Categories** | add category, delete category, list categories |
| **Help** | help, export |

## Limitations & Known Behavior

### What the Bot Does NOT Do

- Does not provide homework help or tutoring
- Does not integrate with external calendars
- Does not support file/image uploads
- Does not make phone calls
- Does not access external links or documents

### Conversation Limits

- Each message is independent; no multi-turn conversations
- Onboarding resets if user switches topics unexpectedly
- Timer state resets if user sends unrelated messages during active session

### Timezone & Dates

- Bot uses user's configured timezone (default: Asia/Kolkata)
- Natural language date parsing is best-effort (may not capture all formats)
- Dates are assumed in current or next month if not specified

## Future Command Ideas

- [ ] `today` — Show today's schedule and pending items
- [ ] `streak` — Display study streak
- [ ] `goals` — Set and track learning goals
- [ ] `friend` — Invite friends to use the bot
- [ ] `reminder` — Set custom reminders
