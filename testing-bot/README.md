# Bot Directory

## Purpose
Contains the core Node.js application for the Ryu Medha WhatsApp testing-bot. It acts as the primary webhook receiver for Meta's WhatsApp API.

## Responsibilities
- Receiving and validating WhatsApp webhooks.
- Processing incoming text messages using Natural Language Processing (NLP).
- Executing database operations via Supabase (e.g., starting timers, adding tasks).
- Sending replies back to the user via the WhatsApp API.

## Architecture
An Express.js server listens for incoming POST requests from Meta. Messages are parsed and sent to an NLP worker (`nlp_worker.js`) which determines the intent. The testing-bot then interacts with the Supabase database using a JWT-scoped client to ensure Row Level Security (RLS). Responses are queued and sent back.

## Important Files
- `server.js`: The main Express server and webhook handler.
- `nlp_worker.js`: Handles intent recognition using NLP.js/Compromise.
- `smartRyuma.js`: Contains logic for specific testing-bot commands and responses.
- `setup.js`: Handles new user onboarding.
- `broadcast.js`: Utilities for sending outbound messages.

## Entry Points
- `node server.js`

## Dependencies
- `@supabase/supabase-js`
- `express`
- `@nlpjs/nlp`
- `compromise`

## Related Systems
- Depends heavily on the Supabase database schema (`supabase/`).
- Functionality is duplicated in `production-testing-bot/` and `testing-testing-bot/`.
