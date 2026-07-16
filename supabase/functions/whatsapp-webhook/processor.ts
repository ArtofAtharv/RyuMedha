import { MESSAGES, WEBSITE_URL } from './messages.ts';
import { getUserClient, supabaseAdmin, getSession, setSession, clearSession } from './db.ts';
import { parseIntent } from './nlp.ts';
import { startOnboarding, handleOnboarding } from './setup.ts';
import { getValidGoogleToken, fetchGoogleTasks, createGoogleTask, updateGoogleTask } from './google-tasks.ts';

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
  const summaryText = await buildAttendanceSummary(uc, user, subject, prefix);
  return {
    type: 'button',
    body: { text: summaryText },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'stats', title: '📊 Show Stats' } },
        { type: 'reply', reply: { id: 'tasks', title: '📋 Show Tasks' } }
      ]
    }
  };
}

async function buildAttendanceSummary(uc, user, subject, prefix = '', preFetchedLogs = null) {
  const logs = preFetchedLogs || await (async () => {
    const { data } = await uc.from('attendance_logs').select('status').eq('profile_id', user.id).eq('subject_id', subject.id);
    return data;
  })();
  // Legacy attendance is now ignored (always 0) as requested
  const present = (logs?.filter((l)=>l.status === 'present').length || 0);
  const absent = (logs?.filter((l)=>l.status === 'absent').length || 0);
  const deemed = (logs?.filter((l)=>l.status === 'deemed').length || 0);
  const total = present + absent + deemed;
  if (total === 0) return MESSAGES.attendance.summaryNoData(subject.name);
  
  // Percent calculation: (Present + Deemed) / Total
  const pct = (present + deemed) / total * 100;
  const target = user.target_attendance_pct || 75;
  const emoji = pct >= target ? '✅' : pct >= target - 15 ? '⚠️' : '🔴';
  let msg = prefix + MESSAGES.attendance.summaryLine(emoji, subject.name, present + deemed, total, pct.toFixed(1));
  if (deemed > 0) msg += MESSAGES.attendance.deemedNote(deemed);
  
  const expectedTotal = subject.expected_total_lectures || subject.source_course_id?.expected_total_lectures || 0;
  if (expectedTotal > 0) {
    const t = target / 100;
    const maxMisses = Math.floor(expectedTotal * (1 - t));
    
    // FIX: Bunks calculation should only use ACTUAL absences. 
    // If a lecture is deemed, it doesn't count as an absence towards the bunk limit.
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
  if (valid.length === 0) return MESSAGES.attendance.wrongContext(subjectName.trim());
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
  
  // 1. Insert local task
  const { data: task, error } = await uc.from('tasks').insert([{ profile_id: user.id, subject_id: subjectId, title, is_completed: false, priority: 'medium', due_date: dueDate }]).select().single();
  if (error) return MESSAGES.tasks.addError;

  // 2. Sync to Google Tasks if connected
  const googleToken = await getValidGoogleToken(user);
  if (googleToken) {
    try {
      await createGoogleTask(googleToken, task.title, "", task.due_date || undefined);
      console.log(`Successfully synced new task to Google Tasks for user: ${user.id}`);
    } catch (gErr) {
      console.error("Failed to sync new task to Google Tasks:", gErr);
    }
  }

  const dueStr = task.due_date ? MESSAGES.tasks.dueNote(new Date(task.due_date).toLocaleDateString('en-IN')) : '';
  return MESSAGES.tasks.addSuccess(task.title, dueStr);
}

async function handleCompleteTask(user, numberStr) {
  const idx = parseInt(numberStr, 10) - 1;
  const uc = await getUserClient(user.whatsapp_number);
  
  // 1. Try to fetch from the stored tasks list in the session
  const session = await getSession(user.whatsapp_number);
  const lastTasksList = session?.data?.lastTasksList || [];
  
  let targetTask = null;
  if (idx >= 0 && idx < lastTasksList.length) {
    targetTask = lastTasksList[idx];
  }

  if (targetTask) {
    // A. Sync to Google Tasks if Google Task ID exists
    if (targetTask.googleId) {
      const googleToken = await getValidGoogleToken(user);
      if (googleToken) {
        try {
          await updateGoogleTask(googleToken, targetTask.googleId, { completed: true });
          console.log(`Successfully completed task on Google Tasks: ${targetTask.googleId}`);
        } catch (gErr) {
          console.error("Failed to complete task on Google Tasks:", gErr);
        }
      }
    }

    // B. Sync local database
    if (targetTask.localId) {
      await uc.from('tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', targetTask.localId);
    } else {
      // If it was google-only, insert it locally as completed so we have a record
      await uc.from('tasks').insert([{
        profile_id: user.id,
        title: targetTask.title,
        is_completed: true,
        completed_at: new Date().toISOString(),
        due_date: targetTask.due || null,
        priority: 'medium'
      }]);
    }

    // Update session state
    const updatedList = lastTasksList.filter((_: any, i: number) => i !== idx);
    await setSession(user.whatsapp_number, session?.step || 'idle', {
      ...session?.data,
      lastTasksList: updatedList
    });

    return MESSAGES.tasks.doneSuccess(targetTask.title);
  }

  // 2. Fallback: query local database tasks directly (legacy flow)
  const { data: raw } = await uc.from('tasks').select('id, title, due_date, subject_id, subjects(type, source_course_id(semester_id))').eq('profile_id', user.id).eq('is_completed', false).order('due_date', { ascending: true, nullsFirst: false });
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
  
  const selectedLocalTask = tasks[idx];
  
  // Try to find and complete on Google Tasks by matching title and due date
  const googleToken = await getValidGoogleToken(user);
  if (googleToken) {
    try {
      const googleTasks = await fetchGoogleTasks(googleToken);
      const cleanLocalTitle = selectedLocalTask.title.replace("[Exam] ", "").trim().toLowerCase();
      const localDatePart = selectedLocalTask.due_date ? selectedLocalTask.due_date.split("T")[0] : null;

      const matchedGoogleTask = googleTasks.find((g: any) => {
        const cleanGoogleTitle = g.title?.replace("[Exam] ", "").trim().toLowerCase() || "";
        const gDatePart = g.due ? g.due.split("T")[0] : null;
        if (cleanLocalTitle !== cleanGoogleTitle) return false;
        if (!localDatePart && !gDatePart) return true;
        if (localDatePart && gDatePart) {
          return localDatePart === gDatePart;
        }
        return false;
      });

      if (matchedGoogleTask) {
        await updateGoogleTask(googleToken, matchedGoogleTask.id, { completed: true });
        console.log(`Successfully completed matched Google Task: ${matchedGoogleTask.id}`);
      }
    } catch (gErr) {
      console.error("Failed to complete matched Google task in fallback flow:", gErr);
    }
  }

  await uc.from('tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', selectedLocalTask.id);
  return MESSAGES.tasks.doneSuccess(selectedLocalTask.title);
}

async function handleListTasks(user) {
  const uc = await getUserClient(user.whatsapp_number);
  
  const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  
  // 1. Get local tasks (both incomplete and recently completed)
  const { data: raw } = await uc.from('tasks')
    .select('id, title, priority, due_date, is_completed, completed_at, subject_id, subjects(type, source_course_id(semester_id))')
    .eq('profile_id', user.id)
    .or(`is_completed.eq.false,completed_at.gt.${threeDaysAgoStr}`)
    .order('due_date', { ascending: true, nullsFirst: false });
  
  const buttons = [];
  if (user.academics_enabled) {
    buttons.push({ type: 'reply', reply: { id: 'log_menu', title: '✍️ Log Attendance' } });
    buttons.push({ type: 'reply', reply: { id: 'stats', title: '📊 Show Stats' } });
  } else {
    buttons.push({ type: 'reply', reply: { id: 'profile', title: '👤 Show Profile' } });
  }

  const localTasks = (raw || []).filter((t) => {
    if (!t.subject_id) return user.academics_enabled || user.personal_enabled;
    if (t.subjects?.type === 'academic' && !user.academics_enabled) return false;
    if (t.subjects?.type === 'personal' && !user.personal_enabled) return false;
    if (t.subjects?.type === 'academic') {
      const semId = Array.isArray(t.subjects.source_course_id) ? t.subjects.source_course_id[0]?.semester_id : t.subjects.source_course_id?.semester_id;
      return semId === user.current_semester_id;
    }
    return true;
  });

  // 2. Fetch and merge Google Tasks if connected
  let mergedTasks: { title: string; due?: string; priority?: string; source: 'google' | 'local' | 'both'; googleId?: string; localId?: string; completed: boolean; completedAt?: string }[] = [];
  const googleToken = await getValidGoogleToken(user);

  if (googleToken) {
    const googleTasks = await fetchGoogleTasks(googleToken);
    const matchedLocalIds = new Set<string>();

    googleTasks.forEach((g: any) => {
      const cleanGoogleTitle = g.title?.replace("[Exam] ", "").trim().toLowerCase() || "";
      const gDatePart = g.due ? g.due.split("T")[0] : null;

      const matched = localTasks.find((t: any) => {
        const cleanLocalTitle = t.title.replace("[Exam] ", "").trim().toLowerCase();
        if (cleanLocalTitle !== cleanGoogleTitle) return false;
        if (!t.due_date && !gDatePart) return true;
        if (t.due_date && gDatePart) {
          return t.due_date.split("T")[0] === gDatePart;
        }
        return false;
      });

      if (matched) {
        matchedLocalIds.add(matched.id);
        mergedTasks.push({
          title: g.title || matched.title,
          due: matched.due_date || g.due,
          priority: matched.priority || 'medium',
          source: 'both',
          googleId: g.id,
          localId: matched.id,
          completed: g.status === "completed" || matched.is_completed,
          completedAt: g.completed || matched.completed_at
        });
      } else {
        mergedTasks.push({
          title: g.title || "",
          due: g.due,
          priority: 'medium',
          source: 'google',
          googleId: g.id,
          completed: g.status === "completed",
          completedAt: g.completed
        });
      }
    });

    // Append unmatched local tasks
    localTasks.forEach((t: any) => {
      if (!matchedLocalIds.has(t.id)) {
        mergedTasks.push({
          title: t.title,
          due: t.due_date,
          priority: t.priority || 'medium',
          source: 'local',
          localId: t.id,
          completed: t.is_completed,
          completedAt: t.completed_at
        });
      }
    });
  } else {
    // If not connected to Google, just use local tasks
    mergedTasks = localTasks.map((t: any) => ({
      title: t.title,
      due: t.due_date,
      priority: t.priority || 'medium',
      source: 'local',
      localId: t.id,
      completed: t.is_completed,
      completedAt: t.completed_at
    }));
  }

  const incompleteTasks = mergedTasks.filter(t => !t.completed);
  const completedTasks = mergedTasks.filter(t => t.completed);

  // Take up to last 5 completed tasks
  const activeCompleted = completedTasks
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  if (incompleteTasks.length === 0 && activeCompleted.length === 0) {
    return {
      type: 'button',
      body: { text: MESSAGES.tasks.listCaughtUp },
      action: {
        buttons: buttons.slice(0, 3)
      }
    };
  }

  // 3. Store only incomplete tasks in session state so index complete works correctly
  const session = await getSession(user.whatsapp_number);
  await setSession(user.whatsapp_number, session?.step || 'idle', {
    ...session?.data,
    lastTasksList: incompleteTasks.map(t => ({ googleId: t.googleId, localId: t.localId, title: t.title, due: t.due }))
  });

  // Get current date string (YYYY-MM-DD) in user's timezone
  const userTimezone = user.timezone || 'Asia/Kolkata';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  const todayStr = `${year}-${month}-${day}`;

  const overdue: typeof mergedTasks = [];
  const todayTasks: typeof mergedTasks = [];
  const upcoming: typeof mergedTasks = [];

  incompleteTasks.forEach(t => {
    if (t.due) {
      const datePart = t.due.split("T")[0];
      if (datePart < todayStr) {
        overdue.push(t);
      } else if (datePart === todayStr) {
        todayTasks.push(t);
      } else {
        upcoming.push(t);
      }
    } else {
      upcoming.push(t);
    }
  });

  let msg = `📋 *Your Tasks* 📋\n`;
  let itemIndex = 1;

  if (overdue.length > 0) {
    msg += `\n🚨 *Overdue:*\n`;
    overdue.forEach(t => {
      const p = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority || 'medium'] || '🟡';
      msg += `${itemIndex}. ${p} ${t.title}${t.due ? ` (due ${new Date(t.due).toLocaleDateString('en-IN')})` : ''}\n`;
      itemIndex++;
    });
  }

  if (todayTasks.length > 0) {
    msg += `\n📅 *Today:*\n`;
    todayTasks.forEach(t => {
      const p = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority || 'medium'] || '🟡';
      msg += `${itemIndex}. ${p} ${t.title}\n`;
      itemIndex++;
    });
  }

  if (upcoming.length > 0) {
    msg += `\n🗓️ *Upcoming:*\n`;
    upcoming.forEach(t => {
      const p = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority || 'medium'] || '🟡';
      msg += `${itemIndex}. ${p} ${t.title}${t.due ? ` (due ${new Date(t.due).toLocaleDateString('en-IN')})` : ''}\n`;
      itemIndex++;
    });
  }

  if (activeCompleted.length > 0) {
    msg += `\n✅ *Completed (Recent):*\n`;
    activeCompleted.forEach(t => {
      msg += `- ~${t.title}~\n`;
    });
  }

  const text = msg + MESSAGES.tasks.listFooter(incompleteTasks.length, incompleteTasks.length !== 1);
  return {
    type: 'button',
    body: { text },
    action: {
      buttons: buttons.slice(0, 3)
    }
  };
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
  const text = user.academics_enabled && user.personal_enabled
    ? MESSAGES.general.helpBoth
    : user.personal_enabled
      ? MESSAGES.general.helpPersonal
      : MESSAGES.general.help;

  const buttons = [];
  buttons.push({ type: 'reply', reply: { id: 'tasks', title: '📋 Show Tasks' } });
  if (user.academics_enabled) {
    buttons.push({ type: 'reply', reply: { id: 'log_menu', title: '✍️ Log Attendance' } });
    buttons.push({ type: 'reply', reply: { id: 'stats', title: '📊 Show Stats' } });
  } else {
    buttons.push({ type: 'reply', reply: { id: 'profile', title: '👤 Show Profile' } });
  }

  return {
    type: 'button',
    body: { text },
    action: {
      buttons: buttons.slice(0, 3)
    }
  };
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

