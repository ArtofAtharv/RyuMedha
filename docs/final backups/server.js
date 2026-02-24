// ============================================================================
// server.js — Ryu Medha WhatsApp Study Bot
// ============================================================================
//
// SECURITY MODEL
// ──────────────
//  supabaseAdmin (service role key)
//    └─ ONLY used for:
//         1. profiles SELECT  — initial existence check (profile may not exist yet,
//                               so user JWT would return NULL from RLS function)
//         2. profiles INSERT  — no INSERT RLS policy exists (intentional, schema note)
//       Nothing else ever touches the admin client.
//
//  getUserClient(phone) → JWT-scoped anon client
//    └─ Used for EVERY operation after the user is identified.
//       RLS enforces get_profile_id_from_jwt() on all protected tables so this
//       client can only ever read/write that user's own rows — bot included.
//
//  How the RLS JWT works (from COMPLETE_SCHEMA.sql):
//    get_profile_id_from_jwt() reads JWT.sub (= E.164 phone), does:
//      SELECT id FROM profiles WHERE whatsapp_number = phone_number
//    Returns the UUID, which all RLS policies compare against profile_id.
//
//  Tables WITH RLS:    profiles, subject_categories, subjects,
//                      attendance_logs, grades, study_timers, tasks
//
//  Tables WITHOUT RLS: universities, programs, semesters, academic_courses,
//                      otp_codes, bot_sessions, message_queue
//                      (user JWT client can access these freely)
//
// DATABASE COLUMN NOTES (schema-accurate)
// ────────────────────────────────────────
//  profiles          — NO onboarding_complete column.
//                      display_name = 'New User' is the onboarding sentinel.
//                      personal_enabled DEFAULT true in schema → override on create.
//
//  subjects          — DB CONSTRAINT: academic subjects MUST have source_course_id.
//                      No semester_id on subjects. Chain is:
//                        subjects.source_course_id → academic_courses.semester_id
//
//  tasks             — is_completed BOOLEAN  (not a status enum)
//                      due_date TIMESTAMPTZ
//
//  attendance_logs   — UNIQUE(profile_id, subject_id, lecture_date)
//                      status ENUM: 'present' | 'absent' | 'cancelled'
// ============================================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { parseIntent } = require('./smartRyuma');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// ============================================================================
// CONFIGURATION
// ============================================================================

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://ryumedha.in';

// ============================================================================
// STARTUP LOG
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('🚀  Ryu Medha WhatsApp Study Bot');
console.log('='.repeat(60));
console.log('Port:                 ', PORT);
console.log('Verify Token:         ', VERIFY_TOKEN ? '✅' : '❌ MISSING');
console.log('WhatsApp Token:       ', WHATSAPP_TOKEN ? '✅' : '❌ MISSING');
console.log('Phone Number ID:      ', PHONE_NUMBER_ID ? '✅' : '❌ MISSING');
console.log('Supabase URL:         ', SUPABASE_URL ? '✅' : '❌ MISSING');
console.log('Supabase Anon Key:    ', SUPABASE_ANON_KEY ? '✅' : '❌ MISSING');
console.log('Supabase Service Key: ', SUPABASE_SERVICE_KEY ? '✅' : '❌ MISSING');
console.log('JWT Secret:           ', SUPABASE_JWT_SECRET ? '✅' : '❌ MISSING');
console.log('='.repeat(60) + '\n');

// ============================================================================
// SUPABASE CLIENTS
// ============================================================================

// Admin — service role. ONLY for initial profile creation. Nothing else.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Returns a Supabase client authenticated as the given WhatsApp number.
 *
 * Signs a short-lived JWT with sub = E.164 phone number. Supabase passes this
 * to get_profile_id_from_jwt() on every RLS check, which maps the phone to a
 * profile UUID. The anon key is used so RLS is always enforced — the client
 * cannot see or touch any other user's data.
 *
 * A fresh client is created per-request (no caching needed; the JWT is just
 * a signed string and createClient() is cheap).
 */
function getUserClient(phone) {
  const token = jwt.sign(
    {
      sub: phone,            // E.164, e.g. "+918767689904"
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    },
    SUPABASE_JWT_SECRET
  );

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

// ============================================================================
// SESSION MANAGEMENT  (in-memory Map, auto-cleaned every 5 min)
// ============================================================================
//
// Onboarding steps (in order):
//   awaiting_name           → collect display name
//   awaiting_track          → 1=Academic  2=Personal  3=Both
//   awaiting_setup_choice   → 1=chat  2=website  (only when academic)
//   awaiting_university     → free-text university name
//   awaiting_program        → free-text program/course name
//   awaiting_semester       → number / "Semester 5" / "5th Semester"
//
// Mid-command disambiguation:
//   awaiting_subject_type   → 1=Academic  2=Personal  (Both-track users)
//
// ============================================================================

const sessions = new Map();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) {
    if (now - s.lastActivity > SESSION_TTL) sessions.delete(k);
  }
}, 5 * 60 * 1000);

function getSession(phone) { return sessions.get(phone) || null; }
function setSession(phone, step, data) { sessions.set(phone, { step, data: data || {}, lastActivity: Date.now() }); }
function clearSession(phone) { sessions.delete(phone); }
function touchSession(phone) { const s = sessions.get(phone); if (s) s.lastActivity = Date.now(); }

// ============================================================================
// USER HELPERS
// ============================================================================

const PLACEHOLDER_NAME = 'New User'; // sentinel: means onboarding not yet done

function needsOnboarding(user) {
  return user.display_name === PLACEHOLDER_NAME;
}

/**
 * Returns existing profile or creates a brand-new placeholder.
 *
 * Admin client is used here because:
 *   SELECT — the user JWT's RLS function does a DB lookup that returns NULL
 *            when no profile row exists yet, causing the SELECT to return 0 rows.
 *            Admin bypasses this cleanly for the existence check.
 *   INSERT — the schema intentionally has no INSERT RLS policy on profiles
 *            (bot handles signup via service role, see schema comment).
 *
 * After this function, every subsequent operation uses getUserClient().
 */
async function getOrCreateUser(phone) {
  console.log(`\n👤 getOrCreateUser: ${phone}`);

  // Admin SELECT — safe, we immediately hand off to user-scoped client after
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', phone)
    .maybeSingle();

  if (existing) {
    console.log('✅ Existing user:', existing.display_name);
    return existing;
  }

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('❌ Fetch user error:', fetchErr);
    throw fetchErr;
  }

  console.log('🆕 Creating new user...');

  // Admin INSERT — no RLS INSERT policy exists by design (schema note line ~487)
  const { data: newUser, error: createErr } = await supabaseAdmin
    .from('profiles')
    .insert([{
      whatsapp_number: phone,
      display_name: PLACEHOLDER_NAME, // sentinel for "needs onboarding"
      timezone: 'Asia/Kolkata',
      academics_enabled: false,
      personal_enabled: false,            // override schema default of true
    }])
    .select()
    .single();

  if (createErr) {
    console.error('❌ Create user error:', createErr);
    throw createErr;
  }

  console.log('✅ New user created:', newUser.id);
  return newUser;

  // ── Admin is DONE here. All subsequent DB access uses getUserClient(). ──
}

/**
 * Update profile fields.
 * Uses user-scoped client — RLS UPDATE policy allows owners to update own row.
 */
async function updateProfile(phone, updates) {
  const uc = getUserClient(phone);

  const { data, error } = await uc
    .from('profiles')
    .update(updates)
    .eq('whatsapp_number', phone)
    .select()
    .single();

  if (error) { console.error('❌ updateProfile error:', error); throw error; }
  return data;
}

