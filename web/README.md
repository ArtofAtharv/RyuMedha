# Web Directory

## Purpose
The Next.js frontend application for the Ryu Medha dashboard.

## Responsibilities
- Providing a visual dashboard for study analytics, grades, and attendance.
- Handling user authentication via WhatsApp OTP.
- Interacting with the Supabase database to fetch and display user data.

## Architecture
Built using Next.js (App Router), React, and Tailwind CSS. It uses NextAuth for session management and connects directly to Supabase using the Supabase JS client.

## Important Files
- `app/layout.tsx`: Root layout.
- `app/page.tsx`: Landing page.
- `app/dashboard/page.tsx`: Main dashboard overview.
- `app/api/auth/[...nextauth]/route.ts`: NextAuth configuration.
- `components/`: Reusable UI components.

## Entry Points
- `npm run dev` (Local development)
- `npm run build` & `npm run start` (Production)

## Dependencies
- `next`, `react`, `next-auth`
- `@supabase/supabase-js`
- Tailwind CSS, shadcn/ui

## Related Systems
- Shares the database with the WhatsApp bot.
- Uses `supabase/functions/auth` for OTP generation.
