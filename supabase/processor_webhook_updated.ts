import { MESSAGES, WEBSITE_URL } from './messages.ts';
import { getUserClient, supabaseAdmin, getSession, setSession, clearSession } from './db.ts';
import { parseIntent } from './nlp.ts';
import { startOnboarding, handleOnboarding } from './setup.ts';

const PLACEHOLDER_NAME = '';

// --- HELPERS ---
export function needsOnboarding(user: any) {
  if (!user.display_name || user.display_name === PLACEHOLDER_NAME) return true;
  if (user.academics_enabled && !user.current_semester_id) return true;
  if (!user.academics_enabled && !user.personal_enabled) return true;
  return false;
}

export async function getOrCreateUser(phone: string) {
  const { data: existing } = await supabaseAdmin.from('profiles').select('*').eq('whatsapp_number', phone).maybeSingle();
  if (existing) return existing;
  const { data: newUser, error } = await supabaseAdmin.from('profiles').insert([
    {
      whatsapp_number: phone,
      display_name: PLACEHOLDER_NAME,
      timezone: 'Asia/Kolkata',
      academics_enabled: false,
      personal_enabled: false
    }
  ]).select().single();
  if (error) throw error;
  return newUser;
}

export async function updateProfile(phone: string, updates: any) {
  const uc = await getUserClient(phone);
  const { data, error } = await uc.from('profiles').update(updates).eq('whatsapp_number', phone).select().single();
  if (error) throw error;
  return data;
}

export async function seedDefaultCategories(phone: string) {
  const uc = await getUserClient(phone);
  const { data: profile } = await uc.from('profiles').select('id').eq('whatsapp_number', phone).single();
  if (!profile) return;
  const rows = [
    { profile_id: profile.id, name: 'Professional Development', color_hex: '#8b5cf6', is_default: true },
    { profile_id: profile.id, name: 'Competitive Exams', color_hex: '#ec4899', is_default: true },
    { profile_id: profile.id, name: 'Language Learning', color_hex: '#f59e0b', is_default: true },
    { profile_id: profile.id, name: 'Creative Skills', color_hex: '#10b981', is_default: true },
    { profile_id: profile.id, name: 'Hobbies', color_hex: '#6366f1', is_default: true }
  ];
  await uc.from('subject_categories').upsert(rows, { onConflict: 'profile_id,name', ignoreDuplicates: true });
}

// --- CATEGORY HANDLERS ---
async function handleAddCategory(user, categoryName) {
  if (!categoryName) return MESSAGES.categories.prompt;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: dup } = await uc.from('subject_categories').select('name').eq('profile_id', user.id).ilike('name', categoryName).maybeSingle();
  if (dup) return MESSAGES.categories.duplicate(dup.name);
  const { data: created, error } = await uc.from('subject_categories').insert([
    { profile_id: user.id, name: categoryName, color_hex: '#6366f1', is_default: false }
  ]).select().single();
  if (error) return MESSAGES.categories.error;
  return MESSAGES.categories.success(created.name);
}

async function handleListCategories(user) {
  const uc = await getUserClient(user.whatsapp_number);
  const { data: cats } = await uc.from('subject_categories').select('name').eq('profile_id', user.id).order('created_at', { ascending: true });
  if (!cats || cats.length === 0) return MESSAGES.categories.empty;
  let msg = MESSAGES.categories.listHeader(cats.length);
  cats.forEach((c, i)=>{ msg += `${i + 1}. ${c.name}\n`; });
  return msg;
}

async function handleDeleteCategory(user, categoryName) {
  if (!categoryName) return MESSAGES.categories.deletePrompt;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: cat } = await uc.from('subject_categories').select('id, name').eq('profile_id', user.id).ilike('name', categoryName).maybeSingle();
  if (!cat) return MESSAGES.categories.notFound(categoryName);
  const { count } = await uc.from('subjects').select('id', { count: 'exact', head: true }).eq('category_id', cat.id).eq('is_active', true);
  if (count && count > 0) return MESSAGES.categories.inUse(cat.name, count);
  const { error } = await uc.from('subject_categories').delete().eq('id', cat.id);
  if (error) return MESSAGES.categories.deleteError;
  return MESSAGES.categories.deleteSuccess(cat.name);
}

