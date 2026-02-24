const SETUP_MESSAGES = {
    welcome: `👋 Hi there! Welcome to *Ryu Medha* — I'm your new personal study assistant. 🎓\n\nI'm here to help you track your classes, manage your tasks, and keep an eye on your grades so you can focus on learning.\n\nTo get started, what should I call you? 😊`,
    needsName: `I'd love to know your name so I can set things up for you! 😊`,
    greet: (name) => ({
        type: 'button',
        body: { text: `It's great to meet you, *${name}*! 👋\n\nHow would you like to set up your profile?` },
        action: {
            buttons: [
                { type: 'reply', reply: { id: 'setup_here', title: 'Continue here' } },
                { type: 'reply', reply: { id: 'setup_website', title: 'Use the website' } }
            ]
        }
    }),
    setupChoiceInvalid: `Please use the buttons above to choose your setup method! 🖱️`,
    websiteSetup: (websiteUrl) => `Perfect! You can complete your setup on our dashboard here:\n\n${websiteUrl}/setup\n\nYour account is already waiting for you. Just log in with your WhatsApp number and I'll see you on the other side! 💻✨`,
    chatSetup: {
        type: 'button',
        body: { text: `Awesome, let's do it right here! ✍️\n\nWhat would you like to track with me?` },
        action: {
            buttons: [
                { type: 'reply', reply: { id: 'track_academic', title: 'Academics' } },
                { type: 'reply', reply: { id: 'track_personal', title: 'Personal' } },
                { type: 'reply', reply: { id: 'track_both', title: 'Both' } }
            ]
        }
    },
    trackChoiceInvalid: `Please use the buttons above to select what you'd like to track! 📚`,
    personalOnlySuccess: `All set! I've enabled *Personal Tracking* for you. ✨\n\nI've already added some common categories like "Creative Skills" and "Language Learning" to get you started. \n\n*Try telling me something like:*\n• "Add subject Spanish"\n• "Add category Photography"\n\nWhenever you need a hand, just type *help*! 🚀`,
    universityPrompt: (unis) => {
        const rows = unis.map(u => ({ id: `uni_${u.id}`, title: u.name.substring(0, 24) }));
        return {
            type: 'list',
            header: { type: 'text', text: '🏛️ University Selection' },
            body: { text: 'Which University do you attend?\n\n(Select from the list or just type the name below)' },
            footer: { text: 'Ryu Medha Onboarding' },
            action: {
                button: 'Select University',
                sections: [{ title: 'Top Universities', rows }]
            }
        };
    },
    universityPromptFreeText: `🏛️ *What is the name of your University?*\n\n(e.g., "Delhi University")`,
    universityError: `❌ Error saving university. Please try again.`,
    programPrompt: (uniName, progs) => {
        const rows = progs.map(p => ({ id: `prog_${p.id}`, title: p.name.substring(0, 24) }));
        return {
            type: 'list',
            header: { type: 'text', text: '🎓 Program Selection' },
            body: { text: `And what is your Program at ${uniName}?\n\n(Select from the list or just type the name below)` },
            footer: { text: 'Ryu Medha Onboarding' },
            action: {
                button: 'Select Program',
                sections: [{ title: 'Available Programs', rows }]
            }
        };
    },
    programPromptFreeText: `🎓 *What is the name of your Program?*\n\n(e.g., "B.Tech Computer Science" or "BA LLB")`,
    semesterPrompt: (sems) => {
        const rows = sems.map(s => ({ id: `sem_${s.id}`, title: s.name || `Semester ${s.semester_number}` }));
        return {
            type: 'list',
            header: { type: 'text', text: '📖 Semester Selection' },
            body: { text: 'Which Semester are you in?\n\n(Select from the list or just type the number below)' },
            footer: { text: 'Ryu Medha Onboarding' },
            action: {
                button: 'Select Semester',
                sections: [{ title: 'Available Semesters', rows }]
            }
        };
    },
    semesterInvalid: `Please enter a valid semester number, e.g. *4*.`,
    semesterError: `❌ Error saving semester.`,
    targetPrompt: (defaultTarget) => `🎯 *Attendance Goal*\n\nWhat's the minimum attendance percentage you're aiming for?\n${defaultTarget ? `_(Most students in your program aim for **${defaultTarget}%**)_` : ''}\n\n_(Just send me the number, like **75** or **85**)_`,
    subjectSelectionPrompt: (courses) => {
        const listText = courses.map((c, i) => `*${i + 1}*. ${c.course_name}`).join('\n');
        const nextNum = courses.length + 1;
        return `📚 *Select Your Courses*\n\nAvailable subjects:\n${listText}\n*${nextNum}*. ➕ Subject not listed\n\n💡 *Tip:* You can type multiple numbers (e.g. *1, 3, 4*) to add them all and finish setup instantly!`;
    },
    customSubjectPrompt: `➕ *What is the name of the subject you'd like to add?*`,
    onboardingComplete: (name, uni, prog, sem, goal) => `✨ *You're all set, ${name}!* ✨\n\nI've created your profile with these details:\n🏛️ *${uni}*\n🎓 *${prog}*\n📖 *${sem}*\n🎯 *Goal: ${goal}%*\n\n*You can now start managing your studies:*\n• "I went to class"\n• "How are my stats?"\n\nI'm here whenever you need me. Just type *help* if you ever get stuck. Let's make this semester great! 🚀🎓`,
    disambiguateType: {
        type: 'button',
        body: { text: `Please clarify: Is this an Academic or Personal subject?` },
        action: {
            buttons: [
                { type: 'reply', reply: { id: 'type_academic', title: 'Academic' } },
                { type: 'reply', reply: { id: 'type_personal', title: 'Personal' } }
            ]
        }
    },
};

