# ULTIMATE_CONSOLIDATED_SCHEMA.sql

## Purpose
This file represents the single source of truth for the Ryu Medha database schema. It consolidates all tables, enumerations, relationships, and security policies required for both the web dashboard and the WhatsApp bot to function.

## Responsibilities
- Defining Custom ENUM types (`subject_type`, `task_priority`, `attendance_status`, `grade_type`).
- Creating core tables (`profiles`, `subjects`, `study_timers`, `tasks`, `attendance_logs`, `grades`, `otp_codes`).
- Establishing Foreign Key constraints to maintain referential integrity.
- Defining Row Level Security (RLS) policies to protect user data from unauthorized access.
- Setting up automated database triggers for timestamp management.

## Execution Flow
This is a declarative SQL file. It is executed linearly from top to bottom against a PostgreSQL database instance to provision the schema. It starts by enabling necessary extensions (`uuid-ossp`), defining custom types, creating tables, assigning triggers, and finally applying RLS policies.

## Related Files
- All application code (Bot and Web) relies on this schema.
- `supabase/functions/whatsapp-engagement/index.ts`: Relies on the `profiles` and `study_timers` tables defined here.
- `web/app/api/auth/[...nextauth]/route.ts`: Relies on the `otp_codes` table for authentication.

## Risks and Notes
- **RLS Complexity**: The RLS policies rely heavily on a custom function `get_profile_id_from_jwt()`. If the JWT structure changes, or if the function fails, all authenticated user requests will fail.
- **Destructive Actions**: Applying this schema on an existing database without modifying it into an `ALTER` migration could result in data loss if tables are dropped and recreated. It is intended for initial setup or reference.