// --- SUBJECT HANDLERS ---
async function findOrCreateAcademicCourse(semesterId: string, courseName: string) {
  const { data: existing } = await supabaseAdmin.from('academic_courses').select('id').eq('semester_id', semesterId).ilike('course_name', courseName).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabaseAdmin.from('academic_courses').insert([
    { semester_id: semesterId, course_name: courseName }
  ]).select().single();
  if (error) throw error;
  return created.id;
}

async function createSubject(user: any, subjectName: string, type: string, total: number | null = null, missed: number = 0, attended: number = 0, categoryName: string | null = null) {
  const { data: dup } = await supabaseAdmin.from('subjects').select('name, type').eq('profile_id', user.id).ilike('name', subjectName.trim()).eq('is_active', true).maybeSingle();
  if (dup) return MESSAGES.subjects.duplicate(dup.name, dup.type);
  if (type === 'academic') {
    if (!user.current_semester_id) return MESSAGES.subjects.setupNeeded;
    let courseId;
    try { courseId = await findOrCreateAcademicCourse(user.current_semester_id, subjectName.trim()); } catch { return MESSAGES.subjects.error; }
    const { data: subject, error } = await supabaseAdmin.from('subjects').insert([
      { profile_id: user.id, type: 'academic', name: subjectName.trim(), source_course_id: courseId, is_active: true, expected_total_lectures: total }
    ]).select().single();
    if (error) return MESSAGES.subjects.addError(subjectName.trim());
    return MESSAGES.subjects.academicSuccess(subject.name);
  }
  let categoryId = null;
  if (categoryName) {
    const { data: cat } = await supabaseAdmin.from('subject_categories').select('id').eq('profile_id', user.id).ilike('name', categoryName.trim()).maybeSingle();
    if (cat) categoryId = cat.id;
    else {
      const { data: newCat, error: catErr } = await supabaseAdmin.from('subject_categories').insert([
        { profile_id: user.id, name: categoryName.trim(), color_hex: '#6366f1', is_default: false }
      ]).select().single();
      if (!catErr) categoryId = newCat.id;
    }
  }
  const { data: subject, error } = await supabaseAdmin.from('subjects').insert([
    { profile_id: user.id, type: 'personal', name: subjectName.trim(), category_id: categoryId, is_active: true, expected_total_lectures: total }
  ]).select().single();
  if (error) return MESSAGES.subjects.addError(subjectName.trim());
  return MESSAGES.subjects.personalSuccess(subject.name);
}

async function handleAddSubject(user, phone, rawText) {
  if (!rawText) return MESSAGES.subjects.addPrompt;
  const catMatch = rawText.match(/(?:to|in|under|into)\s+(?:the\s+)?(?:category|cat)\s+(.+)$/i);
  let manualCategory = null;
  let textToProcess = rawText;
  if (catMatch) {
    manualCategory = catMatch[1].trim();
    textToProcess = rawText.replace(/(?:to|in|under|into)\s+(?:the\s+)?(?:category|cat)\s+(.+)$/i, '').trim();
  }
  const parts = textToProcess.split(',').map((s)=>s.trim()).filter(Boolean);
  if (parts.length === 1) {
    const type = user.personal_enabled && !user.academics_enabled ? 'personal' : 'academic';
    return await createSubject(user, parts[0], type, null, 0, 0, manualCategory);
  }
  const responses = [];
  let i = 0;
  while(i < parts.length){
    let name = parts[i];
    let typeVal = parts[i + 1]?.toLowerCase();
    let type = user.academics_enabled ? 'academic' : 'personal';
    let consumed = 1;
    if (['1', '2', 'academic', 'personal'].includes(typeVal)) {
      type = typeVal === '1' || typeVal === 'academic' ? 'academic' : 'personal';
      consumed = 2;
    }
    let category = manualCategory;
    if (type === 'personal' && !category) {
      const nextPart = parts[i + consumed];
      if (nextPart && isNaN(nextPart)) { category = nextPart; consumed++; }
    }
    let total = null;
    if (i + consumed < parts.length && !isNaN(parts[i + consumed])) { total = parseInt(parts[i + consumed], 10); consumed++; }
    responses.push(await createSubject(user, name, type, total, 0, 0, category));
    i += consumed;
  }
  return responses.join('\n\n');
}

