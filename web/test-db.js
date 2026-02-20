const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET; // from .env.local

async function test() {
  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const { data: prof } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
  console.log('Profile:', prof);

  const { data: sub } = await supabaseAdmin.from('subjects').select('id').eq('profile_id', prof.id).limit(1).single();
  console.log('Subject:', sub);

  // Generate JWT like the bot
  const token = jwt.sign({ role: 'authenticated', phone: prof.whatsapp_number }, SUPABASE_JWT_SECRET);
  console.log('Token created');

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const row = {
    profile_id: prof.id,
    subject_id: sub.id,
    status: 'present',
    lecture_date: new Date().toISOString().split('T')[0],
    logged_at: new Date().toISOString()
  };
  console.log('Inserting row:', row);

  const { data, error } = await supabaseUser.from('attendance_logs').insert([row]).select();
  console.log('Insert Result:', data);
  if (error) console.error('Insert Error:', error);
}

test().catch(console.error);