/**
 * Seed 6 default personal categories.
 * Uses user-scoped client — subject_categories has INSERT RLS policy.
 * UNIQUE(profile_id, name) makes the upsert idempotent.
 */
async function seedDefaultCategories(phone) {
  const uc = getUserClient(phone);

  // We need profile_id. Fetch it via user-scoped client (SELECT RLS policy exists).
  const { data: profile, error: pErr } = await uc
    .from('profiles')
    .select('id')
    .eq('whatsapp_number', phone)
    .single();

  if (pErr || !profile) {
    console.error('⚠️  Could not fetch profile for seeding:', pErr);
    return;
  }

  const rows = [
    { profile_id: profile.id, name: 'Professional Development', color_hex: '#8b5cf6', is_default: true },
    { profile_id: profile.id, name: 'Competitive Exams', color_hex: '#ec4899', is_default: true },
    { profile_id: profile.id, name: 'Language Learning', color_hex: '#f59e0b', is_default: true },
    { profile_id: profile.id, name: 'Creative Skills', color_hex: '#10b981', is_default: true },
    { profile_id: profile.id, name: 'Hobbies', color_hex: '#6366f1', is_default: true },
  ];

  const { error } = await uc
    .from('subject_categories')
    .upsert(rows, { onConflict: 'profile_id,name', ignoreDuplicates: true });

  if (error) console.error('⚠️  Seed categories error:', error);
  else console.log('✅ Default categories seeded for', phone);
}

// ============================================================================
// ONBOARDING STATE MACHINE
// ============================================================================

function startOnboarding(phone) {
  setSession(phone, 'awaiting_name', {});
  return `👋 Hi there! Welcome to *Ryu Medha* — I'm your new personal study assistant. 🎓

I'm here to help you track your classes, manage your tasks, and keep an eye on your grades so you can focus on learning.

To get started, what should I call you? 😊`;
}

/**
 * Drives onboarding one step at a time.
 * Returns the reply string, or null if step was unhandled.
 *
 * All DB writes here use getUserClient() (updateProfile, seedDefaultCategories,
 * reference table inserts which have no RLS).
 */
async function handleOnboarding(user, session, rawText) {
  const { step, data } = session;
  const text = rawText.trim();
  const uc = getUserClient(user.whatsapp_number);

  // ── Step 1: Name ─────────────────────────────────────────────────────────
  if (step === 'awaiting_name') {
    if (!text) return `I'd love to know your name so I can set things up for you! 😊`;

    await updateProfile(user.whatsapp_number, { display_name: text });
    setSession(user.whatsapp_number, 'awaiting_setup_method', { name: text });

    return `It's great to meet you, *${text}*! 👋

How would you like to set up your profile? 

1️⃣  *Continue here* (I'll ask you a few quick questions)
2️⃣  *Use the website* (A bit faster, with easy dropdowns)

Just reply with *1* or *2*!`;
  }

  // ── Step 2: Setup choice ──────────────────────────────────────────────────
  if (step === 'awaiting_setup_method') {
    const lower = text.toLowerCase();

    // Option 2: Website
    if (['2', 'website', 'web'].includes(lower)) {
      clearSession(user.whatsapp_number);
      return `Perfect! You can complete your setup on our dashboard here:

${WEBSITE_URL}/setup

Your account is already waiting for you. Just log in with your WhatsApp number and I'll see you on the other side! 💻✨`;
    }

    // Option 1: Bot
    if (['1', 'here', 'chat'].includes(lower)) {
      setSession(user.whatsapp_number, 'awaiting_track_selection', { ...data });

      return `Awesome, let's do it right here! ✍️

What would you like to track with me?

1️⃣  *Academics* (University classes, attendance, and CGPA)
2️⃣  *Personal* (Self-study, skills, or hobbies)
3️⃣  *Both* (Full academic + personal tracking)

Tell me *1*, *2*, or *3*!`;
    }

    return `Please reply *1* to continue here or *2* to set up on the website.`;
  }

  // ── Step 3: Track preference ──────────────────────────────────────────────
  if (step === 'awaiting_track_selection') {
    const lower = text.toLowerCase();
    let track = null;

    if (['1', 'academic', 'academics'].includes(lower)) track = 'academic';
    else if (['2', 'personal'].includes(lower)) track = 'personal';
    else if (['3', 'both'].includes(lower)) track = 'both';

    if (!track) return `Please reply with *1* (Academic), *2* (Personal), or *3* (Both).`;

    const wantsAcademic = track === 'academic' || track === 'both';
    const wantsPersonal = track === 'personal' || track === 'both';

    // Personal-only — done immediately
    if (wantsPersonal && !wantsAcademic) {
      await updateProfile(user.whatsapp_number, {
        personal_enabled: true,
        academics_enabled: false,
      });
      await seedDefaultCategories(user.whatsapp_number);
      clearSession(user.whatsapp_number);

      return `All set! I've enabled *Personal Tracking* for you. ✨

I've already added some common categories like "Creative Skills" and "Language Learning" to get you started. 

*Try telling me something like:*
• "Add subject Spanish"
• "Add category Photography"

Whenever you need a hand, just type *help*! 🚀`;
    }

    // Academic or Both — fetch universities
    const { data: unis } = await uc
      .from('universities')
      .select('id, name')
      .order('name', { ascending: true });

    let msg = `🏛️ *Which University do you attend?*\n\n`;
    if (unis && unis.length > 0) {
      unis.forEach((u, i) => { msg += `${i + 1}. ${u.name}\n`; });
      msg += `\n_You can reply with the number or just type the name._`;
    } else {
      msg = `🏛️ *What is the name of your University?*\n\n(e.g., "Delhi University")`;
    }

    setSession(user.whatsapp_number, 'awaiting_university', {
      ...data,
      track,
      wantsPersonal,
      unisList: unis || []
    });

    return msg;
  }

  // ── Step 4: University Selection ──────────────────────────────────────────
  if (step === 'awaiting_university') {
    if (!text) return `Please enter or select your university name.`;

    let university;
    const match = text.match(/^\d+$/);

    // Check if it's a number from the list
    if (match) {
      const idx = parseInt(match[0], 10) - 1;
      if (data.unisList && data.unisList[idx]) {
        university = data.unisList[idx];
      }
    }

    // Fallback: Check if name exists in DB or create it
    if (!university) {
      const { data: existing } = await uc
        .from('universities')
        .select('id, name')
        .ilike('name', text)
        .maybeSingle();

      if (existing) {
        university = existing;
      } else {
        const { data: created, error } = await uc
          .from('universities')
          .insert([{ name: text }])
          .select()
          .single();
        if (error) return `❌ Error saving university. Please try again.`;
        university = created;
      }
    }

    // Fetch Programs for this university
    const { data: progs } = await uc
      .from('programs')
      .select('id, name, default_target_attendance')
      .eq('university_id', university.id)
      .order('name', { ascending: true });

    let msg = `🎓 *And what is your Program at ${university.name}?*\n\n`;
    if (progs && progs.length > 0) {
      progs.forEach((p, i) => { msg += `${i + 1}. ${p.name}\n`; });
      msg += `\n_Reply with the number or type it out (e.g., BA LLB)._`;
    } else {
      msg = `🎓 *What is the name of your Program?*\n\n(e.g., "B.Tech Computer Science" or "BA LLB")`;
    }

    setSession(user.whatsapp_number, 'awaiting_program', {
      ...data,
      universityId: university.id,
      universityName: university.name,
      progsList: progs || []
    });

    return msg;
  }

  // ── Step 5: Program Selection ─────────────────────────────────────────────
  if (step === 'awaiting_program') {
    if (!text) return `Please enter or select your program name.`;

    let program;
    const match = text.match(/^\d+$/);

    if (match) {
      const idx = parseInt(match[0], 10) - 1;
      if (data.progsList && data.progsList[idx]) {
        program = data.progsList[idx];
      }
    }

    if (!program) {
      const { data: existing } = await uc
        .from('programs')
        .select('id, name, default_target_attendance')
        .eq('university_id', data.universityId)
        .ilike('name', text)
        .maybeSingle();

      if (existing) {
        program = existing;
      } else {
        const { data: created, error } = await uc
          .from('programs')
          .insert([{ university_id: data.universityId, name: text }])
          .select()
          .single();
        if (error) return `❌ Error saving program. Try again.`;
        program = created;
      }
    }

    setSession(user.whatsapp_number, 'awaiting_semester', {
      ...data,
      programId: program.id,
      programName: program.name,
      defaultTarget: program.default_target_attendance || 75
    });

    return `📖 *Which Semester are you in?*

Example: _"5"_ or _"Semester 5"_`;
  }

  // ── Step 6: Semester ──────────────────────────────────────────────────────
  if (step === 'awaiting_semester') {
    const match = text.match(/\d+/);
    if (!match) return `Please enter a valid semester number, e.g. *5*.`;

    const semNum = parseInt(match[0], 10);
    const semName = `Semester ${semNum}`;

    let semester;
    const { data: existing } = await uc
      .from('semesters')
      .select('id')
      .eq('program_id', data.programId)
      .eq('semester_number', semNum)
      .maybeSingle();

    if (existing) {
      semester = existing;
    } else {
      const { data: created, error } = await uc
        .from('semesters')
        .insert([{ program_id: data.programId, semester_number: semNum, name: semName }])
        .select()
        .single();
      if (error) return `❌ Error saving semester.`;
      semester = created;
    }

    setSession(user.whatsapp_number, 'awaiting_target_pct', {
      ...data,
      semesterId: semester.id,
      semesterName: semName
    });

    return `🎯 *Attendance Goal*

What's the minimum attendance percentage you're aiming for?
${data.defaultTarget ? `_(Most students in your program aim for **${data.defaultTarget}%**)_` : ''}

_(Just send me the number, like **75** or **85**)_`;
  }

  // ── Step 7: Final Target & Finish ─────────────────────────────────────────
  if (step === 'awaiting_target_pct') {
    const match = text.match(/\d+(\.\d+)?/);
    const pct = match ? parseFloat(match[0]) : (data.defaultTarget || 75);

    await updateProfile(user.whatsapp_number, {
      academics_enabled: true,
      personal_enabled: data.wantsPersonal || false,
      current_university_id: data.universityId,
      current_program_id: data.programId,
      current_semester_id: data.semesterId,
      target_attendance_pct: pct
    });

    if (data.wantsPersonal) await seedDefaultCategories(user.whatsapp_number);

    clearSession(user.whatsapp_number);

    return `✨ *You're all set, ${data.name}!* ✨

I've created your profile with these details:
🏛️ *${data.universityName}*
🎓 *${data.programName}*
📖 *${data.semesterName}*
🎯 *Goal: ${pct}%*

*You can now start managing your studies:*
• "Add subject Math"
• "I went to Law class"
• "How are my stats?"

I'm here whenever you need me. Just type *help* if you ever get stuck. Let's make this semester great! 🚀🎓`;
  }

  // ── Mid-command: subject type disambiguation ───────────────────────────────
  if (step === 'awaiting_subject_type') {
    const lower = text.toLowerCase();
    let type = null;

    if (['1', 'academic', 'academics'].includes(lower)) type = 'academic';
    else if (['2', 'personal'].includes(lower)) type = 'personal';

    if (!type) return `Please reply * 1 * for Academic or * 2 * for Personal.`;

    clearSession(user.whatsapp_number);

    // Re-fetch fresh profile (track flags may have just been set)
    const fresh = await getOrCreateUser(user.whatsapp_number);
    return await createSubject(fresh, data.subjectName, type);
  }

  clearSession(user.whatsapp_number);
  return null;
}

