// server.js
// WhatsApp Bot with Correct Supabase Authentication

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CONFIGURATION
// ============================================================================

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Only for user creation
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

app.use(bodyParser.json());

// ============================================================================
// SUPABASE CLIENTS
// ============================================================================

// Admin client (ONLY for creating new users)
// Uses service role key to bypass RLS for initial user creation
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Regular client (for most operations)
// Uses anon key, respects RLS policies
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// STARTUP
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('🚀 Ryuma The WhatsApp Bot with Supabase Integration');
console.log('='.repeat(60));
console.log('Port:', PORT);
console.log('Verify Token:', VERIFY_TOKEN ? '✅' : '❌');
console.log('WhatsApp Token:', WHATSAPP_TOKEN ? '✅' : '❌');
console.log('Phone Number ID:', PHONE_NUMBER_ID ? '✅' : '❌');
console.log('Supabase URL:', SUPABASE_URL ? '✅' : '❌');
console.log('Supabase Anon Key:', SUPABASE_ANON_KEY ? '✅' : '❌');
console.log('Supabase Service Key:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
console.log('JWT Secret:', SUPABASE_JWT_SECRET ? '✅' : '❌');
console.log('='.repeat(60) + '\n');

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get or create user profile
 * Uses admin client ONLY for user creation (bypasses RLS)
 * Returns user-scoped client for subsequent operations
 */
async function getOrCreateUser(whatsappNumber) {
  console.log(`\n👤 Getting/Creating user: ${whatsappNumber}`);

  // First, check if user exists (using admin client)
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .single();

  if (existingUser) {
    console.log('✅ User exists:', existingUser.display_name);
    return existingUser;
  }

  // User doesn't exist, create new one (using admin client to bypass RLS)
  console.log('🆕 Creating new user...');
  const { data: newUser, error: createError } = await supabaseAdmin
    .from('profiles')
    .insert([{
      whatsapp_number: whatsappNumber,
      display_name: whatsappNumber.substring(0, 13) + '...', // Placeholder name
      timezone: 'Asia/Kolkata',
      personal_enabled: true,
      academics_enabled: false
    }])
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating user:', createError);
    throw createError;
  }

  // Seed default categories (using admin client)
  await seedDefaultCategories(newUser.id);

  console.log('✅ New user created:', newUser.id, newUser.display_name);
  return newUser;
}

/**
 * Seed default subject categories for new users
 */
async function seedDefaultCategories(profileId) {
  const defaultCategories = [
    { name: 'Academics', color_hex: '#3b82f6' },
    { name: 'Professional Development', color_hex: '#8b5cf6' },
    { name: 'Competitive Exams', color_hex: '#ec4899' },
    { name: 'Language Learning', color_hex: '#10b981' },
    { name: 'Coding & Tech', color_hex: '#f59e0b' },
    { name: 'Hobbies', color_hex: '#6366f1' }
  ];

  const categoriesToInsert = defaultCategories.map(cat => ({
    profile_id: profileId,
    name: cat.name,
    color_hex: cat.color_hex,
    is_default: true
  }));

  const { error } = await supabaseAdmin
    .from('subject_categories')
    .insert(categoriesToInsert);

  if (error) {
    console.error('⚠️ Error seeding categories:', error);
  } else {
    console.log('✅ Seeded default categories');
  }
}

/**
 * Get user-scoped Supabase client
 * Signs a JWT with whatsapp_number as sub — matches your RLS policy
 * Uses anon key so RLS is enforced
 */
