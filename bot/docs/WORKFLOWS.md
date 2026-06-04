# Bot Workflows

## Webhook Verification Workflow (GET)
- **Trigger**: Meta pings the `/webhook` endpoint with a `hub.verify_token`.
- **Action**: The server compares it against the local `WHATSAPP_TOKEN`.
- **Result**: Responds with `hub.challenge` to establish the connection.

## Message Receiving Workflow (POST)
- **Trigger**: User sends a WhatsApp message.
- **Action**:
  1. Meta POSTs payload to `/webhook`.
  2. `server.js` acknowledges immediately with 200 OK (to prevent retries).
  3. Extracts sender phone number.
  4. Queries Supabase `profiles` table to see if user exists.
  5. If new user, routes to `setup.js` to begin onboarding workflow.
  6. If existing user, routes to `nlp_worker.js` to determine intent.
  7. Routes to specific command handlers in `smartRyuma.js`.
  8. Updates Supabase database state (e.g. inserting into `study_timers`).
  9. Calls `broadcast.js` to send text reply.

## Onboarding Workflow
- **Trigger**: New phone number detected.
- **Action**: The bot walks the user through setting their display name and selecting tracking preferences (academic vs personal).