async function handleVerifyCode(phone: string, code: string) {
  if (!code) return "❌ Please specify the passcode. Example: `/verify 123456`";

  const now = new Date().toISOString();
  
  // 1. Find profile matching code that hasn't expired
  const { data: profile, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .eq('whatsapp_verification_code', code.trim())
    .gt('whatsapp_verification_expires_at', now)
    .maybeSingle();

  if (findError || !profile) {
    return "❌ Invalid or expired passcode. Please generate a new passcode on your dashboard settings page.";
  }

  // 2. Find if a temporary/placeholder profile exists for this phone number
  const { data: placeholder } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('whatsapp_number', phone)
    .neq('id', profile.id)
    .maybeSingle();

  if (placeholder) {
    // Delete any dependent rows of the placeholder profile to avoid foreign key violations
    await supabaseAdmin.from('study_timers').delete().eq('profile_id', placeholder.id);
    await supabaseAdmin.from('tasks').delete().eq('profile_id', placeholder.id);
    await supabaseAdmin.from('grades').delete().eq('profile_id', placeholder.id);
    await supabaseAdmin.from('attendance_logs').delete().eq('profile_id', placeholder.id);
    await supabaseAdmin.from('subjects').delete().eq('profile_id', placeholder.id);
    await supabaseAdmin.from('profiles').delete().eq('id', placeholder.id);
  }

  // 3. Clear the phone number from any other profiles to be safe
  await supabaseAdmin
    .from('profiles')
    .update({ whatsapp_number: null })
    .eq('whatsapp_number', phone)
    .neq('id', profile.id);

  // 4. Link the phone number to the target Google profile and start the 24h window
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      whatsapp_number: phone,
      whatsapp_verification_code: null,
      whatsapp_verification_expires_at: null,
      last_user_message_at: now
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error("Error linking WhatsApp:", updateError);
    return "❌ Failed to link your WhatsApp number. Please try again.";
  }

  return `✅ Success! Your WhatsApp number has been linked to profile *${profile.display_name}*. You will now receive reminders and logs here!`;
}

