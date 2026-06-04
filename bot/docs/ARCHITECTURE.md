# Bot Architecture

## High-Level Flow
The `bot` directory implements an Express.js server that acts as a webhook receiver for the Meta WhatsApp Cloud API.
When a webhook payload arrives, it goes through the following architectural layers:

1. **Webhook Validation & Ingestion** (`server.js`): Express middleware verifies the incoming webhook token from Meta and extracts the `message` object.
2. **User Resolution & Security Boundary**: The phone number is extracted. Using `@supabase/supabase-js`, the bot looks up the user in the `profiles` table using the `supabaseAdmin` service role key (since the user is not authenticated yet in the context of the bot server).
3. **Intent Parsing (NLP Layer)** (`nlp_worker.js`): The message body string is passed to `@nlpjs/nlp` and `compromise` libraries, which match the string against predefined training phrases to extract an intent (e.g., 'start_timer', 'mark_attendance') and entities (e.g., subject name 'math').
4. **Action Execution** (`smartRyuma.js`, `setup.js`): Based on the intent, specific controller logic is fired. The bot creates a scoped JWT client using `getUserClient(phone)` to perform database operations on behalf of the user, enforcing Row Level Security (RLS) on the Supabase side.
5. **Response Delivery** (`broadcast.js`): The bot formulates a response string and calls the Meta WhatsApp API (via `axios`) to send the message back to the user.

## Design Decisions
- **Why Express?**: Necessary to expose a fast, long-running HTTP server capable of handling asynchronous webhook POST requests.
- **Why JWT Scoped Clients?**: Ensures the bot operates with the exact same RLS permissions as a web user, preventing any accidental cross-user data leakage.
