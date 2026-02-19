# 🚀 WhatsApp OTP Login Setup Guide (Edge Function + Next Auth)

## 📋 Architecture Overview

```
User visits website → Enters phone → Clicks "Send OTP"
         ↓
Next.js API route (/api/auth/request-otp)
         ↓
Supabase Edge Function (send-whatsapp-otp)
         ↓ Generates 6-digit OTP
         ↓ Stores in otp_codes table
         ↓ Sends via WhatsApp Cloud API
         ↓
User's WhatsApp receives: "Your OTP: 123456"
         ↓
User enters OTP on website
         ↓
Next Auth verifies OTP → Creates session
         ↓
✅ User logged in!
```

**Why Edge Function instead of Bot?**
- ✅ Always online (serverless)
- ✅ Fast (global deployment)
- ✅ Scalable (automatic)
- ❌ Bot offline = no login (bad UX)

---

## PART 1: Deploy Supabase Edge Function (15 minutes)

### **Step 1: Install Supabase CLI**

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify installation
supabase --version
```

### **Step 2: Login to Supabase**

```bash
supabase login
```

This opens browser for authentication.

### **Step 3: Link to Your Project**

```bash
cd ~/your-project-folder

# Link to your Supabase project
supabase link --project-ref your-project-ref
```

**Find your project ref:**
- Go to Supabase Dashboard
- Your project URL: `https://abcdefghijk.supabase.co`
- Project ref = `abcdefghijk` (the subdomain)

### **Step 4: Create Edge Function**

```bash
# Create the function
supabase functions new send-whatsapp-otp
```

This creates: `supabase/functions/send-whatsapp-otp/index.ts`

### **Step 5: Copy Function Code**

Replace the content of `supabase/functions/send-whatsapp-otp/index.ts` with the code from `send-whatsapp-otp-function.ts` (provided above).

### **Step 6: Set Environment Variables**

Edge Functions need environment variables. Set them in Supabase Dashboard:

**Go to:** Dashboard → Project Settings → Edge Functions → Manage secrets

**Add these secrets:**

```
WHATSAPP_TOKEN=EAAg...your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=123456789
```

**Or via CLI:**

```bash
supabase secrets set WHATSAPP_TOKEN=EAAg...your_token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=123456789
```

### **Step 7: Deploy the Function**

```bash
supabase functions deploy send-whatsapp-otp
```

You should see:
```
Deploying function send-whatsapp-otp...
Function deployed successfully!
Function URL: https://your-project.supabase.co/functions/v1/send-whatsapp-otp
```

**Save this URL!** You'll need it.

### **Step 8: Test the Edge Function**

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/send-whatsapp-otp' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"whatsappNumber": "+919876543210"}'
```

**Expected response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 300
}
```

**Check WhatsApp:** You should receive the OTP!

---

## PART 2: Setup Next.js Project (20 minutes)

### **Step 1: Install Dependencies**

```bash
cd your-nextjs-project

npm install next-auth @supabase/supabase-js
```

### **Step 2: Create Environment Variables**

Create/update `.env.local`:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_secret_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Edge Function URL
EDGE_FUNCTION_URL=https://your-project.supabase.co/functions/v1/send-whatsapp-otp
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### **Step 3: Create API Routes**

**Create:** `app/api/auth/[...nextauth]/route.ts`

Copy the content from `nextauth-config.ts` (provided above).

**Create:** `app/api/auth/request-otp/route.ts`

Copy the content from `request-otp-route.ts` (provided above).

### **Step 4: Create Login Page**

**Create:** `app/login/page.tsx`

Copy the content from `login-page.tsx` (provided above).

### **Step 5: Add SessionProvider**

**Create/Update:** `app/providers.tsx`

```typescript
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

**Update:** `app/layout.tsx`

```typescript
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### **Step 6: Protect Routes**

**Create:** `middleware.ts` (in root directory)

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*']
}
```

This protects all routes under `/dashboard` and `/profile`.

---

## PART 3: Configure Types (TypeScript)

### **Extend NextAuth Types**

**Create:** `types/next-auth.d.ts`

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    phone: string
  }
  
  interface Session {
    user: User & {
      phone: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    phone: string
  }
}
```

---

## PART 4: Test the Complete Flow (10 minutes)

### **Step 1: Start Development Server**

```bash
npm run dev
```

### **Step 2: Test Login Flow**

