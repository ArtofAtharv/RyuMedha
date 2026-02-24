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
  categories: {
    prompt: `I'd be happy to add a new category for you! Just let me know what to call it (e.g., "Professional Development").`,
    duplicate: (name) => `It looks like you already have a category named *"${name}"*! 📂`,
    error: `I'm sorry, I ran into a bit of trouble creating that category. Could you try again in a moment?`,
    success: (name) => `Got it! I've created the *"${name}"* category for you. 📂\n\nYou can start adding subjects to it whenever you're ready!`,
    empty: `It looks like you haven't created any categories yet. 📂\n\nWant to add one? Just tell me something like *"Add category Professional"*.`,
    listHeader: (count) => `📂 *Here are your current categories (${count}):*\n\n`,
    deletePrompt: `Please provide a category name.\nExample: * delete category Hobbies * `,
    notFound: (name) => `I couldn't find a category named *"${name}"* in your list. 📂`,
    inUse: (name, count) => `I can't delete *"${name}"* just yet because there are ${count} subject${count > 1 ? 's' : ''} still using it. 📂\n\nCould you please move or delete those subjects first ? `,
    deleteError: `I'm sorry, I couldn't delete that category.Please try again!`,
    deleteSuccess: (name) => `Done! I've removed the *"${name}"* category for you. 🗑️`,
  },
  subjects: {
    duplicate: (name, type) => `Wait, it looks like *"${name}"* is already in your list! (${type} subject) 📚`,
    setupNeeded: `It looks like your academic profile isn't fully set up yet. Could you please run *setup* first? 😊`,
    error: `I ran into an issue setting up that subject for you. Could you try again?`,
    academicSuccess: (name) => `Got it! I've added *"${name}"* to your academic list. 🎓`,
    addError: (name) => `I'm sorry, I couldn't add *${name}* right now.`,
    personalSuccess: (name) => `Got it! I've added *"${name}"* to your personal tracker. 💼`,
    addPrompt: `Please provide subject details.\nFormat: * add subject < name >, <type (1 = Academic, 2 = Personal) >, [total], [missed], [attended] *\nExample: * add subject Contract Law, 1, 60, 5, 20 * `,
    typeNeeded: `Please provide the subject type as well.\nFormat: * add subject < name >, < 1 or 2 >*\n(1 = Academic, 2 = Personal)`,
    invalidType: (name) => `❌ Invalid type for * ${name} *.Use 1(Academic) or 2(Personal).`,
    empty: `I don't see any subjects in your list yet. 📚\n\nWant to add one? Just say something like *"Add academic subject Law"* or *"Track personal subject Guitar"*!`,
    emptySemester: `I don't see any subjects for your current semester yet. 📖\n\nYou can add one by telling me the name and whether it's Academic or Personal.`,
    listHeader: `📚 * Your Subjects:*\n`,
    listAcademic: `\n🎓 * Academic:*\n`,
    listPersonal: `\n💼 * Personal:*\n`,
    listFooter: (count, plural) => `\nYou're currently tracking **${count}** subject${plural ? 's' : ''} in this semester scope. 🎓`,
    deletePrompt: `Please provide a subject name.\nExample: * delete subject Python * `,
    notFound: (name) => `I couldn't find a subject named *"${name}"* in your active list. 📚`,
    wrongContext: (name) => `I found *"${name}"*, but it doesn't seem to be in your current semester context. 📖`,
    deleteError: `I'm sorry, I couldn't remove that subject for now. Please try again!`,
    deleteSuccess: (name) => `Done! I've removed *"${name}"* from your active list. 🗑️\n\n_(Don't worry, your history is still safe for your stats)_`,
    renamePrompt: `Format: *rename subject <old>, <new>*\nExample: *rename subject Contract, Contract Law*`,
    renameSuccess: (oldName, newName) => `Consider it done! I've renamed *"${oldName}"* to *"${newName}"* across your profile. ✏️`,
    renameError: `I'm sorry, I couldn't rename that subject. Please ensure the new name is unique and try again!`,
    archiveSuccess: (count) => `📦 *Semester Archived!*\n\nI've soft-archived your **${count}** academic subjects and cleared your current semester setup. \n\nYour past attendance and grades are all safely stored! When you're ready to start your next semester, just tell me *"setup"* and we'll get you ready for the new classes. 🎓🚀`,
    archiveError: `I'm sorry, I couldn't archive your semester subjects right now. Please try again later!`,
  },
  attendance: {
    notFound: (name) => `I couldn't find a subject named *"${name}"* in your list. 📚`,
    wrongContext: (name) => `I found *"${name}"*, but it doesn't seem to be in your current semester context. 📖`,
    academicOnly: (name) => `I noticed *${name}* is a personal subject. I only track attendance for your academic classes! 🎓`,
    alreadyMarked: (name, status) => `You've already marked *${name}* as *${status}* for today! 😊`,
    error: (name) => `I'm sorry, I couldn't mark your attendance for *${name}* right now. Please try again!`,
    presentPrefix: (name) => `Great job! I've marked you present for *${name}*. 🎓\n\n`,
    absentPrefix: (name) => `Got it. I've marked you absent for *${name}*. ✍️\n\n`,
    deemedPrefix: (name) => `Cancelled class or holiday? No problem, I've marked *${name}* as deemed! 🏖️\n\n`,
    summaryNoData: (name) => `${name}: 0 classes so far.`,
    summaryLine: (emoji, name, attended, total, pct) => `${emoji} * ${name}*: ${attended}/${total} (${pct}%)`,
    deemedNote: (count) => ` _(incl. ${count} deemed)_`,
    bunksLeft: (count, plural) => `\n💡 You can still skip *${count}* class${plural ? 'es' : ''} and stay above your goal!`,
    onTrackTip: (count, plural, target) => `\n💡 You should attend the next **${count}** class${plural ? 'es' : ''} to reach your ${target}% goal.`,
    trackWarning: (count, plural) => `\n🚨 Warning: You need to attend the next **${count}** class${plural ? 'es' : ''} to get back on track!`,
    attendedPrompt: `Just let me know which subjects you attended today! 🎓\n\n(e.g., *"attended Math"* or *"present in Law"*)`,
    missedPrompt: `I hope everything is okay! Which class did you miss? ✍️\n\n(e.g., *"missed Economics"*) `,
    deemedPrompt: `If a class was cancelled or you were given a holiday, just let me know which ones! 🏖️\n\n(e.g., *"deemed Law"*)`,
    undoPrompt: `Please provide a subject name.\nExample: *undo Contract Law*`,
    undoError: `I'm sorry, I couldn't undo that for you right now.`,
    undoSuccessPrefix: (name) => `🔄 No problem, I've removed today's log for *${name}*.\n\n`,
    updateLegacyPrompt: (column) => `Format: *update ${column === 'legacy_missed_lectures' ? 'missed' : 'attended'} <subject>, <count>*\nExample: *update missed Math, 5*`,
    updateLegacyError: (name) => `I'm sorry, I couldn't update your history for *${name}*. Please try again.`,
    updateLegacySuccess: (name, count, column) => `Fixed! I've updated *${name}* to ${count} ${column === 'legacy_missed_lectures' ? 'missed' : 'attended'} classes in your history. ✍️`,
  },
  stats: {
    academicOnly: `I only track attendance stats for academic subjects! 📊\n\nYou have personal tracking enabled. Would you like to check your *subjects* list instead?`,
    noSubjects: `You haven't added any academic subjects for this semester yet! 📊🎓\n\nYou can add one by telling me something like *"Add subject Math"*!`,
    header: (target) => `📊 *Attendance Stats (Target: ${target}%):*\n\n`,
    noDataEmoji: `⬜`,
    noDataNote: `No data yet`,
    empty: `I don't have any attendance logs for your subjects yet! 📊\n\nTry telling me something like *"I was present in Math"* to get started.`,
  },
  timers: {
    startPrompt: `Please provide a subject name.\nExample: *start Contract Law*`,
    alreadyRunning: (name) => `⚠️ You already have an active timer for *${name || 'a subject'}*.\n\nPlease reply with *stop* before starting a new one.`,
    notFound: (name) => `❌ Subject *"${name}"* not found.\n\nView subjects: *subjects*`,
    wrongContext: (name) => `❌ Subject *"${name}"* exists but is not in your current semester context.`,
    startError: `I'm sorry, I couldn't start the timer. Could you try again?`,
    started: (name) => `⏱️ *Study session started for ${name}!*\n\nI'll keep track of the time for you. Just tell me *"stop"* or *"done studying"* when you're finished! 💪`,
    noActive: `ℹ️ You don't have an active timer.`,
    stopError: `I'm sorry, I couldn't stop the timer. Could you try again?`,
    stopped: (name, hrs, mins) => `⏹️ *Great focus!* You've finished your session for *${name || 'Subject'}*.\n\n⏱️ Duration: **${hrs}h ${mins}m**\nI've saved this to your study history. Take a well-deserved break! 💪✨`,
  },
  tasks: {
    addPrompt: `Please provide a task title.\nFormat: *add task <title> [due <YYYY-MM-DD>]*\nExample: *add task Submit assignment due 2026-03-10*`,
    addError: `I'm sorry, I couldn't add that task for you right now.`,
    addSuccess: (title, dueStr) => `Consider it done! I've added *"${title}"*${dueStr} to your list. ✅`,
    dueNote: (date) => ` (due ${date})`,
    donePrompt: `Please provide a valid task number.\nExample: *done 1*`,
    empty: `You don't have any pending tasks right now! 📋`,
    notFound: (id, count) => `I couldn't find task #${id} in your list. You have ${count} task(s) pending.`,
    doneError: `I'm sorry, I couldn't mark that task as finished.`,
    doneSuccess: (title) => `Nice work! I've checked off *"${title}"* for you. 🎉💪`,
    listCaughtUp: `You're all caught up! You have no pending tasks right now. 📋✨`,
    listHeader: (count) => `📋 *Pending Tasks (${count}):*\n\n`,
    listFooter: (count, plural) => `\nYou have **${count}** task${plural ? 's' : ''} to work on. You've got this! 💪`,
    emptySemester: `📋 No pending tasks for the current semester!`,
  },
  grades: {
    addPrompt: `I'd love to save your marks! Just tell me the subject, the exam type, and your score. 🎓✨\n\n(e.g., *"I got 25/30 in Math assignment"* or *"add grade Law, MidSem, 40, 50"*)`,
    numError: `I need the marks and max marks to be numbers so I can calculate your performance! 📊`,
    notFound: (name) => `❌ Subject *"${name}"* not found.`,
    addError: `I'm sorry, I couldn't save that grade for you right now.`,
    addSuccess: (type, name, marks, max, pct) => `Great work! I've saved your *${type.toUpperCase()}* marks for *${name}*. 🎓✨\n\nScore: **${marks}/${max}** (${pct}%)\nKeep it up! 💪`,
    empty: `I don't see any grades in your record yet. 📊✨\n\nOnce you add some, I can show you your performance overview!`,
    emptySemester: `I don't see any grades for your current semester yet! 📖✨`,
    header: `🎓 *Here is a look at your grades:* \n\n`,
    subjectLine: (name, marks, max, pct) => `*${name}:* ${marks}/${max} (${pct}%)\n`,
    footer: (pct) => `\nAcross all subjects, your current average is **${pct}%**. Keep pushing! 🚀`,
  },
  general: {
    export: `📁 Your data export functionality is available via the dashboard! \n  \nPlease visit ${WEBSITE_URL} and go to your **Settings** page to securely download all your raw data (Subjects, Grades, Timers, Attendance) as a CSV file.`,
    helpHeader: `👋 *Hi! I'm Ryuma, your personal study assistant.* 🎓\n\nI'm here to help you stay organized. You don't need to remember specific commands — you can just talk to me! 😊\n\n*Here are some things you can tell me:*\n📖 *"Add academic subject Math"* or *"Track guitar as a personal skill"*\n`,
    helpAcademic: `🎓 *"I went to Law class"* or *"I missed Economics today"*\n📊 *"How are my stats?"* or *"What is my attendance like?"*\n📝 *"I got 25/30 in my Physics quiz"* or *"Show my grades"*\n`,
    helpCommon: `⏱️ *"Start a timer for History"* or *"Done studying"*\n📋 *"Add a task: Submit project by Friday"* or *"Finish task 1"*\n\n*Need more?*\n👤 Say *"profile"* to see your current setup.\n⚙️ Say *"setup"* if you want to redo your profile or start a new semester.\n📁 Say *"export"* to get a link to download all your data.\n\nYou can also manage everything on your dashboard: ${WEBSITE_URL} 💻`,
    profileHeader: `👤 *Your Profile*\n\n`,
    profileName: (name) => `*Name:* ${name}\n`,
    profilePersonal: `*Personal Track:* Active\n`,
    profileAcademic: `*Academic Track:* Active\n`,
    profileTarget: (pct) => `*Target Attendance:* ${pct}%\n`,
    profileUniversity: (uni) => `*University:* ${uni}\n`,
    profileProgram: (prog) => `*Program:* ${prog}\n`,
    profileFooter: `\nIf you ever need to change any of this, just say *"setup"*! 😊`,
    unknown: `Hmm, I'm not sure I understood that correctly. 🤔\n\nYou can say *"help"* to see some of the things you can ask me, or visit your dashboard at ${WEBSITE_URL}!`,
    error: `❌ Something went wrong. Please try again.\n\nIf this keeps happening, visit ${WEBSITE_URL}`,
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
    return MESSAGES.subjects.addError(subjectName.trim());
  }

  return MESSAGES.subjects.personalSuccess(subject.name);
}

