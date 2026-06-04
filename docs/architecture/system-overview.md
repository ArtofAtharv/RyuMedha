# System Overview

Ryu Medha is a hybrid system combining a conversational WhatsApp interface with a rich Next.js web dashboard, unified by a central Supabase PostgreSQL database.

## Components
1. **WhatsApp Bot (Node.js)**: Handles quick data entry (timers, tasks).
2. **Next.js Dashboard**: Handles deep analytics and complex data management (grades, charts).
3. **Supabase**: Central state, RLS security, and background workers (Edge Functions).