async function handleListSubjects(user) {
  const uc = await getUserClient(user.whatsapp_number);
  const { data: subjects } = await uc.from('subjects').select('name, type, category_id, subject_categories(name), source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).order('created_at', { ascending: true });
  if (!subjects || subjects.length === 0) return MESSAGES.subjects.empty;
  const filtered = subjects.filter((s)=>{
    if (s.type === 'academic' && !user.academics_enabled) return false;
    if (s.type === 'personal' && !user.personal_enabled) return false;
    if (s.type === 'academic') {
      const semId = Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id : s.source_course_id?.semester_id;
      return semId === user.current_semester_id;
    }
    return true;
  });
  if (filtered.length === 0) return MESSAGES.subjects.emptySemester;
  const academic = filtered.filter((s)=>s.type === 'academic');
  const personal = filtered.filter((s)=>s.type === 'personal');
  let msg = MESSAGES.subjects.listHeader;
  if (academic.length) {
    msg += MESSAGES.subjects.listAcademic;
    academic.forEach((s, i)=>{ msg += `  ${i + 1}. ${s.name} \n`; });
  }
  if (personal.length) {
    msg += MESSAGES.subjects.listPersonal;
    const grouped = {};
    personal.forEach((s)=>{
      const cat = s.subject_categories?.name || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s.name);
    });
    for (const [cat, items] of Object.entries(grouped)){
      msg += `\n📂 *${cat}*\n`;
      items.forEach((name)=>{ msg += `  - ${name}\n`; });
    }
  }
  msg += MESSAGES.subjects.listFooter(filtered.length, filtered.length !== 1);
  return msg;
}

// --- ATTENDANCE HANDLERS ---
async function logAttendance(user, subjectName, status) {
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('subjects').select('id, name, type, expected_total_lectures, source_course_id(semester_id, expected_total_lectures)').eq('profile_id', user.id).eq('is_active', true).ilike('name', `%${subjectName.trim()}%`);
  if (!raw || raw.length === 0) return null;
  const subjects = raw.filter((s)=>s.type === 'personal' || (Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id));
  if (subjects.length === 0) return MESSAGES.attendance.wrongContext(subjectName.trim());
  let subject = subjects[0];
  if (subjects.length > 1) {
    const exact = subjects.find((s)=>s.name.toLowerCase() === subjectName.trim().toLowerCase());
    if (exact) subject = exact;
    else return MESSAGES.subjects.ambiguity(subjectName.trim(), subjects.map((s, i)=>`${i + 1}. ${s.name}`).join('\n'));
  }
  if (subject.type !== 'academic') return MESSAGES.attendance.academicOnly(subject.name);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone || 'Asia/Kolkata' });
  const { data: existing } = await uc.from('attendance_logs').select('status').eq('profile_id', user.id).eq('subject_id', subject.id).eq('lecture_date', today).order('created_at', { ascending: false }).limit(1).maybeSingle();
  await uc.from('attendance_logs').insert([{ profile_id: user.id, subject_id: subject.id, lecture_date: today, status }]);
  let prefix = '';
  if (existing) {
    const { data: logs } = await uc.from('attendance_logs').select('status').eq('profile_id', user.id).eq('subject_id', subject.id);
    const totalCount = (logs?.length || 0);
    prefix = MESSAGES.attendance.multiMarked(subject.name, existing.status, status, totalCount);
  } else {
    prefix = status === 'present' ? MESSAGES.attendance.presentPrefix(subject.name) : status === 'absent' ? MESSAGES.attendance.absentPrefix(subject.name) : MESSAGES.attendance.deemedPrefix(subject.name);
  }
  return await buildAttendanceSummary(uc, user, subject, prefix);
}