/** Routes "add subject <n>" — resolves type or asks if both tracks enabled. Supports bulk. */
async function handleAddSubject(user, phone, rawText) {
  if (!rawText) return MESSAGES.subjects.addPrompt;

  // Parse by comma for bulk addition or inline stats
  const parts = rawText.split(',').map(s => s.trim()).filter(Boolean);

  // If user only provided a name without type, let's gracefully fail and prompt format.
  if (parts.length < 2) {
    return MESSAGES.subjects.typeNeeded;
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
      responses.push(MESSAGES.subjects.invalidType(name));
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
    return MESSAGES.subjects.empty;
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
    personal.forEach((s, i) => { msg += `  ${i + 1}. ${s.name} \n`; });
  }

  msg += MESSAGES.subjects.listFooter(filteredSubjects.length, filteredSubjects.length !== 1);
  return msg;
}

async function handleDeleteSubject(user, subjectName) {
  if (!subjectName) return MESSAGES.subjects.deletePrompt;

  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .ilike('name', subjectName)
    .eq('is_active', true);

  if (!subjects || subjects.length === 0) {
    return MESSAGES.subjects.notFound(subjectName);
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
    return MESSAGES.subjects.wrongContext(subjectName);
  }

  const subject = validSubjects[0];

  // Soft-delete — preserves attendance logs, timers, grades
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
    return MESSAGES.attendance.notFound(subjectName.trim());
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
    return MESSAGES.attendance.wrongContext(subjectName.trim());
  }

  const subject = validSubjects[0];

  if (subject.type !== 'academic') {
    return MESSAGES.attendance.academicOnly(subject.name);
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
    return MESSAGES.attendance.alreadyMarked(subject.name, existing.status);
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
    return MESSAGES.attendance.error(subject.name);
  }

  const prefix = status === 'present'
    ? MESSAGES.attendance.presentPrefix(subject.name)
    : status === 'absent'
      ? MESSAGES.attendance.absentPrefix(subject.name)
      : MESSAGES.attendance.deemedPrefix(subject.name);
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

  if (totalCounted === 0) return MESSAGES.attendance.summaryNoData(subject.name);

  // Formula: (Present + Deemed) / Total
  const pct = ((totalPresent + totalDeemed) / totalCounted) * 100;

  // Use user's custom target percentage, default 75
  const targetPct = user.target_attendance_pct || 75.0;

  const emoji = pct >= targetPct ? '✅' : pct >= (targetPct - 15) ? '⚠️' : '🔴';

  let msg = prefix + MESSAGES.attendance.summaryLine(emoji, subject.name, totalPresent, totalCounted, pct.toFixed(1));
  if (totalDeemed > 0) msg += MESSAGES.attendance.deemedNote(totalDeemed);

  // Dynamic calculations based on total expected lectures
  if (subject.expected_total_lectures > 0) {
    const totalSemLectures = subject.expected_total_lectures;
    const maxAllowedMisses = Math.floor(totalSemLectures * (1 - (targetPct / 100)));

    // Net Absent = Absent - Deemed
    const netAbsent = totalAbsent - totalDeemed;
    const bunksLeft = maxAllowedMisses - netAbsent;

    if (bunksLeft >= 0) {
      msg += MESSAGES.attendance.bunksLeft(bunksLeft, bunksLeft !== 1);
    } else {
      // How many more present to reach target?
      // (Present + x + Deemed) / (Total + x) >= Target
      // P + D + x >= T * (Total + x)
      // P + D + x >= T*Total + T*x
      // x(1 - T) >= T*Total - (P + D)
      // x >= (T*Total - (P + D)) / (1 - T)
      const t = targetPct / 100;
      const x = Math.ceil((t * totalCounted - (totalPresent + totalDeemed)) / (1 - t));
      msg += MESSAGES.attendance.trackWarning(x, x !== 1);
    }
  } else if (pct < targetPct) {
    const t = targetPct / 100;
    const x = Math.ceil((t * totalCounted - (totalPresent + totalDeemed)) / (1 - t));
    if (x > 0) msg += MESSAGES.attendance.onTrackTip(x, x !== 1, targetPct);
  }

  return msg;
}

