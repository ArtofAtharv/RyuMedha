# System Overview

Ryu Medha is a system combining a Next.js dashboard with a central Supabase PostgreSQL database and serverless WhatsApp bot powered by Edge Functions.

## Components

1. **WhatsApp Bot (Supabase Edge Functions)**: Handles user interactions via WhatsApp
   - Message processing and intent detection
   - Subject, attendance, task, and timer management
   - Engagement messaging
   - OTP generation for web login
   - See [Edge Functions Bot Architecture](../deployment/edge-functions-bot.md) for details

2. **Next.js Dashboard**: Handles analytics, reporting, and advanced user interaction
   - Study analytics and charts
   - Grade tracking and CGPA calculations
   - Attendance management interface
   - User profile and settings
   - Data export functionality

3. **Supabase Backend**: Central platform providing:
   - PostgreSQL database with Row Level Security (RLS)
   - Serverless Edge Functions (Deno runtime)
   - Real-time subscriptions
   - Authentication and JWT token generation
   - Audit logging and backup