async function buildAttendanceSummary(uc, user, subject, prefix = '', preFetchedLogs = null) {
  const logs = preFetchedLogs || await (async () => {
    const { data } = await uc.from('attendance_logs').select('status').eq('profile_id', user.id).eq('subject_id', subject.id);
    return data;
  })();
  const present = (logs?.filter((l)=>l.status === 'present').length || 0);
  const absent = (logs?.filter((l)=>l.status === 'absent').length || 0);
  const deemed = (logs?.filter((l)=>l.status === 'deemed').length || 0);
  const total = present + absent + deemed;
  if (total === 0) return MESSAGES.attendance.summaryNoData(subject.name);
  const pct = (present + deemed) / total * 100;
  const target = user.target_attendance_pct || 75;
  const emoji = pct >= target ? '✅' : pct >= target - 15 ? '⚠️' : '🔴';
  let msg = prefix + MESSAGES.attendance.summaryLine(emoji, subject.name, present, total, pct.toFixed(1));
  if (deemed > 0) msg += MESSAGES.attendance.deemedNote(deemed);
  const expectedTotal = subject.expected_total_lectures || subject.source_course_id?.expected_total_lectures || 0;
  if (expectedTotal > 0) {
    const t = target / 100;
    const maxMisses = Math.floor(expectedTotal * (1 - t));
    const bunks = maxMisses - absent;
    const remaining = Math.max(0, expectedTotal - total);
    const totalPresentsNeededForGoal = Math.ceil(expectedTotal * t);
    const needed = Math.max(0, totalPresentsNeededForGoal - (present + deemed));
    if (bunks >= 0) msg += MESSAGES.attendance.bunksLeft(bunks, bunks !== 1);
    else {
      if (needed > remaining) {
        const maxPossiblePct = ((present + deemed + remaining) / expectedTotal) * 100;
        msg += MESSAGES.attendance.impossibleGoal(Math.round(maxPossiblePct));
      } else msg += MESSAGES.attendance.trackWarning(needed, needed !== 1);
    }
  } else if (pct < target) {
    const t = target / 100;
    const x = Math.ceil((t * total - (present + deemed)) / (1 - t));
    if (x > 0) msg += MESSAGES.attendance.onTrackTip(x, x !== 1, target);
  }
  return msg;
}

// --- SUBJECT MANAGEMENT ---
async function handleRenameSubject(user, text) {
  const parts = text.split(',').map((s)=>s.trim());
  if (parts.length < 2) return MESSAGES.subjects.renamePrompt;
  const [oldName, newName] = parts;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('subjects').select('id, name, type, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).ilike('name', oldName);
  if (!raw || raw.length === 0) return MESSAGES.subjects.notFound(oldName);
  const valid = raw.filter((s)=>s.type === 'personal' || (Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id));
  if (valid.length === 0) return `❌ Subject exists but is not in your current context.`;
  const { error } = await uc.from('subjects').update({ name: newName }).eq('id', valid[0].id);
  if (error) return MESSAGES.subjects.renameError;
  return MESSAGES.subjects.renameSuccess(valid[0].name, newName);
}

async function handleDeleteSubject(user, subjectName) {
  if (!subjectName) return MESSAGES.subjects.deletePrompt;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('subjects').select('id, name, type, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).ilike('name', subjectName.trim());
  if (!raw || raw.length === 0) return MESSAGES.subjects.notFound(subjectName.trim());
  const valid = raw.filter((s)=>s.type === 'personal' || (Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id));
  if (valid.length === 0) return MESSAGES.subjects.wrongContext(subjectName.trim());
  const { error } = await uc.from('subjects').update({ is_active: false }).eq('id', valid[0].id);
  if (error) return MESSAGES.subjects.deleteError;
  return MESSAGES.subjects.deleteSuccess(valid[0].name);
}

async function handleSetupLectures(user, text) {
  const type = text.startsWith('total') ? 'total' : 'missed';
  const parts = text.replace(/^(total|missed)\s+/i, '').split(',');
  if (parts.length < 2) return MESSAGES.general.unknown;
  const subjectName = parts[0].trim();
  const val = parseInt(parts[1].trim(), 10);
  if (isNaN(val)) return MESSAGES.general.unknown;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: subjects } = await uc.from('subjects').select('id, name').eq('profile_id', user.id).ilike('name', subjectName).eq('is_active', true);
  if (!subjects || subjects.length === 0) return MESSAGES.subjects.notFound(subjectName);
  const col = 'expected_total_lectures';
  if (type !== 'total') return MESSAGES.general.unknown;
  await uc.from('subjects').update({ [col]: val }).eq('id', subjects[0].id);
  return MESSAGES.subjects.setupLecturesSuccess(subjects[0].name, type, val);
}

async function handleMarkAll(user, status) {
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('subjects').select('id, name, type, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).eq('type', 'academic');
  const filtered = raw?.filter((s)=>Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id) || [];
  if (filtered.length === 0) return MESSAGES.stats.noSubjects;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone || 'Asia/Kolkata' });
  let count = 0;
  for (const s of filtered){
    const { data: existing } = await uc.from('attendance_logs').select('id').eq('profile_id', user.id).eq('subject_id', s.id).eq('lecture_date', today).maybeSingle();
    if (!existing) {
      await uc.from('attendance_logs').insert([{ profile_id: user.id, subject_id: s.id, lecture_date: today, status }]);
      count++;
    }
  }
  return MESSAGES.attendance.allSuccess(status, count);
}

