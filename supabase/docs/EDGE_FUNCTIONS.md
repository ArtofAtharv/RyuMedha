# Edge Functions Reference

## Overview

Supabase Edge Functions (Deno runtime) handle bot logic, authentication, and background tasks.

## Functions Directory Structure

```
functions/
  ├── whatsapp-webhook/
  │   ├── index.ts          # Webhook entry point
  │   ├── processor.ts      # Intent handlers
  │   ├── nlp.ts            # NLP parsing
  │   ├── messages.ts       # Message templates
  │   ├── setup.ts          # Onboarding flow
  │   └── db.ts             # Database utilities
  ├── whatsapp-bot/         # (Same structure, alternative processor)
  ├── whatsapp-engagement/
  │   └── index.ts          # Engagement messaging
  ├── auth/
  │   └── index.ts          # OTP gen/verify
  └── send-reminders/
      └── index.ts          # Reminder scheduling
```

## whatsapp-webhook

**Purpose:** Receive and process incoming WhatsApp messages.

**Trigger:** HTTP POST from Meta WhatsApp Cloud API

**URL:** https://<project>.supabase.co/functions/v1/whatsapp-webhook

**Environment Variables:**
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<public_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<secret_for_jwt_generation>
WHATSAPP_TOKEN=<meta_api_token>
WHATSAPP_PHONE_NUMBER_ID=<meta_phone_id>
WA_VERIFY_TOKEN=<webhook_verification_token>
WEBSITE_URL=https://ryumedha.in
```

**GET Request (Webhook Verification):**
```
GET /whatsapp-webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
Response: 200 with hub.challenge value
```

**POST Request (Message Receipt):**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "91XXXXXX",
          "id": "wamid.xxx",
          "text": { "body": "I attended Math" }
        }]
      }
    }]
  }]
}
Response: 200 OK
```

**Submodules:**
- **processor.ts** — Main message handler with intent routing
- **nlp.ts** — NLP intent detection (compromise library)
- **messages.ts** — Pre-defined message templates
- **setup.ts** — Onboarding workflow
- **db.ts** — Database utilities (getUserClient, session management)

## whatsapp-bot

**Same structure as whatsapp-webhook**, used for testing or alternative processing.

## whatsapp-engagement

**Purpose:** Send proactive engagement messages to inactive users.

**Trigger:** Cron job (hourly) or manual HTTP call

**URL:** https://<project>.supabase.co/functions/v1/whatsapp-engagement

**Modes:**
- `?type=manual&profile_id=<id>` — Send to specific user
- `?type=auto` — Auto-scan and send to closing_soon users
- `?type=daily` — Send to all open users (daily broadcast)

**Request Body:**
```json
{
  "type": "auto|manual|daily",
  "profile_id": "uuid" (only for manual mode)
}
```

**Response:**
```json
{
  "success": true,
  "sent": 45
}
```

## auth

**Purpose:** Generate and verify OTP for web dashboard login.

**Trigger:** HTTP POST from web dashboard

**URL:** https://<project>.supabase.co/functions/v1/auth

**Action 1: Request OTP**

```
POST /auth?action=request
Content-Type: application/json

{
  "phone_number": "+91XXXXXX"
}

Response: {
  "success": true,
  "status": "otp_sent|not_registered"
}
```

**Action 2: Verify OTP**

```
POST /auth?action=verify
Content-Type: application/json

{
  "phone_number": "+91XXXXXX",
  "otp": "123456"
}

Response: {
  "success": true,
  "jwt": "eyJhbGc...",
  "user": { id, whatsapp_number, ... }
}
```

**Environment Variables:**
```env
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
```

## send-reminders

**Purpose:** Send scheduled reminders to users.

**Trigger:** Cron job (daily) or manual call

**URL:** https://<project>.supabase.co/functions/v1/send-reminders

**Request Body:**
```json
{
  "type": "pending_tasks|attendance|study_goals"
}
```

## Local Testing

### Start Local Functions
```bash
supabase functions serve
```

### Test whatsapp-webhook
```bash
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '''{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "91XXXXXX",
            "text": { "body": "help" }
          }]
        }
      }]
    }]
  }'''
```

### View Function Logs
```bash
supabase functions list
# Then check Supabase Dashboard → Functions → [Function Name] → Logs
```

## Deployment

```bash
# Deploy single function
supabase functions deploy whatsapp-webhook

# Deploy all functions
supabase functions deploy

# View deployed functions
supabase functions list

# Delete function
supabase functions delete whatsapp-webhook
```

## Best Practices

1. **Always use getUserClient()** for RLS-enforced queries
2. **Never expose service role key** to clients
3. **Handle errors gracefully** — return user-friendly messages
4. **Log important operations** for debugging
5. **Rate limit** critical operations (OTP, etc.)
6. **Use environment variables** for configuration
7. **Test locally** before deploying
8. **Monitor function logs** in Supabase Dashboard

---

**Full Code:** See functions/ directory