async function handleRespawn(user: any) {
  const RESPAWN_RESPONSES = [
    "🔋 *Ryu Medha RESPAWNED!* I'm back and fully charged. Let's conquer those tasks! 🚀",
    "⚡ *Connection Restored!* Did you miss me? Let's get back to work! 🎯",
    "🌟 *Rising from the ashes!* Your academic guardian is back online. What are we studying today? 📚",
    "🎮 *Respawn successful!* +100 Mana. Let's make today productive! 👾",
    "🔥 *Aaaand we're back!* The 24-hour clock has reset. Let's crush some goals! 💪",
    "🤖 *System reboot complete!* I've returned to keep you on track. ✨",
    "🦖 *Rawr!* Like a dinosaur that didn't go extinct, I'm back! Let's get things done. 🦕"
  ];
  const greeting = RESPAWN_RESPONSES[Math.floor(Math.random() * RESPAWN_RESPONSES.length)];

  // Fetch pending tasks
  const uc = await getUserClient(user.whatsapp_number);
  const { data: raw } = await uc.from('tasks')
    .select('title, priority, due_date, subject_id, subjects(type, source_course_id(semester_id))')
    .eq('profile_id', user.id)
    .eq('is_completed', false)
    .order('due_date', { ascending: true, nullsFirst: false });
    
  const tasks = raw?.filter((t: any) => {
    if (!t.subject_id) return user.academics_enabled || user.personal_enabled;
    if (t.subjects?.type === 'academic' && !user.academics_enabled) return false;
    if (t.subjects?.type === 'personal' && !user.personal_enabled) return false;
    if (t.subjects?.type === 'academic') {
      const semId = Array.isArray(t.subjects.source_course_id) ? t.subjects.source_course_id[0]?.semester_id : t.subjects.source_course_id?.semester_id;
      return semId === user.current_semester_id;
    }
    return true;
  }) || [];

  let taskSnippet = "";
  if (tasks.length > 0) {
    taskSnippet = `\n\n📋 *Your Pending Tasks (${tasks.length}):*\n`;
    tasks.slice(0, 3).forEach((t: any, i: number) => {
      const p = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority] || '🟡';
      taskSnippet += `${i + 1}. ${p} ${t.title}\n`;
    });
    if (tasks.length > 3) {
      taskSnippet += `...and ${tasks.length - 3} more.`;
    }
  } else {
    taskSnippet = "\n\n🎉 You're completely caught up! No pending tasks.";
  }

  const buttons = [
    { type: 'reply', reply: { id: 'tasks', title: '📋 Show All Tasks' } }
  ];
  if (user.academics_enabled) {
    buttons.push({ type: 'reply', reply: { id: 'log_menu', title: '✍️ Log Attendance' } });
    buttons.push({ type: 'reply', reply: { id: 'stats', title: '📊 Show Stats' } });
  } else {
    buttons.push({ type: 'reply', reply: { id: 'profile', title: '👤 Show Profile' } });
  }

  return {
    type: 'button',
    body: { text: `${greeting}${taskSnippet}` },
    action: {
      buttons: buttons.slice(0, 3)
    }
  };
}