async function handleUndoAll(user) {
  const uc = await getUserClient(user.whatsapp_number);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone || 'Asia/Kolkata' });
  const { error } = await uc.from('attendance_logs').delete().eq('profile_id', user.id).eq('lecture_date', today);
  if (error) return MESSAGES.attendance.undoError;
  return MESSAGES.attendance.undoAllSuccess;
}

// --- TASK HANDLERS ---
async function handleAddTask(user, rawText) {
  if (!rawText) return MESSAGES.tasks.addPrompt;
  let title = rawText.trim(), dueDate = null, subjectId = null;
  const dueMatch = title.match(/due\s+(on\s+)?([\w\s,]+)/i);
  if (dueMatch) {
    title = title.replace(dueMatch[0], '').trim();
    const d = new Date(dueMatch[2]);
    if (!isNaN(d.getTime())) dueDate = d.toISOString();
  }
  const uc = await getUserClient(user.whatsapp_number);
  const { data: subs } = await uc.from('subjects').select('id, name').eq('profile_id', user.id).eq('is_active', true);
  if (subs) {
    for (const s of subs){ if (title.toLowerCase().includes(s.name.toLowerCase())) { subjectId = s.id; break; } }
  }
  const { data: task, error } = await uc.from('tasks').insert([{ profile_id: user.id, subject_id: subjectId, title, is_completed: false, priority: 'medium', due_date: dueDate }]).select().single();
  if (error) return MESSAGES.tasks.addError;
  const dueStr = task.due_date ? MESSAGES.tasks.dueNote(new Date(task.due_date).toLocaleDateString('en-IN')) : '';
  return MESSAGES.tasks.addSuccess(task.title, dueStr);
}

async function handleCompleteTask(user, numberStr) {
  const idx = parseInt(numberStr, 10) - 1;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('tasks').select('id, title, subject_id, subjects(type, source_course_id(semester_id))').eq('profile_id', user.id).eq('is_completed', false).order('due_date', { ascending: true, nullsFirst: false });
  const tasks = raw?.filter((t)=>{
    if (!t.subject_id) return user.academics_enabled || user.personal_enabled;
    if (t.subjects?.type === 'academic' && !user.academics_enabled) return false;
    if (t.subjects?.type === 'personal' && !user.personal_enabled) return false;
    if (t.subjects?.type === 'academic') {
      const semId = Array.isArray(t.subjects.source_course_id) ? t.subjects.source_course_id[0]?.semester_id : t.subjects.source_course_id?.semester_id;
      return semId === user.current_semester_id;
    }
    return true;
  }) || [];
  if (idx < 0 || idx >= tasks.length) return MESSAGES.tasks.notFound(idx + 1, tasks.length);
  await uc.from('tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', tasks[idx].id);
  return MESSAGES.tasks.doneSuccess(tasks[idx].title);
}