function startOnboarding(phone, { setSession }) {
    setSession(phone, 'awaiting_name', {});
    return SETUP_MESSAGES.welcome;
}

async function handleOnboarding(user, session, rawText, deps) {
    const { step, data } = session;
    const text = rawText.trim();
    const phone = user.whatsapp_number;
    const uc = deps.getUserClient(phone);

    // Helper for final enrollment
    const completeSetup = async (selectedIds = [], customName = null) => {
        console.log(`🚀 [completeSetup] Phone: ${phone}, IDs: ${selectedIds}, Custom: ${customName}`);

        await deps.updateProfile(phone, {
            academics_enabled: true,
            personal_enabled: data.wantsPersonal || false,
            current_university_id: data.universityId,
            current_program_id: data.programId,
            current_semester_id: data.semesterId,
            target_attendance_pct: data.targetPct
        });

        const freshUser = await deps.getOrCreateUser(phone);
        const courses = data.availableCourses || [];

        // Enroll in selected academic courses
        for (const id of selectedIds) {
            const course = courses.find(x => x.id == id);
            if (course) await deps.createSubject(freshUser, course.course_name, 'academic');
        }

        // Add custom subject if one was provided in the next step or alongside
        if (customName && customName.trim()) {
            await deps.createSubject(freshUser, customName.trim(), 'academic');
        }

        if (data.wantsPersonal) await deps.seedDefaultCategories(phone);
        deps.clearSession(phone);
        return SETUP_MESSAGES.onboardingComplete(data.name, data.universityName, data.programName, data.semesterName, data.targetPct);
    };

    // ── Step 1: Name ─────────────────────────────────────────────────────────
    if (step === 'awaiting_name') {
        if (!text) return SETUP_MESSAGES.needsName;
        await deps.updateProfile(phone, { display_name: text });
        deps.setSession(phone, 'awaiting_setup_method', { name: text });
        return SETUP_MESSAGES.greet(text);
    }

    // ── Step 2: Setup choice ──────────────────────────────────────────────────
    if (step === 'awaiting_setup_method') {
        const lower = text.toLowerCase();
        if (lower === 'setup_website' || ['2', 'website', 'web'].includes(lower)) {
            deps.clearSession(phone);
            return SETUP_MESSAGES.websiteSetup(deps.WEBSITE_URL);
        }
        if (lower === 'setup_here' || ['1', 'here', 'chat', 'setup_here'].includes(lower)) {
            deps.setSession(phone, 'awaiting_track_selection', { ...data });
            return SETUP_MESSAGES.chatSetup;
        }
        return SETUP_MESSAGES.setupChoiceInvalid;
    }

    // ── Step 3: Track preference ──────────────────────────────────────────────
    if (step === 'awaiting_track_selection') {
        const lower = text.toLowerCase();
        let track = null;
        if (lower === 'track_academic' || ['1', 'academic'].includes(lower)) track = 'academic';
        else if (lower === 'track_personal' || ['2', 'personal'].includes(lower)) track = 'personal';
        else if (lower === 'track_both' || ['3', 'both'].includes(lower)) track = 'both';

        if (!track) return SETUP_MESSAGES.trackChoiceInvalid;

        const wantsAcademic = track === 'academic' || track === 'both';
        const wantsPersonal = track === 'personal' || track === 'both';

        if (wantsPersonal && !wantsAcademic) {
            await deps.updateProfile(phone, { personal_enabled: true, academics_enabled: false });
            await deps.seedDefaultCategories(phone);
            deps.clearSession(phone);
            return SETUP_MESSAGES.personalOnlySuccess;
        }

        const { data: unis } = await uc.from('universities').select('id, name').order('name').limit(10);
        deps.setSession(phone, 'awaiting_university', { ...data, track, wantsPersonal, unisList: unis || [] });
        return unis?.length ? SETUP_MESSAGES.universityPrompt(unis) : SETUP_MESSAGES.universityPromptFreeText;
    }

    // ── Step 4: University Selection ──────────────────────────────────────────
    if (step === 'awaiting_university') {
        let university;
        if (text.startsWith('uni_')) {
            const id = text.replace('uni_', '');
            university = (data.unisList || []).find(u => u.id == id);
        } else if (/^\d+$/.test(text)) {
            const idx = parseInt(text, 10) - 1;
            if (data.unisList?.[idx]) university = data.unisList[idx];
        }

        if (!university && text) {
            const { data: existing } = await uc.from('universities').select('id, name').ilike('name', text.trim()).maybeSingle();
            if (existing) university = existing;
            else {
                const { data: created, error } = await uc.from('universities').insert([{ name: text.trim() }]).select().single();
                if (error) return SETUP_MESSAGES.universityError;
                university = created;
            }
        }

        if (!university) return (data.unisList && data.unisList.length > 0) ? SETUP_MESSAGES.universityPrompt(data.unisList) : SETUP_MESSAGES.universityPromptFreeText;

        const { data: progs } = await uc.from('programs').select('id, name, default_target_attendance').eq('university_id', university.id).order('name').limit(10);
        deps.setSession(phone, 'awaiting_program', { ...data, universityId: university.id, universityName: university.name, progsList: progs || [] });
        return (progs && progs.length > 0) ? SETUP_MESSAGES.programPrompt(university.name, progs) : SETUP_MESSAGES.programPromptFreeText;
    }

    // ── Step 5: Program Selection ─────────────────────────────────────────────
    if (step === 'awaiting_program') {
        let program;
        if (text.startsWith('prog_')) {
            const id = text.replace('prog_', '');
            program = (data.progsList || []).find(p => p.id == id);
        } else if (/^\d+$/.test(text)) {
            const idx = parseInt(text, 10) - 1;
            if (data.progsList?.[idx]) program = data.progsList[idx];
        }

        if (!program && text) {
            const { data: existing } = await uc.from('programs').select('id, name, default_target_attendance').eq('university_id', data.universityId).ilike('name', text.trim()).maybeSingle();
            if (existing) program = existing;
            else {
                const { data: created, error } = await uc.from('programs').insert([{ university_id: data.universityId, name: text.trim() }]).select().single();
                if (error) return SETUP_MESSAGES.programError;
                program = created;
            }
        }

        if (!program) return (data.progsList && data.progsList.length > 0) ? SETUP_MESSAGES.programPrompt(data.universityName, data.progsList) : SETUP_MESSAGES.programPromptFreeText;

        const { data: sems } = await uc.from('semesters').select('id, semester_number, name').eq('program_id', program.id).order('semester_number');
        deps.setSession(phone, 'awaiting_semester', { ...data, programId: program.id, programName: program.name, defaultTarget: program.default_target_attendance || 75, semsList: sems || [] });
        return (sems && sems.length > 0) ? SETUP_MESSAGES.semesterPrompt(sems) : `📖 *Which semester are you in?* (e.g., type "1" or "5")`;
    }

    // ── Step 6: Semester Selection ──────────────────────────────────────────
    if (step === 'awaiting_semester') {
        let semNum, semId, semName;
        if (text.startsWith('sem_')) {
            const id = text.replace('sem_', '');
            const s = (data.semsList || []).find(x => x.id == id);
            if (s) { semNum = s.semester_number; semId = s.id; semName = s.name || `Semester ${semNum}`; }
        } else if (/^\d+$/.test(text)) {
            semNum = parseInt(text, 10);
            semName = `Semester ${semNum}`;
            const existing = (data.semsList || []).find(x => x.semester_number === semNum);
            if (existing) semId = existing.id;
        }

        if (!semNum) return (data.semsList && data.semsList.length > 0) ? SETUP_MESSAGES.semesterPrompt(data.semsList) : SETUP_MESSAGES.semesterInvalid;

        let semesterId = semId;
        if (!semesterId) {
            const { data: existing } = await uc.from('semesters').select('id').eq('program_id', data.programId).eq('semester_number', semNum).maybeSingle();
            if (existing) semesterId = existing.id;
            else {
                const { data: created, error } = await uc.from('semesters').insert([{ program_id: data.programId, semester_number: semNum, name: semName }]).select().single();
                if (error) return SETUP_MESSAGES.semesterError;
                semesterId = created.id;
            }
        }

        deps.setSession(phone, 'awaiting_target_pct', { ...data, semesterId, semesterName: semName });
        return SETUP_MESSAGES.targetPrompt(data.defaultTarget);
    }

    // ── Step 7: Target Percentage ────────────────────────────────────────────
    if (step === 'awaiting_target_pct') {
        const match = text.match(/\d+(\.\d+)?/);
        const pct = match ? parseFloat(match[0]) : (data.defaultTarget || 75);
        const { data: courses } = await uc.from('academic_courses').select('id, course_name').eq('semester_id', data.semesterId).order('course_name').limit(20);

        deps.setSession(phone, 'awaiting_subjects', { ...data, targetPct: pct, availableCourses: courses || [], selectedCourseIds: [] });
        return (courses && courses.length > 0) ? SETUP_MESSAGES.subjectSelectionPrompt(courses) : SETUP_MESSAGES.customSubjectPrompt;
    }

    // ── Step 8: Subject Selection ────────────────────────────────────────────
    if (step === 'awaiting_subjects') {
        const lower = text.toLowerCase();
        const courses = data.availableCourses || [];
        const notListedIdx = courses.length + 1;

        // Handling numeric selection (single or multi)
        if (/^[\d\s,]+$/.test(text) && !/[a-zA-Z]/.test(text)) {
            const indices = text.split(/[\s,]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
            const selectedCourseIds = [];
            let needsCustom = false;

            for (const idx of indices) {
                if (idx === notListedIdx) {
                    needsCustom = true;
                } else if (idx > 0 && idx <= courses.length) {
                    const course = courses[idx - 1];
                    if (course) selectedCourseIds.push(course.id);
                }
            }

            if (needsCustom) {
                deps.setSession(phone, 'awaiting_custom_subject_name', { ...data, selectedCourseIds });
                return SETUP_MESSAGES.customSubjectPrompt;
            } else if (selectedCourseIds.length > 0) {
                return await completeSetup(selectedCourseIds);
            }
        }

        // Manual custom add trigger
        if (lower.includes('not listed') || lower.includes('custom') || lower === 'subjects_add_custom') {
            deps.setSession(phone, 'awaiting_custom_subject_name', { ...data, selectedCourseIds: [] });
            return SETUP_MESSAGES.customSubjectPrompt;
        }

        return SETUP_MESSAGES.subjectSelectionPrompt(courses);
    }

    // ── Step 8b: Custom Subject Name ─────────────────────────────────────────
    if (step === 'awaiting_custom_subject_name') {
        // Safe guard: if they typed numbers here, they probably meant to pick more subjects
        if (/^[\d\s,]+$/.test(text) && !/[a-zA-Z]/.test(text)) {
            session.step = 'awaiting_subjects';
            return await handleOnboarding(user, session, rawText, deps);
        }

        return await completeSetup(data.selectedCourseIds || [], text);
    }

    return null;
}

module.exports = {
    startOnboarding,
    handleOnboarding
};