// ============================================================================
// CATEGORY HANDLERS  (all via user JWT client — RLS enforced)
// ============================================================================

async function handleAddCategory(user, categoryName) {
  if (!categoryName) return `I'd be happy to add a new category for you! Just let me know what to call it (e.g., "Professional Development").`;

  const uc = getUserClient(user.whatsapp_number);

  // Case-insensitive duplicate check
  const { data: dup } = await uc
    .from('subject_categories')
    .select('name')
    .eq('profile_id', user.id)
    .ilike('name', categoryName)
    .maybeSingle();

  if (dup) {
    return `It looks like you already have a category named *"${dup.name}"*! 📂`;
  }

  const { data: created, error } = await uc
    .from('subject_categories')
    .insert([{ profile_id: user.id, name: categoryName, color_hex: '#6366f1', is_default: false }])
    .select()
    .single();

  if (error) {
    console.error('❌ addCategory:', error);
    return `I'm sorry, I ran into a bit of trouble creating that category. Could you try again in a moment?`;
  }

  return `Got it! I've created the *"${created.name}"* category for you. 📂

You can start adding subjects to it whenever you're ready!`;
}

async function handleListCategories(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: cats, error } = await uc
    .from('subject_categories')
    .select('name')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true });

  if (error || !cats || cats.length === 0) {
    return `It looks like you haven't created any categories yet. 📂\n\nWant to add one? Just tell me something like *"Add category Professional"*.`;
  }

  let msg = `📂 *Here are your current categories (${cats.length}):*\n\n`;
  cats.forEach((c, i) => { msg += `${i + 1}. ${c.name}\n`; });
  return msg;
}

async function handleDeleteCategory(user, categoryName) {
  if (!categoryName) return `Please provide a category name.\nExample: * delete category Hobbies * `;

  const uc = getUserClient(user.whatsapp_number);

  const { data: cat } = await uc
    .from('subject_categories')
    .select('id, name')
    .eq('profile_id', user.id)
    .ilike('name', categoryName)
    .maybeSingle();

  if (!cat) {
    return `I couldn't find a category named *"${categoryName}"* in your list. 📂`;
  }

  const { count } = await uc
    .from('subjects')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', cat.id)
    .eq('is_active', true);

  if (count > 0) {
    return `I can't delete *"${cat.name}"* just yet because there are ${count} subject${count > 1 ? 's' : ''} still using it. 📂

Could you please move or delete those subjects first?`;
  }

  const { error } = await uc
    .from('subject_categories')
    .delete()
    .eq('id', cat.id);

  if (error) {
    console.error('❌ deleteCategory:', error);
    return `I'm sorry, I couldn't delete that category. Please try again!`;
  }

  return `Done! I've removed the *"${cat.name}"* category for you. 🗑️`;
}

// ============================================================================
// SUBJECT HELPERS  (all via user JWT client — RLS enforced)
// ============================================================================

/**
 * The subjects table has a DB CHECK constraint:
 *   academic subjects MUST have source_course_id (NOT NULL for type='academic').
 *
 * academic_courses has NO RLS so the user JWT client can read/write it freely.
 * We find-or-create an academic_courses row for the subject name within the
 * user's current semester, then pass its id as source_course_id.
 */
