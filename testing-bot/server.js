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
const { startOnboarding, handleOnboarding } = require('./setup');

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
// LANGUAGE & MESSAGES
// ============================================================================

const MESSAGES = {
  subjects: {
    duplicate: (name, type) => `Wait, it looks like *"${name}"* is already in your list! (${type} subject) 📚`,
    setupNeeded: `It looks like your academic profile isn't fully set up yet. Could you please run *setup* first? 😊`,
    error: `I ran into an issue setting up that subject for you. Could you try again?`,
    academicSuccess: (name) => `Got it! I've added *"${name}"* to your academic list. 🎓`,
    addError: (name) => `I'm sorry, I couldn't add *${name}* right now.`,
    personalSuccess: (name) => `Got it! I've added *"${name}"* to your personal tracker. 💼\n\n💡 *What's next?*\n- Start a timer: *"start ${name}"*\n- Add a task: *"add task Practice ${name}"*\n- Explore more features on the *Dashboard:* ${WEBSITE_URL}`,
    addPrompt: `Please provide subject details.\nFormat: * add <subject name> * \nExample: * add Family Law I * `,
    typeNeeded: `Please provide the subject type as well.\nFormat: * add subject < name >, < 1 or 2 >*\n(1 = Academic, 2 = Personal)`,
    invalidType: (name) => `❌ Invalid type for * ${name} *.Use 1(Academic) or 2(Personal).`,
    empty: `I don't see any subjects in your list yet. 📚\n\nWant to add one? Just say *"Add Family Law I"*.`,
    emptySemester: `I don't see any subjects for your current semester yet. 📖\n\nYou can add one by telling me the name.`,
    listHeader: `📚 * Your Enrolled Subjects:*\n`,
    listAcademic: `\n🎓 * Academic:*\n`,
    listPersonal: `\n💼 * Personal:*\n`,
    listFooter: (count, plural) => `\nYou're currently tracking **${count}** subject${plural ? 's' : ''}. 🎓`,
    deletePrompt: `Please provide a subject name.\nExample: * Delete Contracts Law II * `,
    notFound: (name) => `I couldn't find a subject named *"${name}"* in your active list. 📚`,
    ambiguity: (name, options) => `I found multiple matches for *"${name}"*: \n\n${options}\n\nWhich one did you mean? 🤔`,
    wrongContext: (name) => `I found *"${name}"*, but it doesn't seem to be in your current semester context. 📖`,
    deleteError: `I'm sorry, I couldn't remove that subject for now. Please try again!`,
    deleteSuccess: (name) => `Done! I've removed *${name}* from your active list. 🗑️`,
    renamePrompt: `Format: *Rename <old> to <new>*\nExample: *Rename Family Law I to Family Law II*`,
    renameSuccess: (oldName, newName) => `Consider it done! I've renamed *"${oldName}"* to *"${newName}"*. ✏️`,
    renameError: `I'm sorry, I couldn't rename that subject. Please ensure the new name is unique and try again!`,
    archiveSuccess: (count) => `📦 *Semester Archived!*\n\nI've soft-archived your **${count}** academic subjects and cleared your current semester setup. \n\nYour past attendance and grades are all safely stored! When you're ready to start your next semester, just tell me *"setup"* and we'll get you ready for the new classes. 🎓🚀`,
    archiveError: `I'm sorry, I couldn't archive your semester subjects right now. Please try again later!`,
    setupLecturesSuccess: (name, type, val) => `Updated! *${name}* now has ${val} ${type === 'total' ? 'total' : 'missed'} lectures. ✍️`,
  },
  categories: {
    prompt: `🎨 *Add Category*\n\nPlease provide a name for your new category.\nExample: *add category Music*`,
    duplicate: (name) => `⚠️ The category *"${name}"* already exists!`,
    success: (name) => `✅ Category *"${name}"* created! \n\n💡 Next step: Try adding a subject to it!\nExample: *Add subject Piano to Category ${name}*`,
    error: `❌ I couldn't create that category right now.`,
    empty: `📂 You don't have any custom categories yet.`,
    listHeader: (count) => `📂 *Your Categories (${count}):*\n\n`,
    deletePrompt: `🗑️ Please provide the category name to delete.`,
    notFound: (name) => `❌ Category *"${name}"* not found.`,
    inUse: (name, count) => `⚠️ Cannot delete *"${name}"* because it contains ${count} subject(s).`,
    deleteError: `❌ I couldn't delete that category.`,
    deleteSuccess: (name) => `🗑️ Deleted category *"${name}"*.`,
  },
  attendance: {
    notFound: (name) => `I couldn't find a subject named *"${name}"* in your list. 📚`,
    wrongContext: (name) => `I found *"${name}"*, but it doesn't seem to be in your current semester context. 📖`,
    academicOnly: (name) => `I noticed *${name}* is a personal subject. I only track attendance for your academic classes! 🎓\n\nYou can track personal subjects using *Dashboard* ${WEBSITE_URL} `,
    alreadyMarked: (name, status) => `You've already marked *${name}* as *${status}* for today! 😊`,
    error: (name) => `I'm sorry, I couldn't mark your attendance for *${name}* right now. Please try again! or use *Dashboard* ${WEBSITE_URL} to mark attendance`,
    presentPrefix: (name) => `Great job! I've marked you present for *${name}*. 🎓\n\n`,
    absentPrefix: (name) => `Got it. I've marked you absent for *${name}*. ✍️\n\n`,
    deemedPrefix: (name) => `Got deemed attendance? No problem, I've marked *${name}* as deemed! 🏖️\n\n`,
    summaryNoData: (name) => `${name}: 0 classes so far.`,
    summaryLine: (emoji, name, attended, total, pct) => `${emoji} * ${name}*: ${attended}/${total} (${pct}%)`,
    deemedNote: (count) => ` _(incl. ${count} deemed)_`,
    bunksLeft: (count, plural) => `\n💡 You can still skip *${count}* class${plural ? 'es' : ''} and stay on your goal!`,
    onTrackTip: (count, plural, target) => `\n💡 You should attend the next **${count}** class${plural ? 'es' : ''} to reach your ${target}% goal.`,
    trackWarning: (count, plural) => `\n🚨 Warning: You need to attend the next **${count}** class${plural ? 'es' : ''} to get back on track!`,
    allSuccess: (status, count) => `Done! Marked **${count}** subjects as *${status}* for today. 🗓️`,
    undoSuccess: (name) => `🔄 Removed today's log for *${name}*.`,
    undoAllSuccess: `🔄 Done! Removed all attendance logs for today.`,
    undoError: `❌ I couldn't find any attendance to undo for today.`,
    attendedPrompt: `📚 *Mark Present*\n\nPlease provide the name of the subject(s) you attended.\nExample: *attended Math, Physics*`,
    missedPrompt: `✍️ *Mark Absent*\n\nPlease provide the name of the subject(s) you missed.\nExample: *missed Law*`,
    deemedPrompt: `🏖️ *Mark Deemed*\n\nPlease provide the name of the subject(s) that were cancelled or had deemed attendance.\nExample: *deemed Constitutional Law*`,
    undoPrompt: `🔄 *Undo Attendance*\n\nPlease provide the name of the subject you want to undo for today.\nExample: *undo Law*`,
  },
  stats: {
    academicOnly: `I only track attendance stats for academic subjects! 📊`,
    noSubjects: `You haven't added any academic subjects for this semester yet! 📊🎓\n\nYou can add one by saying *"Add Family Law I"*.`,
    header: (target) => `📊 *Attendance Stats (Target: ${target}%):*\n\n`,
    noDataEmoji: `⬜`,
    noDataNote: `No data yet`,
    empty: `I don't have any attendance logs for your subjects yet! 📊\n\nTry telling me something like *"I attended Constitutional Law I"* to get started.`,
  },
  timers: {
    startPrompt: `Please provide a subject name.\nExample: *Start timer for Contract Law I*`,
    alreadyRunning: (name) => `⚠️ You already have an active timer for *${name || 'a subject'}*.\n\nPlease reply with *stop* before starting a new one.`,
    notFound: (name) => `❌ Subject *"${name}"* not found.\n\nView subjects: *subjects*`,
    wrongContext: (name) => `❌ Subject *"${name}"* exists but is not in your current semester context.\n\n View subjects: *subjects*`,
    startError: `I'm sorry, I couldn't start the timer. Could you try again?`,
    started: (name) => `⏱️ *Study session started for ${name}!*\n\nI'll keep track of the time for you. Just tell me *"stop"* when you're finished! 💪\n\n Or check the live timer on the *Dashboard:* ${WEBSITE_URL}`,
    noActive: `ℹ️ You don't have an active timer.`,
    stopError: `I'm sorry, I couldn't stop the timer. Could you try again?`,
    stopped: (name, hrs, mins) => `⏹️ *Great focus!* You've finished your session for *${name || 'Subject'}*.\n\n⏱️ Duration: **${hrs}h ${mins}m**\nI've saved this to your study history. Take a well-deserved break! 💪✨\n\nYou can view your study history on the *Dashboard:* ${WEBSITE_URL}`,
  },
  tasks: {
    addPrompt: `Please provide a task title.\nExample: *add task Assignment 1 due on 13th march, 2026*`,
    addError: `I'm sorry, I couldn't add that task for you right now.`,
    addSuccess: (title, dueStr) => `Consider it done! I've added *"${title}"*${dueStr} to your Tasks. ✅`,
    dueNote: (date) => ` (due ${date})`,
    donePrompt: `Please provide a valid task number.\nExample: *Mark task 1 as complete*`,
    empty: `You don't have any pending tasks right now! 📋`,
    notFound: (id, count) => `I couldn't find task #${id} in your list. You have ${count} task(s) pending.`,
    doneError: `I'm sorry, I couldn't mark that task as finished.`,
    doneSuccess: (title) => `Nice work! I've checked off *"${title}"* for you. 🎉💪`,
    listCaughtUp: `You're all caught up! You have no pending tasks right now. 📋✨`,
    listHeader: (count) => `📋 *Pending Tasks (${count}):*\n\n`,
    listFooter: (count, plural) => `\nYou have **${count}** task${plural ? 's' : ''} to work on. You've got this! 💪`,
    emptySemester: `📋 No pending tasks for the current semester!`,
  },
  general: {
    export: `📁 Your data export functionality is available via the dashboard! \n  \nPlease visit ${WEBSITE_URL} and go to your **Settings** page to securely download all your raw data (Subjects, Grades, Timers, Attendance) as a CSV file.`,
    help: `👋 *Hi! I'm Ryuma, your study assistant.* 🎓

Use below keywords in your messages to perform actions:
👤 *Profile:* setup, reset, profile
📚 *Subjects:* list, add [name], delete [name], rename [old] to [new]
🗓️ *Attendance:* present [name], absent, deemed, undo, stats
📋 *Tasks:* tasks, add task [title], done [number]
⏱️ *Timers:* start [name], stop

💡 *Tip:* You can just say "I attended Family Law I" or "Mark task 1 as done".
💻 Explore more features on the *Dashboard:* ${WEBSITE_URL}`,
    helpPersonal: `👋 *Hi! I'm Ryuma, your personal tracker.* 💼

Use below keywords in your messages to perform actions:
👤 *Profile:* setup, reset, profile
📚 *Subjects:* list, add [name], delete [name], rename [old] to [new]
🎨 *Categories:* list categories, add category [name], delete category [name]
📋 *Tasks:* tasks, add task [title], done [number]
⏱️ *Timers:* start [name], stop

💡 *Tip:* You can just say "Add piano in category Hobbies".
💻 Explore more features on the *Dashboard:* ${WEBSITE_URL}`,
    helpBoth: `👋 *Hi! I'm Ryuma, your all-in-one assistant.* 🎓💼

Use below keywords in your messages to perform actions:
👤 *Profile:* setup, reset, profile
📚 *Subjects:* list, add [name], delete [name], rename [old] to [new]
🎨 *Categories:* list categories, add category [name]
🗓️ *Attendance:* present [name], absent, deemed, undo, stats
📋 *Tasks:* tasks, add task [title], done [number]
⏱️ *Timers:* start [name], stop

💡 *Tip:* You can just say "I attended Family Law I" or "Add piano in category Hobbies".
💻 Explore more features on the *Dashboard:* ${WEBSITE_URL}`,
    profileHeader: `👤 *Your Profile*\n\n`,
    profileName: (name) => `*User Name:* ${name}\n`,
    profilePersonal: `*Personal subjects Tracking:* Active\n`,
    profileAcademic: `*Academic subjects Tracking:* Active\n`,
    profileTarget: (pct) => `*Target Attendance:* ${pct}%\n`,
    profileUniversity: (uni) => `*University:* ${uni}\n`,
    profileProgram: (prog) => `*Program:* ${prog}\n`,
    profileSemester: (sem) => `*Semester:* ${sem}\n`,
    profileFooter: `\nIf you ever need to change any of this, just say *"setup"*!`,
    unknown: `Hmm, I'm not sure I understood that correctly. 🤔\n\nYou can say *"help"* to see some of the things you can ask me!`,
    error: `❌ Something went wrong. Please try again.\n\nIf this keeps happening, use  ${WEBSITE_URL} to complete the task.`,
  }
};

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
const userCache = new Map(); // profile caching to reduce DB hits
const processedMessages = new Map(); // msgId -> timestamp for TTL deduplication
const SESSION_TTL = 60 * 60 * 1000; // 1 hour
const MESSAGE_DEDUPE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

