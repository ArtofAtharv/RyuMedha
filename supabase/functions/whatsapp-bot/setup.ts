import { SETUP_MESSAGES } from './messages.ts';
export function startOnboarding(phone, deps) {
  deps.setSession(phone, 'awaiting_onboarding_choice', {});
  return SETUP_MESSAGES.welcome;
}
export async function handleOnboarding(user, session, rawText, deps) {
  const { step, data } = session;
  const text = rawText.trim();
  const phone = user.whatsapp_number;
  const uc = await deps.getUserClient(phone);
  const completeSetup = async (selectedIds = [], customName = null)=>{
    console.log(`🚀 [completeSetup] Phone: ${phone}, IDs: ${selectedIds}, Custom: ${customName}`);
    
    // Final profile update using admin client
    const { error: updateErr } = await deps.supabaseAdmin.from('profiles').update({
      academics_enabled: true,
      personal_enabled: data.wantsPersonal || false,
      current_university_id: data.universityId,
      current_program_id: data.programId,
      current_semester_id: data.semesterId,
      target_attendance_pct: data.targetPct,
      display_name: data.name // Ensure name is preserved
    }).eq('whatsapp_number', phone);
    
    if (updateErr) {
      console.error(`❌ [completeSetup] Profile update failed:`, updateErr);
    }

    // Re-fetch user to get the latest UUIDs and semester ID for createSubject
    const { data: freshUser } = await deps.supabaseAdmin.from('profiles').select('*').eq('whatsapp_number', phone).single();
    if (!freshUser) {
        console.error(`❌ [completeSetup] Could not re-fetch user!`);
        return SETUP_MESSAGES.onboardingComplete(data.name, data.universityName, data.programName, data.semesterName, data.targetPct);
    }

    const courses = data.availableCourses || [];
    for (const id of selectedIds){
      const course = courses.find((x)=>x.id == id);
      if (course) {
        console.log(`📚 Enrolling in course: ${course.course_name}`);
        await deps.createSubject(freshUser, course.course_name, 'academic');
      }
    }
    
    if (customName && customName.trim()) {
      console.log(`➕ Adding custom subject: ${customName}`);
      await deps.createSubject(freshUser, customName.trim(), 'academic');
    }
    
    if (data.wantsPersonal) await deps.seedDefaultCategories(phone);
    await deps.clearSession(phone);
    return SETUP_MESSAGES.onboardingComplete(data.name, data.universityName, data.programName, data.semesterName, data.targetPct);
  };

  if (step === 'awaiting_onboarding_choice') {
    const lower = text.toLowerCase();
    if (lower === 'setup_website' || [
      '2',
      'website',
      'web'
    ].includes(lower)) {
      await deps.updateProfile(phone, { academics_enabled: false, personal_enabled: false }); // Baseline profile
      await deps.clearSession(phone);
      return SETUP_MESSAGES.websiteSetup(deps.WEBSITE_URL);
    }
    if (lower === 'setup_here' || [
      '1',
      'here',
      'chat',
      'setup_here'
    ].includes(lower)) {
      await deps.setSession(phone, 'awaiting_name', { ...data });
      return SETUP_MESSAGES.askName;
    }
    return SETUP_MESSAGES.setupChoiceInvalid;
  }

  if (step === 'awaiting_name') {
    if (!text) return SETUP_MESSAGES.needsName;
    await deps.updateProfile(phone, {
      display_name: text
    });
    await deps.setSession(phone, 'awaiting_track_selection', {
      ...data,
      name: text
    });
    return [SETUP_MESSAGES.greet(text), SETUP_MESSAGES.chatSetup];
  }
  if (step === 'awaiting_track_selection') {
    const lower = text.toLowerCase();
    let track = null;
    if (lower === 'track_academic' || [
      '1',
      'academic'
    ].includes(lower)) track = 'academic';
    else if (lower === 'track_personal' || [
      '2',
      'personal'
    ].includes(lower)) track = 'personal';
    else if (lower === 'track_both' || [
      '3',
      'both'
    ].includes(lower)) track = 'both';
    if (!track) return SETUP_MESSAGES.trackChoiceInvalid;
    const wantsAcademic = track === 'academic' || track === 'both';
    const wantsPersonal = track === 'personal' || track === 'both';
    if (wantsPersonal && !wantsAcademic) {
      await deps.supabaseAdmin.from('profiles').update({
        personal_enabled: true,
        academics_enabled: false
      }).eq('whatsapp_number', phone);
      await deps.seedDefaultCategories(phone);
      await deps.clearSession(phone);
      return SETUP_MESSAGES.personalOnlySuccess;
    }
    
    // Persist track selection immediately
    await deps.supabaseAdmin.from('profiles').update({
      personal_enabled: wantsPersonal,
      academics_enabled: wantsAcademic
    }).eq('whatsapp_number', phone);

    const { data: unis } = await deps.supabaseAdmin.from('universities').select('id, name').order('name').limit(10);
    await deps.setSession(phone, 'awaiting_university', {
      ...data,
      track,
      wantsPersonal,
      unisList: unis || []
    });
    return (unis && unis.length > 0) ? SETUP_MESSAGES.universityPrompt(unis) : SETUP_MESSAGES.universityPromptFreeText;
  }
  if (step === 'awaiting_university') {
    let university;
    if (text.startsWith('uni_')) {
      const id = text.replace('uni_', '');
      university = (data.unisList || []).find((u)=>u.id == id);
    } else if (/^\d+$/.test(text)) {
      const idx = parseInt(text, 10) - 1;
      if (data.unisList?.[idx]) university = data.unisList[idx];
    }
    if (!university && text) {
      const { data: existing } = await deps.supabaseAdmin.from('universities').select('id, name').ilike('name', text.trim()).maybeSingle();
      if (existing) university = existing;
      else {
        const { data: created, error } = await deps.supabaseAdmin.from('universities').insert([
          {
            name: text.trim()
          }
        ]).select().single();
        if (error) return SETUP_MESSAGES.universityError;
        university = created;
      }
    }
    if (!university) return data.unisList && data.unisList.length > 0 ? SETUP_MESSAGES.universityPrompt(data.unisList) : SETUP_MESSAGES.universityPromptFreeText;
    
    // Persist university selection immediately
    await deps.supabaseAdmin.from('profiles').update({
      current_university_id: university.id
    }).eq('whatsapp_number', phone);

    const { data: progs } = await deps.supabaseAdmin.from('programs').select('id, name, default_target_attendance').eq('university_id', university.id).order('name').limit(10);
    await deps.setSession(phone, 'awaiting_program', {
      ...data,
      universityId: university.id,
      universityName: university.name,
      progsList: progs || []
    });
    return (progs && progs.length > 0) ? SETUP_MESSAGES.programPrompt(university.name, progs) : SETUP_MESSAGES.programPromptFreeText;
  }
  if (step === 'awaiting_program') {
    let program;
    if (text.startsWith('prog_')) {
      const id = text.replace('prog_', '');
      program = (data.progsList || []).find((p)=>p.id == id);
    } else if (/^\d+$/.test(text)) {
      const idx = parseInt(text, 10) - 1;
      if (data.progsList?.[idx]) program = data.progsList[idx];
    }
    if (!program && text) {
      const { data: existing } = await deps.supabaseAdmin.from('programs').select('id, name, default_target_attendance').eq('university_id', data.universityId).ilike('name', text.trim()).maybeSingle();
      if (existing) program = existing;
      else {
        const { data: created, error } = await deps.supabaseAdmin.from('programs').insert([
          {
            university_id: data.universityId,
            name: text.trim()
          }
        ]).select().single();
        if (error) return SETUP_MESSAGES.programError;
        program = created;
      }
    }
    if (!program) return data.progsList && data.progsList.length > 0 ? SETUP_MESSAGES.programPrompt(data.universityName, data.progsList) : SETUP_MESSAGES.programPromptFreeText;
    
    // Persist program selection immediately
    await deps.supabaseAdmin.from('profiles').update({
      current_program_id: program.id
    }).eq('whatsapp_number', phone);

    const { data: sems } = await deps.supabaseAdmin.from('semesters').select('id, semester_number, name').eq('program_id', program.id).order('semester_number');
    await deps.setSession(phone, 'awaiting_semester', {
      ...data,
      programId: program.id,
      programName: program.name,
      defaultTarget: program.default_target_attendance || 75,
      semsList: sems || []
    });
    return (sems && sems.length > 0) ? SETUP_MESSAGES.semesterPrompt(sems) : SETUP_MESSAGES.semesterPromptFallback;
  }
  if (step === 'awaiting_semester') {
    let semNum, semId, semName;
    if (text.startsWith('sem_')) {
      const id = text.replace('sem_', '');
      const s = (data.semsList || []).find((x)=>x.id == id);
      if (s) {
        semNum = s.semester_number;
        semId = s.id;
        semName = s.name || `Semester ${semNum}`;
      } else if (/^\d+$/.test(id)) {
        semNum = parseInt(id, 10);
        semName = `Semester ${semNum}`;
      }
    } else if (/^\d+$/.test(text)) {
      semNum = parseInt(text, 10);
      semName = `Semester ${semNum}`;
      const existing = (data.semsList || []).find((x)=>x.semester_number === semNum);
      if (existing) semId = existing.id;
    }
    if (!semNum) return data.semsList && data.semsList.length > 0 ? SETUP_MESSAGES.semesterPrompt(data.semsList) : SETUP_MESSAGES.semesterInvalid;
    let semesterId = semId;
    if (!semesterId) {
      const { data: existing } = await deps.supabaseAdmin.from('semesters').select('id').eq('program_id', data.programId).eq('semester_number', semNum).maybeSingle();
      if (existing) semesterId = existing.id;
      else {
        const { data: created, error } = await deps.supabaseAdmin.from('semesters').insert([
          {
            program_id: data.programId,
            semester_number: semNum,
            name: semName
          }
        ]).select().single();
        if (error) return SETUP_MESSAGES.semesterError;
        semesterId = created.id;
      }
    }
    // Persist semester selection immediately
    await deps.supabaseAdmin.from('profiles').update({
      current_semester_id: semesterId
    }).eq('whatsapp_number', phone);

    await deps.setSession(phone, 'awaiting_target_pct', {
      ...data,
      semesterId,
      semesterName: semName
    });
    return SETUP_MESSAGES.targetPrompt(data.defaultTarget);
  }
  if (step === 'awaiting_target_pct') {
    const match = text.match(/\d+(\.\d+)?/);
    const pct = match ? parseFloat(match[0]) : data.defaultTarget || 75;
    const { data: courses } = await deps.supabaseAdmin.from('academic_courses').select('id, course_name').eq('semester_id', data.semesterId).order('course_name').limit(20);
    await deps.setSession(phone, 'awaiting_subjects', {
      ...data,
      targetPct: pct,
      availableCourses: courses || [],
      selectedCourseIds: []
    });
    return courses && courses.length > 0 ? SETUP_MESSAGES.subjectSelectionPrompt(courses) : SETUP_MESSAGES.customSubjectPrompt;
  }
  if (step === 'awaiting_subjects') {
    const lower = text.toLowerCase();
    const courses = data.availableCourses || [];
    const notListedIdx = courses.length + 1;
    if (/^[\d\s,]+$/.test(text) && !/[a-zA-Z]/.test(text)) {
      const indices = text.split(/[\s,]+/).map((n)=>parseInt(n.trim(), 10)).filter((n)=>!isNaN(n));
      const selectedCourseIds = [];
      let needsCustom = false;
      for (const idx of indices){
        if (idx === notListedIdx) {
          needsCustom = true;
        } else if (idx > 0 && idx <= courses.length) {
          const course = courses[idx - 1];
          if (course) selectedCourseIds.push(course.id);
        }
      }
      if (needsCustom) {
        await deps.setSession(phone, 'awaiting_custom_subject_name', {
          ...data,
          selectedCourseIds
        });
        return SETUP_MESSAGES.customSubjectPrompt;
      } else if (selectedCourseIds.length > 0) {
        return await completeSetup(selectedCourseIds);
      }
    }
    // Manual custom add trigger
    if (lower.includes('not listed') || lower.includes('custom') || lower === 'subjects_add_custom' || lower.includes('➕')) {
      await deps.setSession(phone, 'awaiting_custom_subject_name', {
        ...data,
        selectedCourseIds: data.selectedCourseIds || []
      });
      return SETUP_MESSAGES.customSubjectPrompt;
    }
    return SETUP_MESSAGES.subjectSelectionPrompt(courses);
  }
  if (step === 'awaiting_custom_subject_name') {
    if (/^[\d\s,]+$/.test(text) && !/[a-zA-Z]/.test(text)) {
      session.step = 'awaiting_subjects';
      return await handleOnboarding(user, session, rawText, deps);
    }
    return await completeSetup(data.selectedCourseIds || [], text);
  }
  return null;
}