async function handleAttended(user, rawText) {
  if (!rawText) return MESSAGES.attendance.attendedPrompt;
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'present'));
  }
  return responses.join('\n\n');
}

async function handleMissed(user, rawText) {
  if (!rawText) return MESSAGES.attendance.missedPrompt;
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'absent'));
  }
  return responses.join('\n\n');
}
async function handleDeemed(user, rawText) {
  if (!rawText) return MESSAGES.attendance.deemedPrompt;
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'deemed'));
  }
  return responses.join('\n\n');
}
async function handleUndoAttendance(user, subjectName) {
  if (!subjectName) return MESSAGES.attendance.undoPrompt;

  const uc = getUserClient(user.whatsapp_number);
  const today = new Date().toISOString().split('T')[0];

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName.trim()}%`);

  if (!subjects || subjects.length === 0) return MESSAGES.attendance.notFound(subjectName.trim());

  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) return MESSAGES.attendance.wrongContext(subjectName.trim());
  const subject = validSubjects[0];

  const { error } = await uc
    .from('attendance_logs')
    .delete()
    .eq('profile_id', user.id)
    .eq('subject_id', subject.id)
    .eq('lecture_date', today);

  if (error) return MESSAGES.attendance.undoError;

  return await buildAttendanceSummary(uc, user, subject, MESSAGES.attendance.undoSuccessPrefix(subject.name));
}

/** Updates legacy missed or attended counters: update missed <subj>, <count> */
async function handleUpdateLegacy(user, column, rawText) {
  const parts = rawText.split(',').map(s => s.trim());
  if (parts.length < 2 || isNaN(parts[1])) {
    return MESSAGES.attendance.updateLegacyPrompt(column);
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
    return MESSAGES.attendance.notFound(subjectName);
  }

  const validSubjects = subjects.filter(s => {
    if (s.type === 'personal') return true;
    const semesterId = Array.isArray(s.source_course_id)
      ? s.source_course_id[0]?.semester_id
      : s.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (validSubjects.length === 0) return MESSAGES.attendance.wrongContext(subjectName);

  const subject = validSubjects[0];
  const updates = {};
  updates[column] = count;

  const { error } = await uc
    .from('subjects')
    .update(updates)
    .eq('id', subject.id);

  if (error) {
    console.error('❌ update legacy error:', error);
    return MESSAGES.attendance.updateLegacyError(subject.name);
  }

  return MESSAGES.attendance.updateLegacySuccess(subject.name, count, column);
}

async function handleStats(user) {
  if (!user.academics_enabled) {
    return MESSAGES.stats.academicOnly;
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
    return MESSAGES.stats.noSubjects;
  }

  let msg = MESSAGES.stats.header(user.target_attendance_pct || 75);
  let hasData = false;

  for (const subject of subjects) {
    const summaryStr = await buildAttendanceSummary(uc, user, subject, '');
    if (!summaryStr.includes('0 classes so far.')) {
      hasData = true;
      msg += summaryStr + '\n\n';
    } else {
      msg += `${MESSAGES.stats.noDataEmoji} *${subject.name}*: ${MESSAGES.stats.noDataNote}\n\n`;
    }
  }

  if (!hasData) return MESSAGES.stats.empty;
  return msg.trim();
}

// ============================================================================
// STUDY TIMERS
// ============================================================================

async function handleStartTimer(user, subjectName) {
  if (!subjectName) return MESSAGES.timers.startPrompt;

  const uc = getUserClient(user.whatsapp_number);

  // Check if a timer is already running
  const { data: running } = await uc
    .from('study_timers')
    .select('id, subjects(name)')
    .eq('profile_id', user.id)
    .is('ended_at', null)
    .maybeSingle();

  if (running) {
    return MESSAGES.timers.alreadyRunning(running.subjects?.name);
  }

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name, type, source_course_id(semester_id)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName.trim()}%`);

  if (!subjects || subjects.length === 0) {
    return MESSAGES.timers.notFound(subjectName.trim());
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
    return MESSAGES.timers.wrongContext(subjectName.trim());
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
    return MESSAGES.timers.startError;
  }

  return MESSAGES.timers.started(subject.name);
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
    return MESSAGES.timers.noActive;
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
    return MESSAGES.timers.stopError;
  }

  return MESSAGES.timers.stopped(running.subjects?.name, hrs, mins);
}