1. Visit: `http://localhost:3000/login`
2. Enter your WhatsApp number: `+919876543210`
3. Click "Send OTP"
4. Check WhatsApp for OTP
5. Enter OTP on website
6. Click "Verify & Login"
7. Should redirect to `/dashboard`

### **Step 3: Check Session**

**Create:** `app/dashboard/page.tsx`

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {session?.user?.name}!</p>
      <p>Phone: {session?.user?.phone}</p>
    </div>
  )
}
```

Visit: `http://localhost:3000/dashboard`

You should see your name and phone number! ✅

---

## PART 5: Production Deployment

### **Deploy Edge Function**

Already done in Part 1! Edge Functions are automatically live after deployment.

### **Deploy Next.js to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
```

**Add these environment variables in Vercel:**
- `NEXTAUTH_URL` = https://your-domain.com
- `NEXTAUTH_SECRET` = (your secret)
- `NEXT_PUBLIC_SUPABASE_URL` = (your Supabase URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
- `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)

---

## 🔒 Security Checklist

- ✅ OTP expires in 5 minutes
- ✅ OTP marked as "used" after verification
- ✅ Only registered users can get OTP (must signup via bot first)
- ✅ Service role key not exposed to frontend
- ✅ RLS policies prevent data leaks
- ✅ Sessions use JWT (secure, stateless)

---

## 🐛 Troubleshooting

### **Edge Function Not Working**

```bash
# Check function logs
supabase functions logs send-whatsapp-otp

# Test locally
supabase functions serve send-whatsapp-otp
```

### **OTP Not Sending**

Check:
1. Edge function secrets are set correctly
2. WhatsApp token is valid (regenerate if expired)
3. Phone number format is correct (+91...)
4. User exists in profiles table

### **Login Fails with "Invalid OTP"**

Check:
1. OTP not expired (5 min limit)
2. OTP not already used
3. Phone number matches exactly
4. Database connection working

### **Session Not Persisting**

Check:
1. `NEXTAUTH_SECRET` is set
2. `NEXTAUTH_URL` matches your domain
3. Cookies not blocked in browser

---

## 📊 Database Schema Used

The Edge Function uses the `otp_codes` table from your schema:

```sql
CREATE TABLE otp_codes (
    whatsapp_number TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**This table is already created if you ran COMPLETE_SCHEMA.sql!** ✅

---

## 🎯 User Journey

### **New User (First Time)**

1. User messages WhatsApp bot: "hi"
2. Bot creates profile in database
3. User can now login on website
4. Enters phone → Gets OTP → Logs in

### **Existing User (Returning)**

1. User visits website
2. Clicks "Login with WhatsApp"
3. Enters phone → Gets OTP → Logs in
4. Session persists for 30 days

---

## 💡 Advanced Features (Optional)

### **Add Rate Limiting**

Prevent OTP spam:

```typescript
// In request-otp route
const lastOTP = await supabase
  .from('otp_codes')
  .select('created_at')
  .eq('whatsapp_number', whatsappNumber)
  .single()

if (lastOTP && (Date.now() - new Date(lastOTP.created_at).getTime()) < 60000) {
  return NextResponse.json(
    { error: 'Please wait 1 minute before requesting new OTP' },
    { status: 429 }
  )
}
```

### **Add Logout Button**

```typescript
'use client'

import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })}>
      Logout
    </button>
  )
}
```

### **Redirect After Login**

```typescript
// In login page
const searchParams = new URLSearchParams(window.location.search)
const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

// After successful login
router.push(callbackUrl)
```

---

## ✅ Success Checklist

- [ ] Edge Function deployed to Supabase
- [ ] Edge Function secrets configured
- [ ] Next Auth configured
- [ ] Login page created
- [ ] Test user can receive OTP
- [ ] Test user can login with OTP
- [ ] Session persists after refresh
- [ ] Protected routes redirect to login
- [ ] Logout works correctly

---

## 📝 Environment Variables Summary

**Supabase Edge Function Secrets:**
```
WHATSAPP_TOKEN
WHATSAPP_PHONE_NUMBER_ID
```

**Next.js Environment Variables:**
```
NEXTAUTH_URL
NEXTAUTH_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

**Your WhatsApp OTP login is now production-ready!** 🎉

Users can login anytime, even when your bot is offline. The Edge Function is always available, globally fast, and scales automatically!