async function findOrCreateAcademicCourse(uc, semesterId, courseName) {
  const { data: existing } = await uc
    .from('academic_courses')
    .select('id')
    .eq('semester_id', semesterId)
    .ilike('course_name', courseName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await uc
    .from('academic_courses')
    .insert([{ semester_id: semesterId, course_name: courseName }])
    .select()
    .single();

  if (error) { console.error('❌ findOrCreateAcademicCourse:', error); throw error; }
  return created.id;
}

/** Core subject creation. type = 'academic' | 'personal' */
async function createSubject(user, subjectName, type, total = null, missed = 0, attended = 0) {
  const uc = getUserClient(user.whatsapp_number);

  // Duplicate check (case-insensitive, active subjects only)
  const { data: dup } = await uc
    .from('subjects')
    .select('name, type')
    .eq('profile_id', user.id)
    .ilike('name', subjectName.trim())
    .eq('is_active', true)
    .maybeSingle();

  if (dup) {
    return `Wait, it looks like *"${dup.name}"* is already in your list! (${dup.type} subject) 📚`;
  }

  // ── Academic subject ──────────────────────────────────────────────────────
  if (type === 'academic') {
    if (!user.current_semester_id) {
      return `It looks like your academic profile isn't fully set up yet. Could you please run *setup* first? 😊`;
    }

    let courseId;
    try {
      courseId = await findOrCreateAcademicCourse(uc, user.current_semester_id, subjectName.trim());
    } catch {
      return `I ran into an issue setting up that subject for you. Could you try again?`;
    }

    const { data: subject, error } = await uc
      .from('subjects')
      .insert([{
        profile_id: user.id,
        type: 'academic',
        name: subjectName.trim(),
        source_course_id: courseId,
        color_hex: null,
        is_active: true,
        expected_total_lectures: total,
        legacy_missed_lectures: missed,
        legacy_attended_lectures: attended
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ createSubject academic:', error);
      return `I'm sorry, I couldn't add *${subjectName.trim()}* right now.`;
    }

    return `Got it! I've added *"${subject.name}"* to your academic list. 🎓`;
  }

  // ── Personal subject ──────────────────────────────────────────────────────
  // Pick the first available category or auto-create 'Hobbies'
  let categoryId = null;

  const { data: cats } = await uc
    .from('subject_categories')
    .select('id')
    .eq('profile_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (cats && cats.length > 0) {
    categoryId = cats[0].id;
  } else {
    const { data: fallback } = await uc
      .from('subject_categories')
      .insert([{ profile_id: user.id, name: 'Hobbies', color_hex: '#6366f1', is_default: true }])
      .select()
      .single();
    categoryId = fallback?.id;
  }

  const { data: subject, error } = await uc
    .from('subjects')
    .insert([{
      profile_id: user.id,
      type: 'personal',
      name: subjectName.trim(),
      category_id: categoryId,
      color_hex: null,
      is_active: true,
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ createSubject personal:', error);
    return `I'm sorry, I couldn't add *${subjectName.trim()}* right now.`;
  }

  return `Got it! I've added *"${subject.name}"* to your personal tracker. 💼`;
}

/** Routes "add subject <n>" — resolves type or asks if both tracks enabled. Supports bulk. */
async function handleAddSubject(user, phone, rawText) {
  if (!rawText) return `Please provide subject details.\nFormat: * add subject < name >, <type (1 = Academic, 2 = Personal) >, [total], [missed], [attended] *\nExample: * add subject Contract Law, 1, 60, 5, 20 * `;

  // Parse by comma for bulk addition or inline stats
  const parts = rawText.split(',').map(s => s.trim()).filter(Boolean);

  // If user only provided a name without type, let's gracefully fail and prompt format.
  if (parts.length < 2) {
    return `Please provide the subject type as well.\nFormat: * add subject < name >, < 1 or 2 >*\n(1 = Academic, 2 = Personal)`;
  }

  const responses = [];

  // Parse out chunks. If we see a string followed by a 1 or 2, that's a subject block.
  // We'll iterate through parts and greedily consume blocks
  let i = 0;
  while (i < parts.length) {
    let name = parts[i];
    let typeVal = parts[i + 1]?.toLowerCase();

    // Check if next part is 1 or 2
    if (!['1', '2', 'academic', 'personal'].includes(typeVal)) {
      responses.push(`❌ Invalid type for * ${name} *.Use 1(Academic) or 2(Personal).`);
      i += 1; // Try to recover by shifting 1
      continue;
    }

    let type = (typeVal === '1' || typeVal === 'academic') ? 'academic' : 'personal';

    // Default to defaults
    let total = null;
    let missed = 0;
    let attended = 0;

    i += 2; // Move past name and type

    // Greedily consume up to 3 numbers if they are numbers and the next thing isn't a string followed by 1 or 2.
    // A heuristic: if the current part is a number and (we haven't found name next OR it's the end)
    if (i < parts.length && !isNaN(parts[i])) {
      total = parseInt(parts[i], 10);
      i++;
      if (i < parts.length && !isNaN(parts[i])) {
        missed = parseInt(parts[i], 10);
        i++;
        if (i < parts.length && !isNaN(parts[i])) {
          attended = parseInt(parts[i], 10);
          i++;
        }
      }
    }

    // Attempt to create it
    const res = await createSubject(user, name, type, total, missed, attended);
    responses.push(res);
  }

  return responses.join('\n\n');
}

async function handleListSubjects(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects, error } = await uc
    .from('subjects')
    .select('name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !subjects || subjects.length === 0) {
    return `I don't see any subjects in your list yet. 📚\n\nWant to add one? Just say something like *"Add academic subject Law"* or *"Track personal subject Guitar"*!`;
  }

  // Hierarchical Filter
  const filteredSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (filteredSubjects.length === 0) {
    return `I don't see any subjects for your current semester yet. 📖\n\nYou can add one by telling me the name and whether it's Academic or Personal.`;
  }

  const academic = filteredSubjects.filter(s => s.type === 'academic');
  const personal = filteredSubjects.filter(s => s.type === 'personal');
  let msg = `📚 * Your Subjects:*\n`;

  if (academic.length) {
    msg += `\n🎓 * Academic:*\n`;
    academic.forEach((s, i) => { msg += `  ${i + 1}. ${s.name} \n`; });
  }
  if (personal.length) {
    msg += `\n💼 * Personal:*\n`;
    personal.forEach((s, i) => { msg += `  ${i + 1}. ${s.name} \n`; });
  }

  msg += `\nYou're currently tracking **${filteredSubjects.length}** subject${filteredSubjects.length !== 1 ? 's' : ''} in this semester scope. 🎓`;
  return msg;
}

async function handleDeleteSubject(user, subjectName) {
  if (!subjectName) return `Please provide a subject name.\nExample: * delete subject Python * `;

  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .ilike('name', subjectName)
    .eq('is_active', true);

  if (!subjects || subjects.length === 0) {
    return `I couldn't find a subject named *"${subjectName}"* in your active list. 📚`;
  }

  // Hierarchical Filter
  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) {
    return `I found *"${subjectName}"*, but it doesn't seem to be in your current semester context. 📖`;
  }

  const subject = validSubjects[0];

  // Soft-delete — preserves attendance logs, timers, grades
  const { error } = await uc
    .from('subjects')
    .update({ is_active: false })
    .eq('id', subject.id);

  if (error) {
    console.error('❌ deleteSubject:', error);
    return `I'm sorry, I couldn't remove that subject for now. Please try again!`;
  }

  return `Done! I've removed *"${subject.name}"* from your active list. 🗑️\n\n_(Don't worry, your history is still safe for your stats)_`;
}

// ============================================================================
// ATTENDANCE HANDLERS  (all via user JWT client — RLS enforced)
// ============================================================================

/** Logs one attendance record then returns the updated summary. */
async function logAttendance(user, subjectName, status) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, expected_total_lectures, legacy_missed_lectures, legacy_attended_lectures, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `% ${subjectName.trim()}% `);

  if (!subjects || subjects.length === 0) {
    return `I couldn't find a subject named *"${subjectName.trim()}"* in your list. 📚`;
  }

  // Hierarchical Filter
  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) {
    return `I found *"${subjectName.trim()}"*, but it doesn't seem to be in your current semester context. 📖`;
  }

  const subject = validSubjects[0];

  if (subject.type !== 'academic') {
    return `I noticed *${subject.name}* is a personal subject. I only track attendance for your academic classes! 🎓`;
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // attendance_logs has UNIQUE(profile_id, subject_id, lecture_date)
  const { data: existing } = await uc
    .from('attendance_logs')
    .select('id, status')
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id)
    .eq('lecture_date', today)
    .maybeSingle();

  if (existing) {
    return `You've already marked *${subject.name}* as *${existing.status}* for today! 😊`;
  }

  const { error } = await uc
    .from('attendance_logs')
    .insert([{
      profile_id: user.id,
      subject_id: subject.id,
      lecture_date: today,
      status,
    }]);

  if (error) {
    console.error('❌ logAttendance:', error);
    return `I'm sorry, I couldn't mark your attendance for *${subject.name}* right now. Please try again!`;
  }

  const prefix = status === 'present' ? `Great job! I've marked you present for *${subject.name}*. 🎓\n\n` : `Got it. I've marked you absent for *${subject.name}*. ✍️\n\n`;
  return await buildAttendanceSummary(uc, user, subject, prefix);
}