// ============================================================================
// TASK HANDLERS  (all via user JWT client — RLS enforced)
// ============================================================================

async function handleAddTask(user, rawText) {
  if (!rawText) return MESSAGES.tasks.addPrompt;

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
    return MESSAGES.tasks.addError;
  }

  const dueStr = task.due_date ? MESSAGES.tasks.dueNote(new Date(task.due_date).toLocaleDateString('en-IN')) : '';
  return MESSAGES.tasks.addSuccess(task.title, dueStr);
}

async function handleCompleteTask(user, numberStr) {
  const taskIndex = parseInt(numberStr, 10) - 1;
  if (isNaN(taskIndex) || taskIndex < 0) return MESSAGES.tasks.donePrompt;

  const uc = getUserClient(user.whatsapp_number);

  // We must fetch exactly the same list `handleListTasks` does to get the correct UUID for index N
  const { data: rawTasks } = await uc
    .from('tasks')
    .select('id, title, subject_id, subjects(type, source_course_id(semester_id))')
    .eq('profile_id', user.id)
    .eq('is_completed', false)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (!rawTasks || rawTasks.length === 0) return MESSAGES.tasks.empty;

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
  if (taskIndex >= tasks.length) return MESSAGES.tasks.notFound(taskIndex + 1, tasks.length);

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
    return MESSAGES.tasks.doneError;
  }

  return MESSAGES.tasks.doneSuccess(targetTask.title);
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
    return MESSAGES.tasks.listCaughtUp;
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
    return MESSAGES.tasks.emptySemester;
  }

  const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  let msg = MESSAGES.tasks.listHeader(filteredTasks.length);
  filteredTasks.forEach((t, i) => {
    const p = priorityEmoji[t.priority] || '🟡';
    const due = t.due_date
      ? MESSAGES.tasks.dueNote(new Date(t.due_date).toLocaleDateString('en-IN'))
      : '';
    msg += `${i + 1}. ${p} ${t.title}${due}\n`;
  });

  msg += MESSAGES.tasks.listFooter(filteredTasks.length, filteredTasks.length !== 1);
  return msg;
}

