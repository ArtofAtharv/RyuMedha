# Legacy and Experimental Analysis

## Duplicate Systems
- **`web-legacy/`**: An older iteration of the Next.js frontend. Retained likely for reference. Evidence: Directory name and duplicate contents of `web/`.
- **`web-clone/`**: Another duplicate of the web frontend. Current status: Unclear, possibly an abandoned branch or experiment.
- **`production-bot/` & `testing-bot/`**: Complete copies of the `bot/` directory. Current status: Active, used for environment separation, though this is an anti-pattern compared to using environment variables.

## Alternative Implementations
- **Webhook Handlers**: There is a Node.js Express server implementation for webhooks (`bot/server.js`) and a Supabase Edge Function implementation (`supabase/functions/whatsapp-webhook/`). Both appear to handle WhatsApp webhook payloads. The edge function approach might be newer or experimental to move away from a persistent Node.js server.
