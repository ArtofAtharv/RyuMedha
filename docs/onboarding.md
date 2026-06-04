# New Developer Onboarding

Welcome to the Ryu Medha repository!

## 1. What this project does
Ryu Medha is a WhatsApp-integrated study assistant and dashboard designed to help students track study time, academic attendance, and grades seamlessly.

## 2. Which application is primary
There are two primary applications:
- The **WhatsApp Bot** (located in `bot/`), which serves as the primary data entry point.
- The **Web Dashboard** (located in `web/`), which serves as the primary analytics and management interface.

## 3. Which services are active
- The core Node.js bot (`bot/server.js`).
- The Next.js web application (`web/`).
- Supabase database and Edge Functions (`supabase/functions/whatsapp-engagement`, `supabase/functions/auth`).

## 4. Which services are experimental/legacy
- `web-clone/` and `web-legacy/` appear to be older or duplicate versions of the web frontend.
- `testing-bot/` and `production-bot/` are duplicate environments of the main `bot/` directory.

## 5. How to run locally
- **Web**: `cd web && npm install && npm run dev`
- **Bot**: `cd bot && npm install && npm start` (requires Cloudflare tunnel and `.env` setup).

## 6. How to create a feature branch
Follow the branching strategy: `git checkout -b feature/your-feature-name`.

## 7. How to test changes
- Front-end changes can be tested locally via the Next.js dev server.
- Bot changes should be tested using `testing-bot/` or by routing a test WhatsApp number's webhooks to your local machine.

## 8. How deployments work
- **Frontend**: Deploy `web/` to Vercel or similar Next.js hosting.
- **Backend/Bot**: Deploy the bot code to a persistent Node.js environment (e.g., EC2). Edge functions are deployed using the Supabase CLI: `npx supabase functions deploy <function-name>`.

## 9. Common development workflows
- Updating database schemas: Modify `supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql` and apply to your dev database.
- Adding a bot command: Update `bot/nlp_worker.js` and `bot/server.js`.