setInterval(() => {
  const now = Date.now();
  // Clean old sessions
  for (const [k, s] of sessions) {
    if (now - s.lastActivity > SESSION_TTL) sessions.delete(k);
  }
  // Clean old processed message IDs
  for (const [mid, ts] of processedMessages) {
    if (now - ts > MESSAGE_DEDUPE_TTL) processedMessages.delete(mid);
  }
  // Clean old user profile cache
  for (const [phone, entry] of userCache) {
    if (now - entry.timestamp > USER_CACHE_TTL) userCache.delete(phone);
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
  const now = Date.now();
  if (userCache.has(phone)) {
    const entry = userCache.get(phone);
    if (now - entry.timestamp < USER_CACHE_TTL) {
      console.log(`⚡ Profile Cache Hit: ${phone}`);
      return entry.data;
    }
  }

  console.log(`\n👤 DB Profile Fetch: ${phone}`);

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', phone)
    .maybeSingle();

  if (existing) {
    userCache.set(phone, { data: existing, timestamp: now });
    console.log('✅ Existing user:', existing.display_name);
    return existing;
  }

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('❌ Fetch user error:', fetchErr);
    throw fetchErr;
  }

  console.log('🆕 Creating new user...');

  const { data: newUser, error: createErr } = await supabaseAdmin
    .from('profiles')
    .insert([{
      whatsapp_number: phone,
      display_name: PLACEHOLDER_NAME,
      timezone: 'Asia/Kolkata',
      academics_enabled: false,
      personal_enabled: false,
    }])
    .select()
    .single();

  if (createErr) {
    console.error('❌ Create user error:', createErr);
    throw createErr;
  }

  userCache.set(phone, { data: newUser, timestamp: now });
  console.log('✅ New user created:', newUser.id);
  return newUser;
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

  // Clear cache on update to avoid stale data
  userCache.delete(phone);
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

// Onboarding logic extracted to setup.js

// ============================================================================
// CATEGORY HANDLERS  (all via user JWT client — RLS enforced)
// ============================================================================

async function handleAddCategory(user, categoryName) {
  if (!categoryName) return MESSAGES.categories.prompt;

  const uc = getUserClient(user.whatsapp_number);

  // Case-insensitive duplicate check
  const { data: dup } = await uc
    .from('subject_categories')
    .select('name')
    .eq('profile_id', user.id)
    .ilike('name', categoryName)
    .maybeSingle();

  if (dup) {
    return MESSAGES.categories.duplicate(dup.name);
  }

  const { data: created, error } = await uc
    .from('subject_categories')
    .insert([{ profile_id: user.id, name: categoryName, color_hex: '#6366f1', is_default: false }])
    .select()
    .single();

  if (error) {
    console.error('❌ addCategory:', error);
    return MESSAGES.categories.error;
  }

  return MESSAGES.categories.success(created.name);
}

async function handleListCategories(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: cats, error } = await uc
    .from('subject_categories')
    .select('name')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true });

  if (error || !cats || cats.length === 0) {
    return MESSAGES.categories.empty;
  }

  let msg = MESSAGES.categories.listHeader(cats.length);
  cats.forEach((c, i) => { msg += `${i + 1}. ${c.name}\n`; });
  return msg;
}

