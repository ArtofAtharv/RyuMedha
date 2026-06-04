# Database Schema Overview

The database uses PostgreSQL (hosted on Supabase) with Row Level Security (RLS) to ensure users can only access their own data.

## Core Tables
- **`profiles`**: User information and settings.
- **`subjects`**: Academic or personal subjects being tracked.
- **`study_timers`**: Records of study sessions.
- **`tasks`**: User to-do items.
- **`attendance_logs`**: Records of class attendance.
- **`grades`**: Academic performance records.
- **`otp_codes`**: Temporary codes for web login.