async function handleListTasks(user) {
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('tasks').select('title, priority, due_date, subject_id, subjects(type, source_course_id(semester_id))').eq('profile_id', user.id).eq('is_completed', false).order('due_date', { ascending: true, nullsFirst: false });
  if (!raw || raw.length === 0) return MESSAGES.tasks.listCaughtUp;
  const tasks = raw.filter((t)=>{
    if (!t.subject_id) return user.academics_enabled || user.personal_enabled;
    if (t.subjects?.type === 'academic' && !user.academics_enabled) return false;
    if (t.subjects?.type === 'personal' && !user.personal_enabled) return false;
    if (t.subjects?.type === 'academic') {
      const semId = Array.isArray(t.subjects.source_course_id) ? t.subjects.source_course_id[0]?.semester_id : t.subjects.source_course_id?.semester_id;
      return semId === user.current_semester_id;
    }
    return true;
  });
  if (tasks.length === 0) return MESSAGES.tasks.empty;
  let msg = MESSAGES.tasks.listHeader(tasks.length);
  tasks.forEach((t, i)=>{
    const p = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority] || '🟡';
    msg += `${i + 1}. ${p} ${t.title}${t.due_date ? MESSAGES.tasks.dueNote(new Date(t.due_date).toLocaleDateString('en-IN')) : ''}\n`;
  });
  return msg + MESSAGES.tasks.listFooter(tasks.length, tasks.length !== 1);
}

// --- TIMER HANDLERS ---
async function handleStartTimer(user, subjectName) {
  if (!subjectName) return MESSAGES.timers.startPrompt;
  const uc = await getUserClient(user.whatsapp_number);
  const { data: running } = await uc.from('study_timers').select('id, subjects(name)').eq('profile_id', user.id).is('ended_at', null).maybeSingle();
  if (running) return MESSAGES.timers.alreadyRunning(running.subjects?.name);
  const { data: subs } = await uc.from('subjects').select('id, name, type, source_course_id(semester_id)').eq('profile_id', user.id).eq('is_active', true).ilike('name', `%${subjectName.trim()}%`);
  if (!subs || subs.length === 0) return MESSAGES.timers.notFound(subjectName.trim());
  const valid = subs.filter((s)=>s.type === 'personal' || (Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id));
  if (valid.length === 0) return MESSAGES.timers.wrongContext(subjectName.trim());
  await uc.from('study_timers').insert([{ profile_id: user.id, subject_id: valid[0].id, started_at: new Date().toISOString() }]);
  return MESSAGES.timers.started(valid[0].name);
}

async function handleStopTimer(user) {
  const uc = await getUserClient(user.whatsapp_number);
  const { data: running } = await uc.from('study_timers').select('id, started_at, subjects(name)').eq('profile_id', user.id).is('ended_at', null).maybeSingle();
  if (!running) return MESSAGES.timers.noActive;
  const ended = new Date();
  const diff = ended.getTime() - new Date(running.started_at).getTime();
  const mins = Math.floor(diff / 60000);
  await uc.from('study_timers').update({ ended_at: ended.toISOString() }).eq('id', running.id);
  return MESSAGES.timers.stopped(running.subjects?.name, Math.floor(mins / 60), mins % 60);
}

// --- PROFILE HANDLER ---
async function handleProfile(user: any, uc: any) {
  let msg = MESSAGES.general.profileHeader + MESSAGES.general.profileName(user.display_name);
  if (user.personal_enabled) msg += MESSAGES.general.profilePersonal;
  if (user.academics_enabled) {
    msg += MESSAGES.general.profileAcademic + MESSAGES.general.profileTarget(user.target_attendance_pct || 75);
    if (user.current_university_id) {
      const { data: uni } = await uc.from('universities').select('name').eq('id', user.current_university_id).maybeSingle();
      if (uni) msg += MESSAGES.general.profileUniversity(uni.name);
    }
    if (user.current_semester_id) {
      const { data: sem } = await uc.from('semesters').select('name, semester_number').eq('id', user.current_semester_id).maybeSingle();
      if (sem) msg += MESSAGES.general.profileSemester(sem.name || `Semester ${sem.semester_number}`);
    }
  }
  return msg + MESSAGES.general.profileFooter;
}

