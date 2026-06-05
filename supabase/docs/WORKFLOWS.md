# Supabase Workflows & Data Flows

## Message Processing Workflow

### User Sends WhatsApp Message

```
1. User sends "I attended Math" via WhatsApp
    ↓
2. Meta sends webhook POST to whatsapp-webhook function
    ├─ Phone: +91XXXXXX
    ├─ Message: "I attended Math"
    └─ Message ID: wamid.xxx
    ↓
3. Function parses NLP intent
    ├─ Intent: attendance
    ├─ Action: mark present
    └─ Subject: "Math"
    ↓
4. Query database
    ├─ getUserClient(phone) → RLS-scoped client
    ├─ Find subject "Math"
    ├─ Get current semester
    └─ Find subject ID
    ↓
5. Create attendance_log record
    ├─ subject_id, date, status
    └─ Insert into attendance_logs table
    ↓
6. Calculate attendance stats
    ├─ Query attendance_logs
    ├─ Count present, total, percentage
    └─ Check if meets target
    ↓
7. Generate response
    ├─ Format template: "✅ Marked present for Math"
    ├─ Add tip: "You can skip 3 more classes"
    └─ Create message object
    ↓
8. Send via WhatsApp API
    ├─ POST to graph.facebook.com/v18.0/.../messages
    ├─ Include formatted message
    └─ Get wa_message_id from response
    ↓
9. Log interaction
    ├─ Insert to whatsapp_message_logs
    ├─ Include wa_message_id, status, body
    └─ Complete audit trail
```

## Onboarding Workflow

```
1. User sends "setup"
    ↓
2. Bot checks: Does user have complete profile?
    ├─ display_name set?
    ├─ academics_enabled or personal_enabled?
    └─ If yes: Show help, if no: Start onboarding
    ↓
3. Start onboarding
    ├─ Create session: {step: "awaiting_onboarding_choice", data: {}}
    ├─ Store in bot_sessions table
    └─ Return welcome message
    ↓
4. User chooses: "Setup here" or "Setup on website"
    ├─ If "Setup here":
    │   └─ Update session: {step: "awaiting_name", ...}
    └─ If "Setup on website":
        └─ Provide link and clear session
    ↓
5. Chat-based setup continues...
    ├─ Collect: name → track selection → university → semester → courses
    ├─ Each step stored in bot_sessions
    └─ User can pause/resume anytime
    ↓
6. Onboarding complete
    ├─ Update profiles table with collected data
    ├─ Create subjects for selected courses
    ├─ Seed default categories
    ├─ Clear session
    └─ Return success message
```

## Cron Job Workflows

### Hourly Engagement (whatsapp-engagement)

```
1. Cron trigger at every hour
    ↓
2. Query whatsapp_window_status
    ├─ WHERE window_status = "closing_soon"
    └─ These users haven''t messaged in 22-24 hours
    ↓
3. For each user
    ├─ Check: Recently sent engagement message?
    │   └─ If yes (within 2 hours): Skip
    │   └─ If no: Continue
    ├─ Select random engagement template
    ├─ Send via WhatsApp API
    ├─ Get wa_message_id
    └─ Log to whatsapp_message_logs
    ↓
4. Return: {success: true, sent: 45}
```

### Daily Reminders (send-reminders)

```
1. Cron trigger at 8 AM
    ↓
2. Query profiles WHERE academics_enabled = true
    ↓
3. For each user
    ├─ Get pending tasks
    ├─ Get today''s attendance status
    ├─ Format reminder message
    ├─ Send via WhatsApp API
    └─ Log message
    ↓
4. Return: {success: true, sent: 1000}
```

## OTP Verification Workflow

```
1. User enters phone number on web dashboard
    ↓
2. Frontend calls /auth?action=request
    ├─ POST {phone_number: "+91XXXXXX"}
    ↓
3. auth function processes
    ├─ Check: User registered?
    ├─ Rate limit: Max 3 per 10 min?
    ├─ Generate 6-digit OTP
    ├─ Create otp_codes record
    │   └─ expires_at = NOW() + 5 minutes
    ├─ Send via WhatsApp API
    └─ Return: {success: true}
    ↓
4. User receives OTP via WhatsApp
    ↓
5. User enters OTP in web dashboard
    ↓
6. Frontend calls /auth?action=verify
    ├─ POST {phone_number, otp}
    ↓
7. auth function processes
    ├─ Query otp_codes for phone
    ├─ Check: OTP matches?
    ├─ Check: Not expired?
    ├─ Check: Not already used?
    ├─ Mark as used: UPDATE otp_codes SET used = true
    ├─ Generate JWT
    │   └─ {sub: "+91XXXXXX", role: "authenticated", iat, exp}
    └─ Return: {success: true, jwt: "...", user: {...}}
    ↓
8. Frontend stores JWT in localStorage
    ↓
9. All future requests include: Authorization: Bearer <JWT>
    ↓
10. PostgREST validates JWT
    ├─ Check signature
    ├─ Check expiration
    ├─ Extract user identity from ''sub''
    └─ Enforce RLS policies
```

## Debugging Workflows

### User Cannot Add Subject

```
Check:
1. Profile table
   └─ SELECT * FROM profiles WHERE whatsapp_number = ''+''+phone;
   └─ Is academics_enabled = true?
   └─ Is current_semester_id set?

2. Subjects table
   └─ SELECT * FROM subjects WHERE profile_id = user_id AND name ILIKE ''%subject%'';
   └─ Already exists?

3. Edge Function logs
   └─ Supabase Dashboard → Functions → whatsapp-bot → Logs

4. Message logs
   └─ SELECT * FROM whatsapp_message_logs WHERE profile_id = user_id ORDER BY created_at DESC;
```

### User Attendance Not Updating

```
Check:
1. Subject exists and is active
   └─ SELECT * FROM subjects WHERE profile_id = user_id AND name ILIKE ''...'' AND is_active = true;

2. RLS policies
   └─ Are you using getUserClient()?
   └─ Is JWT phone valid?

3. attendance_logs
   └─ SELECT * FROM attendance_logs WHERE subject_id = subject_id ORDER BY date DESC;

4. Edge Function logs
   └─ Check for errors in processing
```

### RLS Policy Denying Access

```
Check:
1. JWT token valid?
   └─ Authorization: Bearer <JWT>?

2. JWT sub claim contains phone?
   └─ Decode JWT at jwt.io

3. Profile exists?
   └─ SELECT * FROM profiles WHERE whatsapp_number = jwt_sub;

4. RLS policy references?
   └─ SELECT * FROM pg_policies WHERE tablename = ''subjects'';

5. Test query with admin client
   └─ supabaseAdmin.from(''subjects'').select();
   └─ If works: RLS issue
   └─ If fails: Data issue
```

---

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) | [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)