/** Builds the "Subject: 5/7 (71.4%)" line using dynamic target_attendance_pct and legacy counters. */
async function buildAttendanceSummary(uc, user, subject, prefix = '') {
  const { data: logs } = await uc
    .from('attendance_logs')
    .select('status')
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id)
    .in('status', ['present', 'absent', 'deemed']); // include 'deemed'

  const actualPresent = logs ? logs.filter(l => l.status === 'present').length : 0;
  const actualAbsent = logs ? logs.filter(l => l.status === 'absent').length : 0;
  const actualDeemed = logs ? logs.filter(l => l.status === 'deemed').length : 0;

  const totalPresent = actualPresent + (subject.legacy_attended_lectures || 0);
  const totalAbsent = actualAbsent + (subject.legacy_missed_lectures || 0);
  const totalDeemed = actualDeemed; // Assuming deemed is not in legacy
  const totalCounted = totalPresent + totalAbsent + totalDeemed;

  if (totalCounted === 0) return `${prefix}${subject.name}: 0 classes so far.`;

  // Formula: (Present + Deemed) / Total
  const pct = ((totalPresent + totalDeemed) / totalCounted) * 100;

  // Use user's custom target percentage, default 75
  const targetPct = user.target_attendance_pct || 75.0;

  const emoji = pct >= targetPct ? '✅' : pct >= (targetPct - 15) ? '⚠️' : '🔴';

  let msg = `${prefix}${emoji} * ${subject.name}*: ${totalPresent}/${totalCounted} (${pct.toFixed(1)}%)`;
  if (totalDeemed > 0) msg += ` _(incl. ${totalDeemed} deemed)_`;

  // Dynamic calculations based on total expected lectures
  if (subject.expected_total_lectures > 0) {
    const totalSemLectures = subject.expected_total_lectures;
    const maxAllowedMisses = Math.floor(totalSemLectures * (1 - (targetPct / 100)));

    // Net Absent = Absent - Deemed
    const netAbsent = totalAbsent - totalDeemed;
    const bunksLeft = maxAllowedMisses - netAbsent;

    if (bunksLeft >= 0) {
      msg += `\n💡 You can still skip *${bunksLeft}* class${bunksLeft !== 1 ? 'es' : ''} and stay above your goal!`;
    } else {
      // How many more present to reach target?
      // (Present + x + Deemed) / (Total + x) >= Target
      // P + D + x >= T * (Total + x)
      // P + D + x >= T*Total + T*x
      // x(1 - T) >= T*Total - (P + D)
      // x >= (T*Total - (P + D)) / (1 - T)
      const t = targetPct / 100;
      const x = Math.ceil((t * totalCounted - (totalPresent + totalDeemed)) / (1 - t));
      msg += `\n🚨 Warning: You need to attend the next **${x}** class${x !== 1 ? 'es' : ''} to get back on track!`;
    }
  } else if (pct < targetPct) {
    const t = targetPct / 100;
    const x = Math.ceil((t * totalCounted - (totalPresent + totalDeemed)) / (1 - t));
    if (x > 0) msg += `\n💡 You should attend the next **${x}** class${x !== 1 ? 'es' : ''} to reach your ${targetPct}% goal.`;
  }

  return msg;
}

async function handleAttended(user, rawText) {
  if (!rawText) return `Just let me know which subjects you attended today! 🎓\n\n(e.g., *"attended Math"* or *"present in Law"*)`;
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'present'));
  }
  return responses.join('\n\n');
}

async function handleMissed(user, rawText) {
  if (!rawText) return `I hope everything is okay! Which class did you miss? ✍️\n\n(e.g., *"missed Economics"*) `;
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'absent'));
  }
  return responses.join('\n\n');
}
async function handleDeemed(user, rawText) {
  if (!rawText) return `If a class was cancelled or you were given a holiday, just let me know which ones! 🏖️\n\n(e.g., *"deemed Law"*)`;
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'deemed'));
  }
  return responses.join('\n\n');
}
async function handleUndoAttendance(user, subjectName) {
  if (!subjectName) return `Please provide a subject name.\nExample: *undo Contract Law*`;

  const uc = getUserClient(user.whatsapp_number);
  const today = new Date().toISOString().split('T')[0];

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName.trim()}%`);

  if (!subjects || subjects.length === 0) return `❌ Subject *"${subjectName}"* not found.`;

  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) return `❌ Subject not in current context.`;
  const subject = validSubjects[0];

  const { error } = await uc
    .from('attendance_logs')
    .delete()
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id)
    .eq('lecture_date', today);

  if (error) return `I'm sorry, I couldn't undo that for you right now.`;

  return await buildAttendanceSummary(uc, user, subject, `🔄 No problem, I've removed today's log for *${subject.name}*.\n\n`);
}

/** Updates legacy missed or attended counters: update missed <subj>, <count> */
async function handleUpdateLegacy(user, column, rawText) {
  const parts = rawText.split(',').map(s => s.trim());
  if (parts.length < 2 || isNaN(parts[1])) {
    return `Format: *update ${column === 'legacy_missed_lectures' ? 'missed' : 'attended'} <subject>, <count>*\nExample: *update missed Math, 5*`;
  }

  const subjectName = parts[0];
  const count = parseInt(parts[1], 10);

  const uc = getUserClient(user.whatsapp_number);
  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName}%`);

  if (!subjects || subjects.length === 0) {
    return `I couldn't find a subject named *"${subjectName}"* in your list. 📚`;
  }

  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) return `❌ Subject not in current context.`;

  const subject = validSubjects[0];
  const updates = {};
  updates[column] = count;

  const { error } = await uc
    .from('subjects')
    .update(updates)
    .eq('id', subject.id);

  if (error) {
    console.error('❌ update legacy error:', error);
    return `I'm sorry, I couldn't update your history for *${subject.name}*. Please try again.`;
  }

  return `Fixed! I've updated *${subject.name}* to ${count} ${column === 'legacy_missed_lectures' ? 'missed' : 'attended'} classes in your history. ✍️`;
}