async function handleDeleteCategory(user, categoryName) {
  if (!categoryName) return MESSAGES.categories.deletePrompt;

  const uc = getUserClient(user.whatsapp_number);

  const { data: cat } = await uc
    .from('subject_categories')
    .select('id, name')
    .eq('profile_id', user.id)
    .ilike('name', categoryName)
    .maybeSingle();

  if (!cat) {
    return MESSAGES.categories.notFound(categoryName);
  }

  const { count } = await uc
    .from('subjects')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', cat.id)
    .eq('is_active', true);

  if (count > 0) {
    return MESSAGES.categories.inUse(cat.name, count);
  }

  const { error } = await uc
    .from('subject_categories')
    .delete()
    .eq('id', cat.id);

  if (error) {
    console.error('❌ deleteCategory:', error);
    return MESSAGES.categories.deleteError;
  }

  return MESSAGES.categories.deleteSuccess(cat.name);
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
async function createSubject(user, subjectName, type, total = null, missed = 0, attended = 0, categoryName = null) {
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
    return MESSAGES.subjects.duplicate(dup.name, dup.type);
  }

  // ── Academic subject ──────────────────────────────────────────────────────
  if (type === 'academic') {
    if (!user.current_semester_id) {
      return MESSAGES.subjects.setupNeeded;
    }

    let courseId;
    try {
      courseId = await findOrCreateAcademicCourse(uc, user.current_semester_id, subjectName.trim());
    } catch {
      return MESSAGES.subjects.error;
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
      return MESSAGES.subjects.addError(subjectName.trim());
    }

    return MESSAGES.subjects.academicSuccess(subject.name);
  }

  // ── Personal subject ──────────────────────────────────────────────────────
  let categoryId = null;

  if (categoryName) {
    // Try to find the category first
    const { data: cat } = await uc
      .from('subject_categories')
      .select('id')
      .eq('profile_id', user.id)
      .ilike('name', categoryName.trim())
      .maybeSingle();

    if (cat) {
      categoryId = cat.id;
    } else {
      // Auto-create category if explicitly requested but doesn't exist
      const { data: newCat, error: catErr } = await uc
        .from('subject_categories')
        .insert([{ profile_id: user.id, name: categoryName.trim(), color_hex: '#6366f1', is_default: false }])
        .select()
        .single();

      if (!catErr) {
        categoryId = newCat.id;
      }
    }
  }

  // NOTE: If categoryId is still null here, the subject will be Uncategorized.
  // We no longer fallback to a random default category.

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
    return MESSAGES.subjects.addError(subjectName.trim());
  }

  return MESSAGES.subjects.personalSuccess(subject.name);
}