// --- ROUTING ---
export async function processMessage(phone: string, text: string, metadata: { isInteractive: boolean } = { isInteractive: false }) {
  const lower = text.trim().toLowerCase();
  
  // 1. Allow verification command regardless of registration status
  if (lower.startsWith('verify ') || lower.startsWith('/verify ')) {
    const code = text.replace(/^\/?verify\s+/i, '').trim();
    return await handleVerifyCode(phone, code);
  }

  // 2. Check if user profile exists with this WhatsApp number
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', phone)
    .maybeSingle();

  if (!user) {
    return `👋 Welcome to *Ryu Medha*!\n\nIt looks like your WhatsApp number is not connected to any account yet. Please connect your WhatsApp first on the website to start using the bot!\n\nLink: ${WEBSITE_URL}/dashboard/whatsapp-bot`;
  }

  const uc = await getUserClient(phone);
  const session = await getSession(phone);
  const deps = { getUserClient, getOrCreateUser, updateProfile, createSubject, seedDefaultCategories, setSession, clearSession, WEBSITE_URL, supabaseAdmin, metadata };
  
  if (lower === 'ryuma respawn' || lower === '/ryuma respawn' || lower === 'respawn') {
    return await handleRespawn(user);
  }
  
  if (lower === 'setup' || lower === 'reset') { await updateProfile(phone, { display_name: PLACEHOLDER_NAME }); await clearSession(phone); return startOnboarding(phone, deps); }
  if (session && session.step !== 'idle') {
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