function getUserSupabase(whatsappNumber) {
  const token = jwt.sign(
    {
      sub: whatsappNumber,
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
    },
    SUPABASE_JWT_SECRET
  );

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * Handle "add subject" command
 */
async function handleAddSubject(user, subjectName) {
  const userSupabase = getUserSupabase(user.whatsapp_number);

  const { data: category } = await userSupabase
    .from('subject_categories')
    .select('id')
    .eq('profile_id', user.id)
    .eq('name', 'Academics')
    .single();

  const { data: subject, error } = await userSupabase
    .from('subjects')
    .insert([{
      profile_id: user.id,
      type: 'personal',
      name: subjectName,
      category_id: category?.id,
      color_hex: '#8b5cf6'
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding subject:', error);
    return `❌ Couldn't add subject. Try again later.`;
  }

  const { count } = await userSupabase
    .from('subjects')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id);

  return `✅ Added "${subjectName}"!\n\nYou now have ${count} subject${count !== 1 ? 's' : ''}.`;
}

/**
 * Handle "delete subject" command
 */
async function handleDeleteSubject(user, subjectName) {
  const userSupabase = getUserSupabase(user.whatsapp_number);

  const { data: category } = await userSupabase
    .from('subject_categories')
    .select('id')
    .eq('profile_id', user.id)
    .eq('name', 'Academics')
    .single();

  const { data: subject, error } = await userSupabase
    .from('subjects')
    .delete()
    .eq('profile_id', user.id)
    .eq('name', subjectName)
    .single();

  if (error) {
    console.error('❌ Error deleting subject:', error);
    return `❌ Couldn't delete subject. Try again later.`;
  }

  const { count } = await userSupabase
    .from('subjects')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id);

  return `✅ Deleted "${subjectName}"!\n\nYou now have ${count} subject${count !== 1 ? 's' : ''}.`;
}

/**
 * Handle "list subjects" command
 */
async function handleListSubjects(user) {
  const userSupabase = getUserSupabase(user.whatsapp_number);

  const { data: subjects, error } = await userSupabase
    .from('subjects')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !subjects || subjects.length === 0) {
    return `📚 You don't have any subjects yet!\n\nAdd one by sending:\nadd subject Contract Law`;
  }

  let response = '📚 Your Subjects:\n\n';
  subjects.forEach((subject, index) => {
    response += `${index + 1}. ${subject.name}\n`;
  });

  response += `\n💡 Mark attendance: "attended contract law"`;

  return response;
}

/**
 * Handle "attended <subject>" command
 */
async function handleAttendance(user, subjectName) {
  const userSupabase = getUserSupabase(user.whatsapp_number);

  const { data: subjects } = await userSupabase
    .from('subjects')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName}%`);

  if (!subjects || subjects.length === 0) {
    return `❌ Subject "${subjectName}" not found.\n\nList subjects: send "subjects"`;
  }

  const subject = subjects[0];
  // Use IST for date
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const { data: existing } = await userSupabase
    .from('attendance_logs')
    .select('*')
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id)
    .eq('lecture_date', today)
    .single();

  if (existing) {
    return `ℹ️ Already marked attendance for ${subject.name} today!`;
  }

  const { error } = await userSupabase
    .from('attendance_logs')
    .insert([{
      profile_id: user.id,
      subject_id: subject.id,
      lecture_date: today,
      status: 'present'
    }]);

  if (error) {
    console.error('❌ Error marking attendance:', error);
    return `❌ Error marking attendance. Try again.`;
  }

  const { data: logs } = await userSupabase
    .from('attendance_logs')
    .select('status')
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id);

  if (logs) {
    const present = logs.filter(l => l.status === 'present').length;
    const total = logs.filter(l => l.status !== 'cancelled').length;
    const percentage = total > 0 ? (present / total) * 100 : 0;
    const emoji = percentage >= 75 ? '✅' : percentage >= 60 ? '⚠️' : '🔴';

    return `${emoji} Marked!\n\n${subject.name}: ${present}/${total} (${percentage.toFixed(1)}%)`;
  }

  return `✅ Attendance marked for ${subject.name}!`;
}

/**
 * Handle "missed <subject>" command
 */
async function handleMissed(user, subjectName) {
  const userSupabase = getUserSupabase(user.whatsapp_number);

  const { data: subjects } = await userSupabase
    .from('subjects')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName}%`);

  if (!subjects || subjects.length === 0) {
    return `❌ Subject "${subjectName}" not found.`;
  }

  const subject = subjects[0];
  // Use IST for date
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const { data: existing } = await userSupabase
    .from('attendance_logs')
    .select('*')
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id)
    .eq('lecture_date', today)
    .single();

  if (existing) {
    return `ℹ️ Already marked for ${subject.name} today!`;
  }

  const { error } = await userSupabase
    .from('attendance_logs')
    .insert([{
      profile_id: user.id,
      subject_id: subject.id,
      lecture_date: today,
      status: 'absent'
    }]);

  if (error) {
    console.error('❌ Error:', error);
    return `❌ Error marking absence.`;
  }

  const { data: logs } = await userSupabase
    .from('attendance_logs')
    .select('status')
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id);

  if (logs) {
    const present = logs.filter(l => l.status === 'present').length;
    const total = logs.filter(l => l.status !== 'cancelled').length;
    const percentage = total > 0 ? (present / total) * 100 : 0;
    const needed = percentage < 75 ? Math.ceil((0.75 * total - present) / 0.25) : 0;

    let response = `⚠️ Marked absent\n\n${subject.name}: ${present}/${total} (${percentage.toFixed(1)}%)`;
    if (needed > 0) response += `\n\n💡 Attend next ${needed} lectures to reach 75%`;
    return response;
  }

  return `⚠️ Marked absent for ${subject.name}`;
}

/**
 * Handle "stats" command
 */