/** Routes "add <name>, <type>" — resolves type intelligently. */
async function handleAddSubject(user, phone, rawText) {
  if (!rawText) return MESSAGES.subjects.addPrompt;

  // Robust check for "in/to category" outside of NLP
  const catMatch = rawText.match(/(?:to|in|under|into)\s+(?:the\s+)?(?:category|cat)\s+(.+)$/i);
  let manualCategory = null;
  let textToProcess = rawText;
  if (catMatch) {
    manualCategory = catMatch[1].trim();
    textToProcess = rawText.replace(/(?:to|in|under|into)\s+(?:the\s+)?(?:category|cat)\s+(.+)$/i, '').trim();
  }

  // smartRyuma returns "[Name], [Type], [Category]"
  const parts = textToProcess.split(',').map(s => s.trim()).filter(Boolean);

  if (parts.length === 1) {
    const name = parts[0];
    const type = user.personal_enabled && !user.academics_enabled ? 'personal' : 'academic';
    return await createSubject(user, name, type, null, 0, 0, manualCategory);
  }

  const responses = [];
  let i = 0;
  while (i < parts.length) {
    let name = parts[i];
    let typeVal = parts[i + 1]?.toLowerCase();
    let type = 'academic';
    let consumed = 1;

    if (['1', '2', 'academic', 'personal'].includes(typeVal)) {
      type = (typeVal === '1' || typeVal === 'academic') ? 'academic' : 'personal';
      consumed = 2;
    } else {
      type = user.academics_enabled ? 'academic' : 'personal';
    }

    let category = manualCategory || null;
    if (type === 'personal' && !category) {
      const nextPart = parts[i + consumed];
      if (nextPart && isNaN(nextPart)) {
        category = nextPart;
        consumed++;
      }
    }

    let total = null, missed = 0, attended = 0;
    if (i + consumed < parts.length && !isNaN(parts[i + consumed])) {
      total = parseInt(parts[i + consumed], 10);
      consumed++;
      if (i + consumed < parts.length && !isNaN(parts[i + consumed])) {
        missed = parseInt(parts[i + consumed], 10);
        consumed++;
        if (i + consumed < parts.length && !isNaN(parts[i + consumed])) {
          attended = parseInt(parts[i + consumed], 10);
          consumed++;
        }
      }
    }

    const res = await createSubject(user, name, type, total, missed, attended, category);
    responses.push(res);
    i += consumed;
  }

  return responses.join('\n\n');
}

async function handleListSubjects(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects, error } = await uc
    .from('subjects')
    .select('name, type, category_id, subject_categories(name), source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !subjects || subjects.length === 0) {
    return MESSAGES.subjects.empty;
  }

  // Hierarchical and Track Filter
  const filteredSubjects = subjects.filter(s => {
    // 1. Strict track filtering
    if (s.type === 'academic' && !user.academics_enabled) return false;
    if (s.type === 'personal' && !user.personal_enabled) return false;

    // 2. Semester filtering for Academic
    if (s.type === 'academic') {
      const semesterId = Array.isArray(s.source_course_id)
        ? s.source_course_id[0]?.semester_id
        : s.source_course_id?.semester_id;
      return semesterId === user.current_semester_id;
    }

    return true; // Personal subjects always shown if personal_enabled
  });

  if (filteredSubjects.length === 0) {
    return MESSAGES.subjects.emptySemester;
  }

  const academic = filteredSubjects.filter(s => s.type === 'academic');
  const personal = filteredSubjects.filter(s => s.type === 'personal');
  let msg = MESSAGES.subjects.listHeader;

  if (academic.length) {
    msg += MESSAGES.subjects.listAcademic;
    academic.forEach((s, i) => { msg += `  ${i + 1}. ${s.name} \n`; });
  }

  if (personal.length) {
    msg += MESSAGES.subjects.listPersonal;

    // Group personal by category
    const grouped = {};
    personal.forEach(s => {
      const catName = s.subject_categories?.name || 'Uncategorized';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(s.name);
    });

    for (const [catName, subList] of Object.entries(grouped)) {
      msg += `\n📂 *${catName}*\n`;
      subList.forEach((name) => {
        msg += `  - ${name}\n`;
      });
    }
  }

  msg += MESSAGES.subjects.listFooter(filteredSubjects.length, filteredSubjects.length !== 1);
  return msg;
}

// ============================================================================
// ATTENDANCE HANDLERS
// ============================================================================

/** Logs one attendance record then returns the updated summary. */
async function logAttendance(user, subjectName, status) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: rawSubjects } = await uc
    .from('subjects')
    .select('id, name, type, expected_total_lectures, legacy_missed_lectures, legacy_attended_lectures, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName.trim()}%`);

  if (!rawSubjects || rawSubjects.length === 0) {
    return null; // Signal not matching for fallback splitting
  }

  // Hierarchical Filter
  let subjects = rawSubjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (subjects.length === 0) return MESSAGES.attendance.wrongContext(subjectName.trim());

  // Ambiguity Handling
  let subject = subjects[0];
  if (subjects.length > 1) {
    const exactMatch = subjects.find(s => s.name.toLowerCase() === subjectName.trim().toLowerCase());
    if (exactMatch) {
      subject = exactMatch;
    } else {
      const options = subjects.map((s, idx) => `${idx + 1}. ${s.name}`).join('\n');
      return MESSAGES.subjects.ambiguity(subjectName.trim(), options);
    }
  }

  if (subject.type !== 'academic') return MESSAGES.attendance.academicOnly(subject.name);

  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await uc.from('attendance_logs').select('status').eq('profile_id', user.id).eq('subject_id', subject.id).eq('lecture_date', today).maybeSingle();

  let warningPrefix = "";
  if (existing) {
    warningPrefix = "⚠️ *Note:* You already marked attendance for today. I've added this as a second slot for you. \n\n";
  }

  const { error } = await uc.from('attendance_logs').insert([{ profile_id: user.id, subject_id: subject.id, lecture_date: today, status }]);
  if (error) return MESSAGES.attendance.error(subject.name);

  const statusPrefix = status === 'present' ? MESSAGES.attendance.presentPrefix(subject.name) : status === 'absent' ? MESSAGES.attendance.absentPrefix(subject.name) : MESSAGES.attendance.deemedPrefix(subject.name);
  const prefix = warningPrefix + statusPrefix;
  return await buildAttendanceSummary(uc, user, subject, prefix);
}

