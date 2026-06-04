# Database Tables

The Ryu Medha database relies on a highly relational schema centered around the user's profile.

## `profiles`
The central user table. Every user interaction is tied to a profile.
- **Primary Key**: `id` (UUID)
- **Unique Constraint**: `whatsapp_number`
- **Relationships**: Parent to almost all other tables. Foreign keys to `universities`, `programs`, and `semesters` if academic tracking is enabled.
- **Data Flow**: Created upon first interaction with the WhatsApp bot. Updated via the web dashboard (settings) or bot interactions.

## `subjects`
Represents topics a user is tracking.
- **Primary Key**: `id` (UUID)
- **Relationships**: Belongs to one `profile_id`. Can optionally link to `subject_categories` or `source_course_id` (for academic subjects).
- **Constraints**: If `type` is 'academic', certain external keys might be expected based on business logic.

## `study_timers`
Logs study sessions.
- **Primary Key**: `id` (UUID)
- **Relationships**: Belongs to `profile_id` and optionally `subject_id`.
- **Data Flow**: Row is inserted when user says "start studying [subject]". Row is updated with `end_time` and `duration_minutes` when user says "stop studying".
- **Constraints**: A user can generally only have one active timer (where `end_time` is NULL) at a time, though this is enforced by application logic rather than strict DB constraints.

## `attendance_logs`
Tracks class presence.
- **Primary Key**: `id` (UUID)
- **Relationships**: Belongs to `profile_id` and `subject_id`.
- **Unique Constraint**: `UNIQUE(profile_id, subject_id, lecture_date)` prevents duplicate attendance entries for the same subject on the same day.
- **Data Flow**: Created via bot command ("mark present for math") or web dashboard calendar view.

## `tasks`
To-do items.
- **Primary Key**: `id` (UUID)
- **Relationships**: Belongs to `profile_id` and optionally `subject_id`.
- **Data Flow**: Created via bot command ("remind me to read chapter 4"). Updated when user marks it complete.

## `otp_codes`
Handles authentication for the web dashboard.
- **Primary Key**: `whatsapp_number` (Foreign Key referencing `profiles.whatsapp_number` with `ON DELETE CASCADE`).
- **Data Flow**: Row is upserted when user requests login on the web. Code is sent via WhatsApp API. Web verifies code against this row and marks `used = true` upon success.
