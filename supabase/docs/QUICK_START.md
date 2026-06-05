# Supabase Quick Start Guide

**Estimated Time: 5 minutes**

This guide gets you up and running with the Supabase backend in minutes.

## Prerequisites

- Node.js 18+ installed
- Supabase account (or local setup)
- Supabase CLI: `npm i -g supabase`

## Step 1: Clone & Install (1 min)

```bash
cd supabase
npm install
```

## Step 2: Start Local Supabase (2 min)

```bash
# Start local development instance
supabase start

# You'll see output like:
# Started Supabase local development server (v1.x.x)
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:5432/postgres
```

## Step 3: Link to Remote (Optional, 1 min)

```bash
# Link to your remote Supabase project
supabase link --project-ref <your-project-ref>

# Push schema
supabase db push
```

## Step 4: Deploy Edge Functions (1 min)

```bash
# Serve functions locally
supabase functions serve

# In another terminal, deploy to remote
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy auth
```

## Step 5: Verify Setup (1 min)

### Check Database
```bash
# Connect to local DB
psql postgresql://postgres:postgres@localhost:5432/postgres

# List tables
\dt

# Query profiles
SELECT * FROM profiles LIMIT 5;
```

### Check Functions
```bash
# Test webhook function
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

---

## Next Steps

After setup, explore:

| Interest | Next Step |
|----------|-----------|
| Understand database | Read [DATABASE.md](./DATABASE.md) |
| Learn architecture | Read [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Explore functions | Read [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) |
| Debug data flows | Read [WORKFLOWS.md](./WORKFLOWS.md) |
| See all docs | Go to [INDEX.md](./INDEX.md) |

---

## Common Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Serve functions locally
supabase functions serve

# Deploy function to remote
supabase functions deploy <function-name>

# View function logs
supabase functions list

# Reset local database
supabase reset

# Generate migration
supabase migration new <description>

# Push migrations
supabase db push

# Pull remote schema
supabase db pull
```

---

## Troubleshooting

### Functions Not Starting?
```bash
# Clear cache and restart
supabase stop
rm -rf .supabase/
supabase start
```

### Database Connection Issues?
```bash
# Check PostgreSQL is running
psql postgresql://postgres:postgres@localhost:5432/postgres -c "SELECT version();"

# Reset database
supabase db reset
```

### RLS Policy Denying Access?
- Check user has correct JWT token
- Verify RLS policy matches phone number in JWT
- See [DATABASE.md](./DATABASE.md#row-level-security-rls) for policy details

---

## Environment Setup

Create `.env.local` in supabase root (for local testing):

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WA_VERIFY_TOKEN=ryumedha_secret_token
JWT_SECRET=your_secret_key
WEBSITE_URL=http://localhost:3000
```

Get keys from local Supabase:
```bash
supabase status

# Copy:
# - API key → SUPABASE_ANON_KEY
# - Service role key → SUPABASE_SERVICE_ROLE_KEY
```

---

## 🎉 Ready to Code!

Now you're set up. Check out:
- [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) to create new functions
- [DATABASE.md](./DATABASE.md) to work with data
- [WORKFLOWS.md](./WORKFLOWS.md) to understand flows

**Questions?** See [INDEX.md](./INDEX.md) for full documentation.