/** Builds the "Subject: 5/7 (71.4%)" line. */
async function buildAttendanceSummary(uc, user, subject, prefix = '', preFetchedLogs = null) {
  const logs = preFetchedLogs || (await (async () => {
    const { data } = await uc.from('attendance_logs').select('status').eq('profile_id', user.id).eq('subject_id', subject.id);
    return data;
  })());

  const actualPresent = logs ? logs.filter(l => l.status === 'present').length : 0;
  const actualAbsent = logs ? logs.filter(l => l.status === 'absent').length : 0;
  const actualDeemed = logs ? logs.filter(l => l.status === 'deemed').length : 0;

  const totalPresent = actualPresent + (subject.legacy_attended_lectures || 0);
  const totalAbsent = actualAbsent + (subject.legacy_missed_lectures || 0);
  const totalCounted = totalPresent + totalAbsent + actualDeemed;

  if (totalCounted === 0) return MESSAGES.attendance.summaryNoData(subject.name);
  const pct = ((totalPresent + actualDeemed) / totalCounted) * 100;
  const targetPct = user.target_attendance_pct || 75;
  const emoji = pct >= targetPct ? '✅' : pct >= (targetPct - 15) ? '⚠️' : '🔴';

  let msg = prefix + MESSAGES.attendance.summaryLine(emoji, subject.name, totalPresent, totalCounted, pct.toFixed(1));
  if (actualDeemed > 0) msg += MESSAGES.attendance.deemedNote(actualDeemed);

  // Stats Logic
  if (subject.expected_total_lectures > 0) {
    const totalSemLectures = subject.expected_total_lectures;
    const maxAllowedMisses = Math.floor(totalSemLectures * (1 - (targetPct / 100)));
    const netAbsent = totalAbsent - actualDeemed;
    const bunksLeft = maxAllowedMisses - netAbsent;
    if (bunksLeft >= 0) msg += MESSAGES.attendance.bunksLeft(bunksLeft, bunksLeft !== 1);
    else {
      const t = targetPct / 100;
      const x = Math.ceil((t * totalCounted - (totalPresent + actualDeemed)) / (1 - t));
      msg += MESSAGES.attendance.trackWarning(x, x !== 1);
    }
  } else if (pct < targetPct) {
    const t = targetPct / 100;
    const x = Math.ceil((t * totalCounted - (totalPresent + actualDeemed)) / (1 - t));
    if (x > 0) msg += MESSAGES.attendance.onTrackTip(x, x !== 1, targetPct);
  }
  return msg;
}

async function handleAttended(user, rawText) {
  if (!rawText) return MESSAGES.attendance.attendedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);

  const promises = items.map(async (item) => {
    let res = await logAttendance(user, item, 'present');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subResPromises = parts.map(p => logAttendance(user, p, 'present'));
      const subResArray = await Promise.all(subResPromises);
      const subs = subResArray.filter(Boolean);
      return subs.length ? subs.join('\n\n') : MESSAGES.attendance.notFound(item);
    }
    return res || MESSAGES.attendance.notFound(item);
  });

  const results = await Promise.all(promises);
  return results.join('\n\n');
}

async function handleMissed(user, rawText) {
  if (!rawText) return MESSAGES.attendance.missedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);

  const promises = items.map(async (item) => {
    let res = await logAttendance(user, item, 'absent');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subResPromises = parts.map(p => logAttendance(user, p, 'absent'));
      const subResArray = await Promise.all(subResPromises);
      const subs = subResArray.filter(Boolean);
      return subs.length ? subs.join('\n\n') : MESSAGES.attendance.notFound(item);
    }
    return res || MESSAGES.attendance.notFound(item);
  });

  const results = await Promise.all(promises);
  return results.join('\n\n');
}

async function handleDeemed(user, rawText) {
  if (!rawText) return MESSAGES.attendance.deemedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);

  const promises = items.map(async (item) => {
    let res = await logAttendance(user, item, 'deemed');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subResPromises = parts.map(p => logAttendance(user, p, 'deemed'));
      const subResArray = await Promise.all(subResPromises);
      const subs = subResArray.filter(Boolean);
      return subs.length ? subs.join('\n\n') : MESSAGES.attendance.notFound(item);
    }
    return res || MESSAGES.attendance.notFound(item);
  });

  const results = await Promise.all(promises);
  return results.join('\n\n');
}