function handleHelp(user: any) {
  if (user.academics_enabled && user.personal_enabled) return MESSAGES.general.helpBoth;
  if (user.personal_enabled) return MESSAGES.general.helpPersonal;
  return MESSAGES.general.help;
}

async function handleStats(user: any, uc: any) {
  if (!user.academics_enabled) return MESSAGES.stats.academicOnly;
  const { data: raw } = await uc.from('subjects').select('id, name, expected_total_lectures, source_course_id(semester_id, expected_total_lectures)').eq('profile_id', user.id).eq('is_active', true).eq('type', 'academic');
  const filtered = raw?.filter((s: any) => Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id === user.current_semester_id : s.source_course_id?.semester_id === user.current_semester_id) || [];
  if (filtered.length === 0) return MESSAGES.stats.noSubjects;
  const { data: logs } = await uc.from('attendance_logs').select('subject_id, status').eq('profile_id', user.id).in('subject_id', filtered.map((x: any) => x.id));
  let msg = MESSAGES.stats.header(user.target_attendance_pct || 75), hasData = false;
  for (const s of filtered) {
    const sLogs = logs?.filter((l: any) => l.subject_id === s.id) || [];
    const sum = await buildAttendanceSummary(uc, user, s, '', sLogs);
    if (!sum.includes('0 classes so far.')) { hasData = true; msg += sum + '\n\n'; }
    else msg += `${MESSAGES.stats.noDataEmoji} *${s.name}*: ${MESSAGES.stats.noDataNote}\n\n`;
  }
  return hasData ? msg.trim() : MESSAGES.stats.empty;
}

async function handleAttendanceBatch(user: any, text: string, status: 'present' | 'absent' | 'deemed') {
  const results = [];
  const rawText = text.substring(status === 'present' ? 9 : 7).trim();
  for (const item of rawText.split(',').map(s => s.trim()).filter(Boolean)) {
    const res = await logAttendance(user, item, status);
    results.push(res || MESSAGES.attendance.notFound(item));
  }
  return results.join('\n\n');
}

async function handleUndoAttendanceOne(user: any, uc: any, text: string) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone || 'Asia/Kolkata' });
  const item = text.substring(5).trim();
  const { data: s } = await uc.from('subjects').select('id, name').eq('profile_id', user.id).ilike('name', item).eq('is_active', true).maybeSingle();
  if (!s) return MESSAGES.attendance.notFound(item);
  const { error } = await uc.from('attendance_logs').delete().eq('profile_id', user.id).eq('subject_id', s.id).eq('lecture_date', today);
  if (error) return MESSAGES.attendance.undoError;
  return MESSAGES.attendance.undoSuccess(s.name);
}

async function handleLog(user: any) {
  const { data: subjects } = await supabaseAdmin.from('subjects').select('id, name').eq('profile_id', user.id).eq('is_active', true).eq('type', 'academic').order('name');
  if (!subjects || subjects.length === 0) return "You don't have any active academic subjects to log attendance for.";
  return {
    type: "list",
    header: { type: "text", text: "Attendance Logger" },
    body: { text: "Select a subject below to mark yourself as PRESENT for today." },
    footer: { text: "Ryu Medha Guardian" },
    action: {
      button: "Select Subject",
      sections: [{
        title: "Your Subjects",
        rows: subjects.slice(0, 10).map(s => ({ id: `wa_log_present_${s.id}`, title: s.name, description: "Tap to mark Present" }))
      }]
    }
  };
}

async function handleInteractiveLog(user: any, id: string) {
  const subjectId = id.replace('wa_log_present_', '');
  const { data: subject } = await supabaseAdmin.from('subjects').select('name').eq('id', subjectId).single();
  if (!subject) return "Subject not found.";
  return await logAttendance(user, subject.name, 'present');
}

