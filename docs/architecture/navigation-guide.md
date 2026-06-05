# Navigation Guide

## User Flow Tracing
**User Request → Web App → Supabase → Background Jobs**

1. **User Request (Web)**: A user interacts with the web dashboard.
2. **Web App**: The frontend sends requests to Supabase and receives data for display.
3. **Database**: Supabase stores user data, sessions, and analytics records.
4. **Worker/Background Jobs**: `supabase/functions/` runs scheduled or on-demand tasks to support engagement and data updates.

See individual directory documentation for deeper navigation.
