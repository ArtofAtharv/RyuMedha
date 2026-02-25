import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as djwt from "https://deno.land/x/djwt@v3.0.1/mod.ts";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const JWT_SECRET = Deno.env.get('JWT_SECRET');
/** Admin client for initial profile checks/creation */ export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
/** Generates a JWT for a specific user to enforce RLS */ async function generateUserToken(phone) {
  if (!JWT_SECRET) {
    throw new Error("❌ Missing JWT_SECRET environment variable.");
  }
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(JWT_SECRET);
  const key = await crypto.subtle.importKey("raw", keyBuf, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const payload = {
    sub: phone,
    role: "authenticated",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60
  };
  return await djwt.create({
    alg: "HS256",
    typ: "JWT"
  }, payload, key);
}
/** Returns a Supabase client scoped to a user's phone number */ export async function getUserClient(phone) {
  const token = await generateUserToken(phone);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false
    }
  });
}
// --- Session & Cache (In-Memory for Edge Function Lifecycle) ---
// Note: Edge functions are short-lived, but we use these for the current invocation's context.
// For persistent sessions, we would use the DB, but Ryuma uses in-memory for ephemeral state.
// Since we want to handle 1000 DAU, we might need to rethink this if sessions need to persist across calls.
// However, the current bot uses in-memory sessions which reset on server restart. 
// In Edge Functions, this means they reset almost every time. 
// I will implement a lightweight DB-based session store if the user wants true persistence, 
// but for now, I will keep it consistent with the "as is" requirement using a global Map.
// WARNING: In-memory Maps in Edge Functions are NOT reliable for multi-step flows across requests.
// I will add a session table check if I find one in the schema, otherwise I'll use the bot_sessions table.
export const sessions = new Map();
export async function getSession(phone) {
  // Try in-memory first (for the same execution)
  if (sessions.has(phone)) return sessions.get(phone);
  // Check DB (bot_sessions table if it exists, based on server.js imports)
  const { data } = await supabaseAdmin.from('bot_sessions').select('*').eq('phone_number', phone).maybeSingle();
  return data ? JSON.parse(data.session_data) : null;
}
export async function setSession(phone, step, data) {
  const sessionObj = {
    step,
    data,
    lastActivity: Date.now()
  };
  sessions.set(phone, sessionObj);
  await supabaseAdmin.from('bot_sessions').upsert({
    phone_number: phone,
    session_data: JSON.stringify(sessionObj),
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'phone_number'
  });
}
export async function clearSession(phone) {
  sessions.delete(phone);
  await supabaseAdmin.from('bot_sessions').delete().eq('phone_number', phone);
}