// ============================================================================
// GRADES AND DATA MANAGEMENT
// ============================================================================

async function handleAddGrade(user, rawText) {
  // Parsing standard: add grade Math, MidSem, 25, 30, [weigtage]
  const parts = rawText.split(',').map(p => p.trim());
  if (parts.length < 4) {
    return MESSAGES.grades.addPrompt;
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

  if (isNaN(marks) || isNaN(maxMarks)) return MESSAGES.grades.numError;

  const uc = getUserClient(user.whatsapp_number);

  const { data: subjects } = await uc
    .from('subjects')
    .select('id, name')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .ilike('name', `%${subjectName}%`);

  if (!subjects || subjects.length === 0) return MESSAGES.grades.notFound(subjectName);
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
    return MESSAGES.grades.addError;
  }

  const p = ((marks / maxMarks) * 100).toFixed(1);
  return MESSAGES.grades.addSuccess(gradeTypeRaw, subject.name, marks, maxMarks, p);
}

async function handleViewGrades(user) {
  const uc = getUserClient(user.whatsapp_number);

  const { data: grades, error } = await uc
    .from('grades')
    .select('marks, max_marks, grade_type, subject_id, subjects!inner(name, type, source_course_id(semester_id))')
    .eq('profile_id', user.id);

  if (error || !grades || grades.length === 0) return MESSAGES.grades.empty;

  // Hierarchical Filter
  const filteredGrades = grades.filter(g => {
    const sub = g.subjects;
    if (sub.type === 'personal') return true;
    const semesterId = Array.isArray(sub.source_course_id)
      ? sub.source_course_id[0]?.semester_id
      : sub.source_course_id?.semester_id;
    return semesterId === user.current_semester_id;
  });

  if (filteredGrades.length === 0) return MESSAGES.grades.emptySemester;

  // Aggregate by subject
  const map = {};
  filteredGrades.forEach(g => {
    const sName = g.subjects.name;
    if (!map[sName]) map[sName] = { obtained: 0, total: 0 };
    map[sName].obtained += Number(g.marks);
    map[sName].total += Number(g.max_marks);
  });

  let msg = MESSAGES.grades.header;
  let overallObtained = 0;
  let overallTotal = 0;

  for (const [name, stats] of Object.entries(map)) {
    if (stats.total > 0) {
      const p = ((stats.obtained / stats.total) * 100).toFixed(1);
      msg += MESSAGES.grades.subjectLine(name, stats.obtained, stats.total, p);
      overallObtained += stats.obtained;
      overallTotal += stats.total;
    }
  }

  if (overallTotal > 0) {
    const overallP = ((overallObtained / overallTotal) * 100).toFixed(1);
    msg += MESSAGES.grades.footer(overallP);
  }

  return msg;
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

  if (error) return MESSAGES.subjects.archiveError;

  // Wipe the current semester ID
  await updateProfile(user.whatsapp_number, { current_semester_id: null });

  const num = subjects ? subjects.length : 0;
  return MESSAGES.subjects.archiveSuccess(num);
}