// --- ROUTING ---
export async function processMessage(phone: string, text: string, metadata: { isInteractive: boolean } = { isInteractive: false }) {
  const user = await getOrCreateUser(phone);
  const lower = text.trim().toLowerCase();
  const uc = await getUserClient(phone);
  const session = await getSession(phone);
  const deps = { getUserClient, getOrCreateUser, updateProfile, createSubject, seedDefaultCategories, setSession, clearSession, WEBSITE_URL, supabaseAdmin, metadata };
  if (lower === 'setup' || lower === 'reset') { await updateProfile(phone, { display_name: PLACEHOLDER_NAME }); await clearSession(phone); return startOnboarding(phone, deps); }
  if (session) {
    if (['cancel', 'stop'].includes(lower)) { await clearSession(phone); return `Onboarding cancelled. Type "setup" to restart!`; }
    const reply = await handleOnboarding(user, session, text.trim(), deps);
    if (reply) return reply;
  }
  if (needsOnboarding(user)) return startOnboarding(phone, deps);
  let reply: string | any = null;
  if (lower === 'profile') reply = await handleProfile(user, uc);
  else if (['hi', 'hello', 'hey', 'help', '?', 'start'].includes(lower)) reply = handleHelp(user);
  else if (lower.startsWith('add task ')) reply = await handleAddTask(user, text.substring(9).trim());
  else if (lower.startsWith('done ')) reply = await handleCompleteTask(user, text.substring(5).trim());
  else if (['tasks', 'task'].includes(lower)) reply = await handleListTasks(user);
  else if (lower.startsWith('add category ')) reply = await handleAddCategory(user, text.substring(13).trim());
  else if (lower.startsWith('delete category ')) reply = await handleDeleteCategory(user, text.substring(16).trim());
  else if (['categories', 'category', 'list categories', 'list category'].includes(lower)) reply = await handleListCategories(user);
  else if (lower.startsWith('add subject ')) reply = await handleAddSubject(user, phone, text.substring(12).trim());
  else if (lower.startsWith('add ')) reply = await handleAddSubject(user, phone, text.substring(4).trim());
  else if (['subjects', 'subject', 'list'].includes(lower)) reply = await handleListSubjects(user);
  else if (lower.startsWith('start ')) reply = await handleStartTimer(user, text.substring(6).trim());
  else if (lower === 'stop') reply = await handleStopTimer(user);
  else if (lower === 'stats' || lower === 'attendance') reply = await handleStats(user, uc);
  else if (lower === 'log') reply = await handleLog(user);
  else if (lower.startsWith('wa_log_present_')) reply = await handleInteractiveLog(user, lower);
  else if (lower.startsWith('attended ')) reply = await handleAttendanceBatch(user, text, 'present');
  else if (lower.startsWith('missed ')) reply = await handleAttendanceBatch(user, text, 'absent');
  else if (lower.startsWith('deemed ')) reply = await handleAttendanceBatch(user, text, 'deemed');
  else if (lower.startsWith('undo ')) reply = await handleUndoAttendanceOne(user, uc, text);
  else if (lower.startsWith('rename subject ')) reply = await handleRenameSubject(user, text.substring(15).trim());
  else if (lower.startsWith('delete subject ')) reply = await handleDeleteSubject(user, text.substring(15).trim());
  else if (lower.startsWith('setup total ')) reply = await handleSetupLectures(user, text.substring(12).trim());
  else if (lower.startsWith('setup missed ')) reply = await handleSetupLectures(user, text.substring(13).trim());
  else if (lower === 'present all') reply = await handleMarkAll(user, 'present');
  else if (lower === 'absent all') reply = await handleMarkAll(user, 'absent');
  else if (lower === 'deemed all') reply = await handleMarkAll(user, 'deemed');
  else if (lower === 'undo all') reply = await handleUndoAll(user);
  if (!reply) {
    const inferred = await parseIntent(text);
    if (inferred && inferred !== lower) return await processMessage(phone, inferred);
  }
  return reply || MESSAGES.general.unknown;
}