async function handleStats(user) {
  if (!user.academics_enabled) {
    return `I only track attendance stats for academic subjects! 📊

You have personal tracking enabled. Would you like to check your *subjects* list instead?`;
  }

  const uc = getUserClient(user.whatsapp_number);

  const { data: rawSubjects } = await uc
    .from('subjects')
    .select('id, name, expected_total_lectures, legacy_missed_lectures, legacy_attended_lectures, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .eq('type', 'academic');

  const subjects = rawSubjects?.filter(s => s.source_course_id?.semester_id === user.current_semester_id) || [];

  if (!subjects || subjects.length === 0) {
    return `You haven't added any academic subjects for this semester yet! 📊🎓\n\nYou can add one by telling me something like *"Add subject Math"*!`;
  }

  let msg = `📊 *Attendance Stats (Target: ${user.target_attendance_pct || 75}%):*\n\n`;
  let hasData = false;

  for (const subject of subjects) {
    const summaryStr = await buildAttendanceSummary(uc, user, subject, '');
    if (!summaryStr.includes('0 classes so far.')) {
      hasData = true;
      msg += summaryStr + '\n\n';
    } else {
      msg += `⬜ *${subject.name}*: No data yet\n\n`;
    }
  }

  if (!hasData) return `I don't have any attendance logs for your subjects yet! 📊\n\nTry telling me something like *"I was present in Math"* to get started.`;
  return msg.trim();
}

// ============================================================================
// STUDY TIMERS
// ============================================================================

async function handleStartTimer(user, subjectName) {
  if (!subjectName) return `Please provide a subject name.\nExample: *start Contract Law*`;

  const uc = getUserClient(user.whatsapp_number);

  // Check if a timer is already running
  const { data: running } = await uc
    .from('study_timers')
    .select('id, subjects(name)')
    .eq('profile_id', user.id)
    .is('ended_at', null)
    .maybeSingle();

  if (running) {
    return `⚠️ You already have an active timer for *${running.subjects?.name || 'a subject'}*.\n\nPlease reply with *stop* before starting a new one.`;
  }

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName.trim()}%`);

  if (!subjects || subjects.length === 0) {
    return `❌ Subject *"${subjectName.trim()}"* not found.\n\nView subjects: *subjects*`;
  }

  // Hierarchical Filter
  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) {
    return `❌ Subject *"${subjectName.trim()}"* exists but is not in your current semester context.`;
  }

  const subject = validSubjects[0];

  const { error } = await uc
    .from('study_timers')
    .insert([{
      profile_id: user.id,
      subject_id: subject.id,
      started_at: new Date().toISOString(),
    }]);

  if (error) {
    console.error('❌ startTimer error:', error);
    return `I'm sorry, I couldn't start the timer. Could you try again?`;
  }

  return `⏱️ *Study session started for ${subject.name}!*

I'll keep track of the time for you. Just tell me *"stop"* or *"done studying"* when you're finished! 💪`;
}

async function handleStopTimer(user) {
  const uc = getUserClient(user.whatsapp_number);

  // Find running timer
  const { data: running } = await uc
    .from('study_timers')
    .select('id, started_at, subjects(name)')
    .eq('profile_id', user.id)
    .is('ended_at', null)
    .maybeSingle();

  if (!running) {
    return `ℹ️ You don't have an active timer.`;
  }

  const endedAt = new Date();
  const startedAt = new Date(running.started_at);
  const diffMs = endedAt - startedAt;
  const totalMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  const { error } = await uc
    .from('study_timers')
    .update({ ended_at: endedAt.toISOString() })
    .eq('id', running.id);

  if (error) {
    console.error('❌ stopTimer error:', error);
    return `I'm sorry, I couldn't stop the timer. Could you try again?`;
  }

  return `⏹️ *Great focus!* You've finished your session for *${running.subjects?.name || 'Subject'}*.

⏱️ Duration: **${hrs}h ${mins}m**
I've saved this to your study history. Take a well-deserved break! 💪✨`;
}

// ============================================================================
// TASK HANDLERS  (all via user JWT client — RLS enforced)
// ============================================================================

