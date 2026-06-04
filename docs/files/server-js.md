# server.js (Bot)

## Purpose
This file acts as the main entry point and webhook router for the Ryu Medha WhatsApp bot. It is the bridge between Meta's WhatsApp infrastructure and the internal business logic of the application.

## Responsibilities
- Standing up an Express.js HTTP server.
- Verifying the webhook connection request from Meta.
- Parsing incoming webhook payloads to extract sender information and message content.
- Looking up users in the database to establish their identity.
- Minting JWTs to create secure, scoped database clients for subsequent operations.
- Delegating message processing to the NLP worker and onboarding setups.

## Imports
### Internal Dependencies
- `nlp_worker.js`: To process the text intent.
- `setup.js`: To handle new user onboarding.
- `smartRyuma.js`: To handle specific bot commands.

### External Dependencies
- `express`: For the web server.
- `@supabase/supabase-js`: For database interactions.
- `jsonwebtoken`: For minting RLS-compliant tokens.
- `dotenv`: For configuration management.

## Exports
- N/A (Executes as a standalone script).

## Execution Flow
1. Loads environment variables.
2. Initializes the `supabaseAdmin` client.
3. Defines the `/webhook` GET endpoint for Meta verification.
4. Defines the `/webhook` POST endpoint for incoming messages.
5. On POST: Immediately responds `200 OK` to Meta to prevent retries.
6. Extracts `phone_number` and `msg_body`.
7. Queries `profiles` table.
8. If user doesn't exist, invokes `setup.js`.
9. If user exists, mints a JWT, creates a scoped Supabase client, and invokes `nlp_worker.js`.

## Functions
### `getUserClient(phone)`
- **Parameters**: `phone` (String) - The user's WhatsApp number.
- **Return Value**: An initialized `@supabase/supabase-js` client object.
- **Side Effects**: Generates a JWT signed with the Supabase JWT secret containing a `sub` claim equal to the phone number.
- **Purpose**: Ensures that all database operations performed by the bot on behalf of an existing user are subject to PostgreSQL Row Level Security (RLS) policies.

## Related Files
- `bot/nlp_worker.js`: Receives the output of this file.
- `bot/broadcast.js`: Called to send responses back to the webhook sender.
- `supabase/ULTIMATE_CONSOLIDATED_SCHEMA.sql`: Defines the tables this file queries (e.g., `profiles`).

## Risks and Notes
- **Security**: The `supabaseAdmin` client must *never* be used to mutate data outside of the initial user creation process, as it bypasses RLS.
- **Performance**: Acknowledging the webhook via `res.sendStatus(200)` before processing is critical. If processing takes too long and Meta doesn't receive a 200, it will retry the webhook, causing duplicate messages.
