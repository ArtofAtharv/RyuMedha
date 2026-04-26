# IMPORTANT: WEBHOOK URL CLARIFICATION

I see the chat vanished again! Here is the critical information you need:

### Why the URL should end with `whatsapp-webhook`
In the **Meta Developer Console** (under WhatsApp -> Configuration), the **Callback URL** is for **RECEIVING** status updates (Delivered, Read, Replies).

- **Sending Messages:** This happens from functions like `send-reminders`.
- **Receiving Statuses:** This ONLY happens at the **`whatsapp-webhook`** URL.

**Action:** 
In your Meta Dashboard, set the **Callback URL** to:
`https://tcrhnpknzbahxboheznm.supabase.co/functions/v1/whatsapp-webhook`

If you use a different URL there, Meta will not be able to tell Supabase that the message was delivered, so it will stay stuck on "Sent" forever.

### How to verify:
1. Set the URL in Meta to the one above.
2. Ensure you are **Subscribed** to the `messages` field in Meta.
3. Refresh your Supabase Edge Function logs for `whatsapp-webhook`. You should see logs appearing there now!