async function handleExport(user) {
  return MESSAGES.general.export;
}

// ============================================================================
// HELP — contextual based on enabled tracks
// ============================================================================

function handleHelp(user) {
  const hasAcademic = user?.academics_enabled;
  const hasPersonal = user?.personal_enabled;

  let msg = MESSAGES.general.helpHeader;

  if (hasAcademic) {
    msg += MESSAGES.general.helpAcademic;
  }

  msg += MESSAGES.general.helpCommon;
  return msg;
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

    // Fetch university/program details
    if (user.current_university_id) {
      const { data: uni } = await uc.from('universities').select('name').eq('id', user.current_university_id).maybeSingle();
      if (uni) msg += MESSAGES.general.profileUniversity(uni.name);
    }
    if (user.current_program_id) {
      const { data: prog } = await uc.from('programs').select('name').eq('id', user.current_program_id).maybeSingle();
      if (prog) msg += MESSAGES.general.profileProgram(prog.name);
    }
  }

  msg += MESSAGES.general.profileFooter;
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

    const deps = {
      getUserClient,
      getOrCreateUser,
      updateProfile,
      createSubject,
      seedDefaultCategories,
      setSession,
      clearSession,
      WEBSITE_URL
    };

    // ── Onboarding / Setup Logic ───────────────────────────────────────────
    if (lower === 'setup' || lower === 'reset') {
      await updateProfile(phone, { display_name: PLACEHOLDER_NAME });
      clearSession(phone);
      return startOnboarding(phone, deps);
    }

    if (session) {
      if (lower === 'cancel' || lower === 'stop') {
        clearSession(phone);
        return `Onboarding cancelled. Let me know when you're ready to start by typing "setup"!`;
      }
      touchSession(phone);
      const res = await handleOnboarding(user, session, text.trim(), deps);
      if (res) return res;
    }

    if (needsOnboarding(user)) {
      return startOnboarding(phone, deps);
    }

    // ── Profile commands ───────────────────────────────────────────────────
    if (lower === 'profile') return await handleProfile(user);
    if (lower === 'export') return await handleExport(user);

    // ── Greetings & Help ──────────────────────────────────────────────────
    if (['hi', 'hello', 'hey', 'help', '?', 'start'].includes(lower) && !lower.startsWith('start ')) {
      return handleHelp(user);
    }
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
    return MESSAGES.general.unknown;

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
  console.log('\n📨 Incoming webhook');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from;       // raw digits e.g. "918767689904"
      let text = message.text?.body;

      // Handle Interactive Replies
      if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          text = interactive.button_reply.id;
        } else if (interactive.type === 'list_reply') {
          text = interactive.list_reply.id;
        }
      }

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