async function handleStats(user) {
  const userSupabase = getUserSupabase(user.whatsapp_number);

  const { data: subjects } = await userSupabase
    .from('subjects')
    .select('id, name')
    .eq('profile_id', user.id)
    .eq('is_active', true);

  if (!subjects || subjects.length === 0) {
    return `📊 No subjects yet!\n\nAdd one: "add subject Contract Law"`;
  }

  let response = '📊 Your Attendance:\n\n';
  let hasData = false;

  for (const subject of subjects) {
    const { data: logs } = await userSupabase
      .from('attendance_logs')
      .select('status')
      .eq('profile_id', user.id)
      .eq('subject_id', subject.id);

    if (logs && logs.length > 0) {
      hasData = true;
      const present = logs.filter(l => l.status === 'present').length;
      const total = logs.filter(l => l.status !== 'cancelled').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;
      const emoji = percentage >= 75 ? '✅' : percentage >= 60 ? '⚠️' : '🔴';
      response += `${emoji} ${subject.name}: ${present}/${total} (${percentage.toFixed(1)}%)\n`;
    }
  }

  if (!hasData) {
    return `📊 No attendance data yet!\n\nMark attendance: "attended contract law"`;
  }

  return response;
}

/**
 * Handle help command
 */
function handleHelp() {
  return `📚 Ryuma Bot

🌙 Active: 8 PM - 11 PM
💻 Dashboard 24/7: https://ryumedha.in

Commands:

📝 Subjects:
• add subject <name>
• subjects - List all

✅ Attendance:
• attended <subject>
• missed <subject>
• stats - View all

💡 Examples:
• add subject Contract Law
• attended contract law
• missed jurisprudence
• delete subject Contract Law
• stats

Dashboard for more features! 🚀`;
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processMessage(from, text) {
  console.log(`\n📄 Processing: "${text}"`);

  try {
    // Get or create user
    const user = await getOrCreateUser(from);

    // Parse command
    const lowerText = text.toLowerCase().trim();

    // Help
    if (lowerText === 'help' || lowerText === 'hi' || lowerText === 'hello' || lowerText === 'start') {
      return handleHelp();
    }

    // Add subject
    if (lowerText.startsWith('add subject ')) {
      const subjectName = text.substring(12).trim();
      return await handleAddSubject(user, subjectName);
    }

    // Delete subject
    if (lowerText.startsWith('delete subject ')) {
      const subjectName = text.substring(15).trim();
      return await handleDeleteSubject(user, subjectName);
    }

    // List subjects
    if (lowerText === 'subjects' || lowerText === 'list') {
      return await handleListSubjects(user);
    }

    // Attended
    if (lowerText.startsWith('attended ')) {
      const subjectName = text.substring(9).trim();
      return await handleAttendance(user, subjectName);
    }

    // Missed
    if (lowerText.startsWith('missed ')) {
      const subjectName = text.substring(7).trim();
      return await handleMissed(user, subjectName);
    }

    // Stats
    if (lowerText === 'stats' || lowerText === 'attendance') {
      return await handleStats(user);
    }

    // Unknown command
    return `🤔 I didn't understand that.\n\nSend "help" to see what I can do!`;

  } catch (error) {
    console.error('❌ Error processing message:', error);
    return `❌ Something went wrong. Please try again.\n\nIf this persists, contact support.`;
  }
}

// ============================================================================
// WEBHOOK ENDPOINTS
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Ryuma WhatsApp Bot',
    uptime: process.uptime()
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Webhook verification');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Verified');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  console.log('\n📨 Webhook received');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from;
      const text = message.text?.body;

      console.log(`📱 From: ${from}`);
      console.log(`💬 Message: ${text}`);

      if (text) {
        // Normalize phone number to E.164 (add +)
        const formattedFrom = from.startsWith('+') ? from : `+${from}`;
        const response = await processMessage(formattedFrom, text);

        // Reply to the original number (WhatsApp API handles formatting, but usually expects just digits for 'to')
        // actually, utilizing the formattedFrom is safer for DB, but sending BACK might need the original.
        // The sendMessage function takes 'to'. Let's see what sendMessage does.
        // It POSTs to `to`. WhatsApp API usually accepts both, but let's stick to using formattedFrom for DB logic
        // and keep 'from' for sending if needed, OR just use formattedFrom everywhere if Supabase uses it.
        // processMessage uses formattedFrom to getOrCreateUser.

        await sendMessage(from, response);
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('ERROR');
  }
});

// ============================================================================
// WHATSAPP API
// ============================================================================

async function sendMessage(to, text) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

  console.log(`📤 Sending to ${to}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      text: { body: text }
    })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Sent');
  } else {
    console.error('❌ Send failed:', data);
  }

  return data;
}

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}\n`);
});