async function handleUndoAttendance(user, subjectName) {
  if (!subjectName) return MESSAGES.attendance.undoPrompt;
  const uc = getUserClient(user.whatsapp_number);
  const today = new Date().toISOString().split('T')[0];
  const { data: subjects } = await uc.from('subjects').select('id, name, type, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).ilike('name', `%${subjectName.trim()}%`);
  if (!subjects || subjects.length === 0) return MESSAGES.attendance.notFound(subjectName.trim());

  const valid = subjects.filter(s => s.type === 'personal' || (s.source_course_id?.semester_id === user.current_semester_id));
  if (valid.length === 0) return MESSAGES.attendance.wrongContext(subjectName.trim());

  await uc.from('attendance_logs').delete().eq('profile_id', user.id).eq('subject_id', valid[0].id).eq('lecture_date', today);
  return await buildAttendanceSummary(uc, user, valid[0], MESSAGES.attendance.undoSuccess(valid[0].name) + '\n\n');
}

async function handleStats(user) {
  if (!user.academics_enabled) return MESSAGES.stats.academicOnly;
  const uc = getUserClient(user.whatsapp_number);
  const { data: subjects } = await uc.from('subjects').select('id, name, expected_total_lectures, legacy_missed_lectures, legacy_attended_lectures, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).eq('type', 'academic');
  const filtered = subjects?.filter(s => Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id) || [];
  if (filtered.length === 0) return MESSAGES.stats.noSubjects;

  // Optimized: Fetch all logs for all filtered subjects in one query
  const subjectIds = filtered.map(s => s.id);
  const { data: allLogs } = await uc.from('attendance_logs').select('subject_id, status').eq('profile_id', user.id).in('subject_id', subjectIds);

  let msg = MESSAGES.stats.header(user.target_attendance_pct || 75);
  let hasData = false;
  for (const s of filtered) {
    const subjectLogs = allLogs ? allLogs.filter(l => l.subject_id === s.id) : [];
    const sum = await buildAttendanceSummary(uc, user, s, '', subjectLogs);
    if (!sum.includes('0 classes so far.')) { hasData = true; msg += sum + '\n\n'; }
    else msg += `${MESSAGES.stats.noDataEmoji} *${s.name}*: ${MESSAGES.stats.noDataNote}\n\n`;
  }
  return hasData ? msg.trim() : MESSAGES.stats.empty;
}

// ============================================================================
// STUDY TIMERS
// ============================================================================

async function handleStartTimer(user, subjectName) {
  if (!subjectName) return MESSAGES.timers.startPrompt;
  const uc = getUserClient(user.whatsapp_number);
  const { data: running } = await uc.from('study_timers').select('id, subjects(name)').eq('profile_id', user.id).is('ended_at', null).maybeSingle();
  if (running) return MESSAGES.timers.alreadyRunning(running.subjects?.name);

  const { data: subjects } = await uc.from('subjects').select('id, name, type, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).ilike('name', `%${subjectName.trim()}%`);
  if (!subjects || subjects.length === 0) return MESSAGES.timers.notFound(subjectName.trim());
  const valid = subjects.filter(s => s.type === 'personal' || (s.source_course_id?.semester_id === user.current_semester_id));
  if (valid.length === 0) return MESSAGES.timers.wrongContext(subjectName.trim());

  await uc.from('study_timers').insert([{ profile_id: user.id, subject_id: valid[0].id, started_at: new Date().toISOString() }]);
  return MESSAGES.timers.started(valid[0].name);
}

async function handleStopTimer(user) {
  const uc = getUserClient(user.whatsapp_number);
  const { data: running } = await uc.from('study_timers').select('id, started_at, subjects(name)').eq('profile_id', user.id).is('ended_at', null).maybeSingle();
  if (!running) return MESSAGES.timers.noActive;

  const endedAt = new Date();
  const diffMs = endedAt - new Date(running.started_at);
  const totalMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMins / 60), mins = totalMins % 60;
  await uc.from('study_timers').update({ ended_at: endedAt.toISOString() }).eq('id', running.id);
  return MESSAGES.timers.stopped(running.subjects?.name, hrs, mins);
}

// ============================================================================
// TASKS
// ============================================================================

async function handleAddTask(user, rawText) {
  if (!rawText) return MESSAGES.tasks.addPrompt;
  let title = rawText.trim(), dueDate = null, subjectId = null;

  // 1. Extract Due Date
  const dueMatch = title.match(/due\s+(on\s+)?([\w\s,]+)/i);
  if (dueMatch) {
    title = title.replace(dueMatch[0], '').trim();
    const d = new Date(dueMatch[2]);
    if (!isNaN(d)) dueDate = d.toISOString();
  }

  // 2. Try to link to a subject proactively
  const uc = getUserClient(user.whatsapp_number);
  const { data: subjects } = await uc.from('subjects').select('id, name').eq('profile_id', user.id).eq('is_active', true);

  if (subjects) {
    for (const s of subjects) {
      if (title.toLowerCase().includes(s.name.toLowerCase())) {
        subjectId = s.id;
        break;
      }
    }
  }

  // 3. Insert Task
  const { data: task, error } = await uc.from('tasks').insert([{
    profile_id: user.id,
    subject_id: subjectId,
    title,
    is_completed: false,
    priority: 'medium',
    due_date: dueDate
  }]).select().single();

  if (error) {
    console.error('❌ addTask:', error);
    return MESSAGES.tasks.addError;
  }
  const dueStr = task.due_date ? MESSAGES.tasks.dueNote(new Date(task.due_date).toLocaleDateString('en-IN')) : '';
  return MESSAGES.tasks.addSuccess(task.title, dueStr);
}

async function handleCompleteTask(user, numberStr) {
  const idx = parseInt(numberStr, 10) - 1;
  const uc = getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('tasks').select('id, title, subject_id, subjects(type, source_course_id(semester_id))').eq('profile_id', user.id).eq('is_completed', false).order('due_date', { ascending: true, nullsFirst: false });

  const tasks = raw?.filter(t => {
    if (!t.subject_id) return user.academics_enabled || user.personal_enabled;
    if (t.subjects?.type === 'academic' && !user.academics_enabled) return false;
    if (t.subjects?.type === 'personal' && !user.personal_enabled) return false;
    if (t.subjects?.type === 'academic') {
      return t.subjects.source_course_id?.semester_id === user.current_semester_id;
    }
    return true;
  }) || [];

  if (idx < 0 || idx >= tasks.length) return MESSAGES.tasks.notFound(idx + 1, tasks.length);

  await uc.from('tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', tasks[idx].id);
  return MESSAGES.tasks.doneSuccess(tasks[idx].title);
}

async function handleListTasks(user) {
  const uc = getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('tasks').select('title, priority, due_date, subject_id, subjects(type, source_course_id(semester_id))').eq('profile_id', user.id).eq('is_completed', false).order('due_date', { ascending: true, nullsFirst: false });

  if (!raw || raw.length === 0) return MESSAGES.tasks.listCaughtUp;

  const tasks = raw.filter(t => {
    // Global tasks (no subject)
    if (!t.subject_id) return user.academics_enabled || user.personal_enabled;

    // Subject-linked tasks
    if (t.subjects?.type === 'academic' && !user.academics_enabled) return false;
    if (t.subjects?.type === 'personal' && !user.personal_enabled) return false;

    // Academic semester filter
    if (t.subjects?.type === 'academic') {
      return t.subjects.source_course_id?.semester_id === user.current_semester_id;
    }

    return true;
  });

  if (tasks.length === 0) return MESSAGES.tasks.empty;

  let msg = MESSAGES.tasks.listHeader(tasks.length);
  tasks.forEach((t, i) => {
    const p = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority] || '🟡';
    msg += `${i + 1}. ${p} ${t.title}${t.due_date ? MESSAGES.tasks.dueNote(new Date(t.due_date).toLocaleDateString('en-IN')) : ''}\n`;
  });
  return msg + MESSAGES.tasks.listFooter(tasks.length, tasks.length !== 1);
}

async function handleRenameSubject(user, text) {
  // rename subject Old, New
  const parts = text.split(',').map(s => s.trim());
  if (parts.length < 2) return MESSAGES.subjects.renamePrompt;

  const [oldName, newName] = parts;
  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', oldName);

  if (!subjects || subjects.length === 0) return MESSAGES.subjects.notFound(oldName);

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

  if (error) return MESSAGES.subjects.renameError;
  return MESSAGES.subjects.renameSuccess(subject.name, newName);
}

async function handleDeleteSubject(user, subjectName) {
  if (!subjectName) return MESSAGES.subjects.deletePrompt;

  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .ilike('name', subjectName.trim())
    .eq('is_active', true);

  if (!subjects || subjects.length === 0) {
    return MESSAGES.subjects.notFound(subjectName.trim());
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
    return MESSAGES.subjects.wrongContext(subjectName.trim());
  }

  const subject = validSubjects[0];

  // Soft-delete — preserves attendance logs, timers, etc. BUT "unenrolls" user
  // User requested: "only delete user's subject specific data and removing user from it, not the entire subject"
  // Setting is_active: false on the 'subjects' table row (user instance) does exactly this.
  const { error } = await uc
    .from('subjects')
    .update({ is_active: false })
    .eq('id', subject.id);

  if (error) {
    console.error('❌ deleteSubject:', error);
    return MESSAGES.subjects.deleteError;
  }

  return MESSAGES.subjects.deleteSuccess(subject.name);
}

/** Marks all active academic subjects with given status (present/absent/deemed) */
async function handleMarkAll(user, status) {
  const uc = getUserClient(user.whatsapp_number);
  const { data: activeSubjects } = await uc
    .from('subjects')
    .select('id, name')
    .eq('profile_id', user.id)
    .eq('type', 'academic')
    .eq('is_active', true);

  if (!activeSubjects || activeSubjects.length === 0) return MESSAGES.stats.noSubjects;

  const today = new Date().toISOString().split('T')[0];
  let count = 0;
  for (const s of activeSubjects) {
    // Check for existing log to avoid UPSERT conflict or duplicates if status is different
    const { data: existing } = await uc.from('attendance_logs').select('id').eq('profile_id', user.id).eq('subject_id', s.id).eq('lecture_date', today).maybeSingle();
    if (!existing) {
      await uc.from('attendance_logs').insert([{ profile_id: user.id, subject_id: s.id, lecture_date: today, status }]);
      count++;
    }
  }

  return MESSAGES.attendance.allSuccess(status, count);
}

/** Removes all attendance logs for today */
async function handleUndoAll(user) {
  const uc = getUserClient(user.whatsapp_number);
  const today = new Date().toISOString().split('T')[0];
  const { error } = await uc.from('attendance_logs').delete().eq('profile_id', user.id).eq('lecture_date', today);
  if (error) return MESSAGES.attendance.undoError;
  return MESSAGES.attendance.undoAllSuccess;
}

/** Updates subject lectures (total or legacy_missed) from NL */
async function handleSetupLectures(user, text) {
  // "total <Subject>, <val>" or "missed <Subject>, <val>"
  const type = text.startsWith('total') ? 'total' : 'missed';
  const parts = text.replace(/^(total|missed)\s+/i, '').split(',');
  if (parts.length < 2) return MESSAGES.general.unknown;

  const subjectName = parts[0].trim();
  const val = parseInt(parts[1].trim(), 10);
  if (isNaN(val)) return MESSAGES.general.unknown;

  const uc = getUserClient(user.whatsapp_number);
  const { data: subjects } = await uc.from('subjects').select('id, name').eq('profile_id', user.id).ilike('name', subjectName).eq('is_active', true);
  if (!subjects || subjects.length === 0) return MESSAGES.subjects.notFound(subjectName);

  const col = type === 'total' ? 'expected_total_lectures' : 'legacy_missed_lectures';
  const { error } = await uc.from('subjects').update({ [col]: val }).eq('id', subjects[0].id);
  if (error) return MESSAGES.subjects.error;

  return MESSAGES.subjects.setupLecturesSuccess(subjects[0].name, type, val);
}

async function handleExport(user) {
  return MESSAGES.general.export;
}

// ============================================================================
// HELP — contextual based on enabled tracks
// ============================================================================

function handleHelp(user) {
  if (user.academics_enabled && user.personal_enabled) return MESSAGES.general.helpBoth;
  if (user.personal_enabled) return MESSAGES.general.helpPersonal;
  return MESSAGES.general.help;
}

// ============================================================================
// PROFILE HANDLER
// ============================================================================

async function handleProfile(user) {
  const uc = getUserClient(user.whatsapp_number);
  let msg = MESSAGES.general.profileHeader;
  msg += MESSAGES.general.profileName(user.display_name);

  if (user.personal_enabled) msg += MESSAGES.general.profilePersonal;

  if (user.academics_enabled) {
    msg += MESSAGES.general.profileAcademic;
    msg += MESSAGES.general.profileTarget(user.target_attendance_pct || 75);

    // Fetch university/program/semester details
    if (user.current_university_id) {
      const { data: uni } = await uc.from('universities').select('name').eq('id', user.current_university_id).maybeSingle();
      if (uni) msg += MESSAGES.general.profileUniversity(uni.name);
    }
    if (user.current_program_id) {
      const { data: prog } = await uc.from('programs').select('name').eq('id', user.current_program_id).maybeSingle();
      if (prog) msg += MESSAGES.general.profileProgram(prog.name);
    }
    if (user.current_semester_id) {
      const { data: sem } = await uc.from('semesters').select('name, semester_number').eq('id', user.current_semester_id).maybeSingle();
      if (sem) msg += MESSAGES.general.profileSemester(sem.name || `Semester ${sem.semester_number}`);
    }
  }

  msg += MESSAGES.general.profileFooter;
  return msg;
}

// ============================================================================
// MAIN MESSAGE PROCESSOR
// ============================================================================

async function processMessage(phone, text) {
  const startTime = Date.now();
  try {
    const user = await getOrCreateUser(phone);
    const authTime = Date.now();

    const lower = text.trim().toLowerCase();
    const session = getSession(phone);
    const deps = { getUserClient, getOrCreateUser, updateProfile, createSubject, seedDefaultCategories, setSession, clearSession, WEBSITE_URL };

    if (lower === 'setup' || lower === 'reset') {
      await updateProfile(phone, { display_name: PLACEHOLDER_NAME });
      clearSession(phone);
      return startOnboarding(phone, deps);
    }

    let reply;
    if (session) {
      if (lower === 'cancel' || lower === 'stop') {
        clearSession(phone);
        return `Onboarding cancelled. Let me know when you're ready to start by typing "setup"!`;
      }
      touchSession(phone);
      reply = await handleOnboarding(user, session, text.trim(), deps);
      if (reply) return reply;
    }

    if (needsOnboarding(user)) return startOnboarding(phone, deps);

    // Profile & Help Match
    if (lower === 'profile') reply = await handleProfile(user);
    else if (['hi', 'hello', 'hey', 'help', '?', 'start'].includes(lower) && !lower.startsWith('start ')) reply = handleHelp(user);

    // Command Routing
    // Specific Commands (Priority)
    else if (lower.startsWith('add task ')) reply = await handleAddTask(user, text.substring(9).trim());
    else if (lower.startsWith('done ')) reply = await handleCompleteTask(user, text.substring(5).trim());
    else if (lower === 'tasks' || lower === 'task') reply = await handleListTasks(user);
    else if (lower.startsWith('add category ')) reply = await handleAddCategory(user, text.substring(13).trim());
    else if (lower.startsWith('delete category ')) reply = await handleDeleteCategory(user, text.substring(16).trim());
    else if (lower === 'categories' || lower === 'category' || lower === 'list categories' || lower === 'list category') reply = await handleListCategories(user);

    // General & Fallback Commands
    else if (lower.startsWith('add subject ')) reply = await handleAddSubject(user, phone, text.substring(12).trim());
    else if (lower.startsWith('add ')) reply = await handleAddSubject(user, phone, text.substring(4).trim());
    else if (lower.startsWith('rename subject ')) reply = await handleRenameSubject(user, text.substring(15).trim());
    else if (lower.startsWith('delete subject ')) reply = await handleDeleteSubject(user, text.substring(15).trim());
    else if (['subjects', 'subject', 'list'].includes(lower)) reply = await handleListSubjects(user);
    else if (lower.startsWith('setup total ')) reply = await handleSetupLectures(user, text.substring(12).trim());
    else if (lower.startsWith('setup missed ')) reply = await handleSetupLectures(user, text.substring(13).trim());
    else if (lower.startsWith('start ')) reply = await handleStartTimer(user, text.substring(6).trim());
    else if (lower === 'stop') reply = await handleStopTimer(user);
    else if (lower === 'present all') reply = await handleMarkAll(user, 'present');
    else if (lower === 'absent all') reply = await handleMarkAll(user, 'absent');
    else if (lower === 'deemed all') reply = await handleMarkAll(user, 'deemed');
    else if (lower === 'undo all') reply = await handleUndoAll(user);
    else if (lower.startsWith('attended ')) reply = await handleAttended(user, text.substring(9).trim());
    else if (lower.startsWith('missed ')) reply = await handleMissed(user, text.substring(7).trim());
    else if (lower.startsWith('deemed ')) reply = await handleDeemed(user, text.substring(7).trim());
    else if (lower.startsWith('undo ')) reply = await handleUndoAttendance(user, text.substring(5).trim());
    else if (lower === 'stats' || lower === 'attendance') reply = await handleStats(user);

    // NLP Fallback
    if (!reply) {
      const parseStart = Date.now();
      const inferred = await parseIntent(text);
      if (inferred && inferred !== lower) {
        console.log(`💡 AI Intent: "${text}" -> "${inferred}" (${Date.now() - parseStart}ms)`);
        reply = await processMessage(phone, inferred);
      }
    }

    const finalReply = reply || MESSAGES.general.unknown;
    console.log(`⏱️ Total Time: ${Date.now() - startTime}ms (Auth: ${authTime - startTime}ms)`);
    return finalReply;

  } catch (err) {
    console.error('❌ processMessage error:', err);
    return MESSAGES.general.error;
  }
}

// ============================================================================
// WHATSAPP — SEND MESSAGE
// ============================================================================

async function sendMessage(to, body) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
  console.log(`📤 Sending to ${to}`);

  const payload = {
    messaging_product: 'whatsapp',
    to,
  };

  if (typeof body === 'object') {
    payload.type = 'interactive';
    payload.interactive = body;
  } else {
    payload.type = 'text';
    payload.text = { body };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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
  const webhookArrival = Date.now();
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages;

  // 1. Immediate acknowledgement for WhatsApp
  res.status(200).send('EVENT_RECEIVED');

  if (messages && messages.length > 0) {
    const message = messages[0];
    const from = message.from;
    const msgId = message.id;

    // 2. Deduplication check (TTL-map based)
    if (processedMessages.has(msgId)) {
      console.log(`♻️  Duplicate message ${msgId} ignored`);
      return;
    }
    processedMessages.set(msgId, webhookArrival);

    try {
      let text = message.text?.body;
      if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') text = interactive.button_reply.id;
        else if (interactive.type === 'list_reply') text = interactive.list_reply.id;
      }

      if (text) {
        console.log(`\n📨 Webhook Arrived: ${new Date(webhookArrival).toLocaleTimeString()}`);
        const phone = from.startsWith('+') ? from : `+${from}`;
        const reply = await processMessage(phone, text);
        const replyDone = Date.now();
        await sendMessage(from, reply);
        console.log(`📦 WhatsApp Pipeline: ${Date.now() - webhookArrival}ms (Response generated in ${replyDone - webhookArrival}ms)`);
      }
    } catch (err) {
      console.error('❌ Webhook processing error:', err);
    }
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