async function handleAddTask(user, rawText) {
  if (!rawText) return `Please provide a task title.\nFormat: *add task <title> [due <YYYY-MM-DD>]*\nExample: *add task Submit assignment due 2026-03-10*`;

  let title = rawText.trim();
  let dueDate = null;

  // Extremely basic due date parsing for MVP
  const dueMatch = title.match(/due\s+(\d{4}-\d{2}-\d{2})/i);
  if (dueMatch) {
    dueDate = new Date(dueMatch[1]).toISOString();
    title = title.replace(dueMatch[0], '').trim();
  }

  // Handle adding it to the end of the day if a date was found
  if (dueDate) {
    const endOfDay = new Date(dueDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    dueDate = endOfDay.toISOString();
  }

  const uc = getUserClient(user.whatsapp_number);

  const { data: task, error } = await uc
    .from('tasks')
    .insert([{
      profile_id: user.id,
      title: title,
      is_completed: false,
      priority: 'medium',
      due_date: dueDate,
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ addTask error:', error);
    return `I'm sorry, I couldn't add that task for you right now.`;
  }

  const dueStr = task.due_date ? ` (due ${new Date(task.due_date).toLocaleDateString('en-IN')})` : '';
  return `Consider it done! I've added *"${task.title}"*${dueStr} to your list. ✅`;
}

async function handleCompleteTask(user, numberStr) {
  const taskIndex = parseInt(numberStr, 10) - 1;
  if (isNaN(taskIndex) || taskIndex < 0) return `Please provide a valid task number.\nExample: *done 1*`;

  const uc = getUserClient(user.whatsapp_number);

  // We must fetch exactly the same list `handleListTasks` does to get the correct UUID for index N
  const { data: rawTasks } = await uc
    .from('tasks')
    .select('id, title, subject_id, subjects(type, source_course_id(semester_id))')
    .eq('profile_id', user.id)
    .eq('is_completed', false)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (!rawTasks || rawTasks.length === 0) return `You don't have any pending tasks right now! 📋`;

  // Hierarchical Filter (exact match to handleListTasks)
  const tasks = rawTasks.filter(t => {
    if (!t.subject_id) return true;
    const sub = t.subjects;
    if (sub.type === 'personal') return true;
    const semesterId = Array.isArray(sub.source_course_id)
      ? sub.source_course_id[0]?.semester_id
      : sub.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });
  if (taskIndex >= tasks.length) return `I couldn't find task #${taskIndex + 1} in your list. You have ${tasks.length} task(s) pending.`;

  const targetTask = tasks[taskIndex];

  const { error } = await uc
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString()
    })
    .eq('id', targetTask.id);

  if (error) {
    console.error('❌ completeTask error:', error);
    return `I'm sorry, I couldn't mark that task as finished.`;
  }

  return `Nice work! I've checked off *"${targetTask.title}"* for you. 🎉💪`;
}

async function handleListTasks(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: tasks, error } = await uc
    .from('tasks')
    .select('title, priority, due_date, subject_id, subjects(type, source_course_id(semester_id))')
    .eq('profile_id', user.id)
    .eq('is_completed', false)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error || !tasks || tasks.length === 0) {
    return `You're all caught up! You have no pending tasks right now. 📋✨`;
  }

  // Hierarchical Filter
  const filteredTasks = tasks.filter(t => {
    if (!t.subject_id) return true; // Independent tasks show up
    const sub = t.subjects;
    if (sub.type === 'personal') return true;
    const semesterId = Array.isArray(sub.source_course_id)
      ? sub.source_course_id[0]?.semester_id
      : sub.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (filteredTasks.length === 0) {
    return `📋 No pending tasks for the current semester!`;
  }

  const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  let msg = `📋 *Pending Tasks (${filteredTasks.length}):*\n\n`;
  filteredTasks.forEach((t, i) => {
    const p = priorityEmoji[t.priority] || '🟡';
    const due = t.due_date
      ? ` _(due ${new Date(t.due_date).toLocaleDateString('en-IN')})_`
      : '';
    msg += `${i + 1}. ${p} ${t.title}${due}\n`;
  });

  msg += `\nYou have **${filteredTasks.length}** task${filteredTasks.length !== 1 ? 's' : ''} to work on. You've got this! 💪`;
  return msg;
}

// ============================================================================
// GRADES AND DATA MANAGEMENT
// ============================================================================

async function handleAddGrade(user, rawText) {
  // Parsing standard: add grade Math, MidSem, 25, 30, [weigtage]
  const parts = rawText.split(',').map(p => p.trim());
  if (parts.length < 4) {
    return `I'd love to save your marks! Just tell me the subject, the exam type, and your score. 🎓✨\n\n(e.g., *"I got 25/30 in Math assignment"* or *"add grade Law, MidSem, 40, 50"*)`;
  }

  const [subjectName, gradeTypeRaw, marksStr, maxMarksStr, weightageStr] = parts;
  const allowedStatuses = ['mid_sem', 'end_sem', 'project', 'assignment', 'quiz', 'viva', 'other'];

  let gt = gradeTypeRaw.toLowerCase().replace(/\s+/g, '_');
  if (gt === 'midsem') gt = 'mid_sem';
  if (gt === 'endsem') gt = 'end_sem';
  if (!allowedStatuses.includes(gt)) gt = 'other';

  const marks = parseFloat(marksStr);
  const maxMarks = parseFloat(maxMarksStr);
  let weightage = parseFloat(weightageStr);
  if (isNaN(weightage)) weightage = null;

  if (isNaN(marks) || isNaN(maxMarks)) return `I need the marks and max marks to be numbers so I can calculate your performance! 📊`;

  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName}%`);

  if (!subjects || subjects.length === 0) return `❌ Subject *"${subjectName}"* not found.`;
  const subject = subjects[0];

  const { data: insertData, error } = await uc
    .from('grades')
    .insert({
      profile_id: user.id,
      subject_id: subject.id,
      grade_type: gt,
      marks: marks,
      max_marks: maxMarks,
      weightage: weightage,
      assessed_date: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ add grade error:', error);
    return `I'm sorry, I couldn't save that grade for you right now.`;
  }

  const p = ((marks / maxMarks) * 100).toFixed(1);
  return `Great work! I've saved your *${gradeTypeRaw.toUpperCase()}* marks for *${subject.name}*. 🎓✨

Score: **${marks}/${maxMarks}** (${p}%)
Keep it up! 💪`;
}

async function handleViewGrades(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: grades, error } = await uc
    .from('grades')
    .select('marks, max_marks, grade_type, subject_id, subjects!inner(name, type, source_course_id(semester_id))')
    .eq('profile_id', user.id);

  if (error || !grades || grades.length === 0) return `I don't see any grades in your record yet. 📊✨\n\nOnce you add some, I can show you your performance overview!`;

  // Hierarchical Filter
  const filteredGrades = grades.filter(g => {
    const sub = g.subjects;
    if (sub.type === 'personal') return true;
    const semesterId = Array.isArray(sub.source_course_id)
      ? sub.source_course_id[0]?.semester_id
      : sub.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (filteredGrades.length === 0) return `I don't see any grades for your current semester yet! 📖✨`;

  // Aggregate by subject
  const map = {};
  filteredGrades.forEach(g => {
    const sName = g.subjects.name;
    if (!map[sName]) map[sName] = { obtained: 0, total: 0 };
    map[sName].obtained += Number(g.marks);
    map[sName].total += Number(g.max_marks);
  });

  let msg = `🎓 *Here is a look at your grades:* \n\n`;
  let overallObtained = 0;
  let overallTotal = 0;

  for (const [name, stats] of Object.entries(map)) {
    if (stats.total > 0) {
      const p = ((stats.obtained / stats.total) * 100).toFixed(1);
      msg += `*${name}:* ${stats.obtained}/${stats.total} (${p}%)\n`;
      overallObtained += stats.obtained;
      overallTotal += stats.total;
    }
  }

  if (overallTotal > 0) {
    const overallP = ((overallObtained / overallTotal) * 100).toFixed(1);
    msg += `\nAcross all subjects, your current average is **${overallP}%**. Keep pushing! 🚀`;
  }

  return msg;
}

async function handleRenameSubject(user, text) {
  // rename subject Old, New
  const parts = text.split(',').map(s => s.trim());
  if (parts.length < 2) return `Format: *rename subject <old>, <new>*\nExample: *rename subject Contract, Contract Law*`;

  const [oldName, newName] = parts;
  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', oldName);

  if (!subjects || subjects.length === 0) return `❌ Active subject *"${oldName}"* not found.`;

  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) return `❌ Subject exists but is not in your current context.`;
  const subject = validSubjects[0];

  const { error } = await uc
    .from('subjects')
    .update({ name: newName })
    .eq('id', subject.id);

  if (error) return `I'm sorry, I couldn't rename that subject. Please ensure the new name is unique and try again!`;
  return `Consider it done! I've renamed *"${subject.name}"* to *"${newName}"* across your profile. ✏️`;
}

async function handleArchiveSemester(user) {
  const uc = getUserClient(user.whatsapp_number);

  // Soft-delete all active academic subjects
  const { data: subjects, error } = await uc
    .from('subjects')
    .update({ is_active: false })
    .eq('profile_id', user.id)
    .eq('type', 'academic')
    .eq('is_active', true)
    .select('id');

  if (error) return `I'm sorry, I couldn't archive your semester subjects right now. Please try again later!`;

  // Wipe the current semester ID
  await updateProfile(user.whatsapp_number, { current_semester_id: null });

  const num = subjects ? subjects.length : 0;
  return `📦 *Semester Archived!*

I've soft-archived your **${num}** academic subjects and cleared your current semester setup. 

Your past attendance and grades are all safely stored! When you're ready to start your next semester, just tell me *"setup"* and we'll get you ready for the new classes. 🎓🚀`;
}

async function handleExport(user) {
  return `📁 Your data export functionality is available via the dashboard! 
  
Please visit ${WEBSITE_URL} and go to your **Settings** page to securely download all your raw data (Subjects, Grades, Timers, Attendance) as a CSV file.`;
}

// ============================================================================
// HELP — contextual based on enabled tracks
// ============================================================================

function handleHelp(user) {
  const hasAcademic = user?.academics_enabled;
  const hasPersonal = user?.personal_enabled;

  let msg = `👋 *Hi! I'm Ryuma, your personal study assistant.* 🎓\n\n`;
  msg += `I'm here to help you stay organized. You don't need to remember specific commands — you can just talk to me! 😊\n\n`;

  msg += `*Here are some things you can tell me:*\n`;
  msg += `📖 *"Add academic subject Math"* or *"Track guitar as a personal skill"*\n`;

  if (hasAcademic) {
    msg += `🎓 *"I went to Law class"* or *"I missed Economics today"*\n`;
    msg += `📊 *"How are my stats?"* or *"What is my attendance like?"*\n`;
    msg += `📝 *"I got 25/30 in my Physics quiz"* or *"Show my grades"*\n`;
  }

  msg += `⏱️ *"Start a timer for History"* or *"Done studying"*\n`;
  msg += `📋 *"Add a task: Submit project by Friday"* or *"Finish task 1"*\n\n`;

  msg += `*Need more?*\n`;
  msg += `👤 Say *"profile"* to see your current setup.\n`;
  msg += `⚙️ Say *"setup"* if you want to redo your profile or start a new semester.\n`;
  msg += `📁 Say *"export"* to get a link to download all your data.\n\n`;

  msg += `You can also manage everything on your dashboard: ${WEBSITE_URL} 💻`;
  return msg;
}

// ============================================================================
// PROFILE HANDLER
// ============================================================================

async function handleProfile(user) {
  const uc = getUserClient(user.whatsapp_number);
  let msg = `👤 *Your Profile*\n\n`;
  msg += `*Name:* ${user.display_name}\n`;

  if (user.personal_enabled) msg += `*Personal Track:* Active\n`;

  if (user.academics_enabled) {
    msg += `*Academic Track:* Active\n`;
    msg += `*Target Attendance:* ${user.target_attendance_pct || 75}%\n`;

    // Fetch university/program details
    if (user.current_university_id) {
      const { data: uni } = await uc.from('universities').select('name').eq('id', user.current_university_id).maybeSingle();
      if (uni) msg += `*University:* ${uni.name}\n`;
    }
    if (user.current_program_id) {
      const { data: prog } = await uc.from('programs').select('name').eq('id', user.current_program_id).maybeSingle();
      if (prog) msg += `*Program:* ${prog.name}\n`;
    }
  }

  msg += `\nIf you ever need to change any of this, just say *"setup"*! 😊`;
  return msg;
}

// ============================================================================
// MAIN MESSAGE PROCESSOR
// ============================================================================

async function processMessage(phone, text) {
  console.log(`\n📄 Processing from ${phone}: "${text}"`);

  try {
    // getOrCreateUser is the ONLY place the admin client is used.
    // Every handler below gets a user-scoped client via getUserClient().
    const user = await getOrCreateUser(phone);
    const lower = text.trim().toLowerCase();
    const session = getSession(phone);

    // ── Active session (onboarding or mid-command disambiguation) ─────────
    if (session) {
      touchSession(phone);
      const result = await handleOnboarding(user, session, text.trim());
      if (result) return result;
    }

    // ── Brand-new user ─────────────────────────────────────────────────────
    if (needsOnboarding(user) && !session) {
      return startOnboarding(phone);
    }

    // ── setup / reset ──────────────────────────────────────────────────────
    if (lower === 'setup' || lower === 'reset') {
      // Reset via user-scoped client — RLS UPDATE policy allows this
      await updateProfile(phone, { display_name: PLACEHOLDER_NAME });
      return startOnboarding(phone);
    }

    // ── Profile commands ───────────────────────────────────────────────────
    if (lower === 'profile') return await handleProfile(user);
    if (lower === 'export') return await handleExport(user);

    // ── Greetings ──────────────────────────────────────────────────────────
    if (['hi', 'hello', 'hey', 'start'].includes(lower) && !lower.startsWith('start ')) {
      return handleHelp(user);
    }

    // ── Help ───────────────────────────────────────────────────────────────
    if (lower === 'help' || lower === 'menu') {
      return handleHelp(user);
    }

    // ── Category commands ──────────────────────────────────────────────────
    if (lower.startsWith('add category ')) return await handleAddCategory(user, text.substring(13).trim());
    if (lower === 'categories' || lower === 'category') return await handleListCategories(user);
    if (lower.startsWith('delete category ')) return await handleDeleteCategory(user, text.substring(16).trim());

    // ── Subject commands ───────────────────────────────────────────────────
    if (lower.startsWith('add subject ')) return await handleAddSubject(user, phone, text.substring(12).trim());
    if (lower.startsWith('rename subject ')) return await handleRenameSubject(user, text.substring(15).trim());
    if (['subjects', 'subject', 'list'].includes(lower)) return await handleListSubjects(user);
    if (lower.startsWith('delete subject ')) return await handleDeleteSubject(user, text.substring(15).trim());
    if (lower === 'archive semester') return await handleArchiveSemester(user);

    // ── Timer commands ─────────────────────────────────────────────────────
    if (lower.startsWith('start ')) return await handleStartTimer(user, text.substring(6).trim());
    if (lower === 'stop') return await handleStopTimer(user);

    // ── Attendance/Grades commands ─────────────────────────────────────────
    if (lower.startsWith('update missed ')) return await handleUpdateLegacy(user, 'legacy_missed_lectures', text.substring(14).trim());
    if (lower.startsWith('update attended ')) return await handleUpdateLegacy(user, 'legacy_attended_lectures', text.substring(16).trim());
    if (lower.startsWith('attended ')) return await handleAttended(user, text.substring(9).trim());
    if (lower.startsWith('missed ')) return await handleMissed(user, text.substring(7).trim());
    if (lower.startsWith('deemed ')) return await handleDeemed(user, text.substring(7).trim());
    if (lower.startsWith('undo ')) return await handleUndoAttendance(user, text.substring(5).trim());
    if (lower === 'stats' || lower === 'attendance') return await handleStats(user);
    if (lower.startsWith('add grade ')) return await handleAddGrade(user, text.substring(10).trim());
    if (lower === 'grades' || lower === 'cgpa') return await handleViewGrades(user);

    // ── Task commands ──────────────────────────────────────────────────────
    if (lower.startsWith('add task ')) return await handleAddTask(user, text.substring(9).trim());
    if (lower === 'tasks' || lower === 'task') return await handleListTasks(user);
    if (lower.startsWith('done ')) return await handleCompleteTask(user, text.substring(5).trim());
    if (lower.startsWith('complete ')) return await handleCompleteTask(user, text.substring(9).trim().replace('task ', ''));

    // ── Heuristic Intent Parsing (Fallback) ──────────────────────────────
    const inferredCommand = await parseIntent(text);
    if (inferredCommand && inferredCommand !== lower) {
      console.log(`💡 Heuristic Match: "${text}" -> "${inferredCommand}"`);
      const reply = await processMessage(phone, inferredCommand);

      if (reply && !reply.includes('🤔 I didn\'t understand')) {
        return reply; // Return the reply directly - no technical prefix
      }
    }

    // ── Unknown ────────────────────────────────────────────────────────────
    return `Hmm, I'm not sure I understood that correctly. 🤔\n\nYou can say *"help"* to see some of the things you can ask me, or visit your dashboard at ${WEBSITE_URL}!`;

  } catch (err) {
    console.error('❌ processMessage error:', err);
    return `❌ Something went wrong. Please try again.\n\nIf this keeps happening, visit ${WEBSITE_URL}`;
  }
}

// ============================================================================
// WHATSAPP — SEND MESSAGE
// ============================================================================

async function sendMessage(to, body) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
  console.log(`📤 Sending to ${to}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      text: { body },
    }),
  });

  const data = await res.json();
  if (res.ok) console.log('✅ Message sent');
  else console.error('❌ Send failed:', JSON.stringify(data));
  return data;
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    service: 'Ryu Medha WhatsApp Bot',
    uptime_seconds: Math.floor(process.uptime()),
    active_sessions: sessions.size,
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('🔐 Webhook verification request');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verification failed');
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  console.log('\n📨 Incoming webhook');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from;       // raw digits e.g. "918767689904"
      const text = message.text?.body;

      console.log(`📱 From : ${from}`);
      console.log(`💬 Text : ${text}`);

      if (text) {
        const phone = from.startsWith('+') ? from : `+${from}`; // E.164 for DB
        const reply = await processMessage(phone, text);
        await sendMessage(from, reply);   // raw digits fine for WhatsApp API
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    res.status(500).send('ERROR');
  }
});

// ============================================================================
// START
// ============================================================================

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Health:   http://localhost:${PORT}/`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook\n`);
});