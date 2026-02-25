export const WEBSITE_URL = Deno.env.get('WEBSITE_URL') || 'https://ryumedha.in';
export const MESSAGES = {
  subjects: {
    duplicate: (name, type)=>`Wait, it looks like *"${name}"* is already in your list! (${type} subject) 📚`,
    setupNeeded: `It looks like your academic profile isn't fully set up yet. Could you please run *setup* first? 😊`,
    error: `I ran into an issue setting up that subject for you. Could you try again?`,
    academicSuccess: (name)=>`Got it! I've added *"${name}"* to your academic list. 🎓`,
    addError: (name)=>`I'm sorry, I couldn't add *${name}* right now.`,
    personalSuccess: (name)=>`Got it! I've added *"${name}"* to your personal tracker. 💼\n\n💡 *What's next?*\n- Start a timer: *"start ${name}"*\n- Add a task: *"add task Practice ${name}"*\n- Explore more features on the *Dashboard:* ${WEBSITE_URL}`,
    addPrompt: `Please provide subject details.\nFormat: * add <subject name> * \nExample: * add Family Law I * `,
    typeNeeded: `Please provide the subject type as well.\nFormat: * add subject < name >, < 1 or 2 >*\n(1 = Academic, 2 = Personal)`,
    invalidType: (name)=>`❌ Invalid type for * ${name} *.Use 1(Academic) or 2(Personal).`,
    empty: `I don't see any subjects in your list yet. 📚\n\nWant to add one? Just say *"Add Family Law I"*.`,
    emptySemester: `I don't see any subjects for your current semester yet. 📖\n\nYou can add one by telling me the name.`,
    listHeader: `📚 * Your Enrolled Subjects:*\n`,
    listAcademic: `\n🎓 * Academic:*\n`,
    listPersonal: `\n💼 * Personal:*\n`,
    listFooter: (count, plural)=>`\nYou're currently tracking **${count}** subject${plural ? 's' : ''}. 🎓`,
    deletePrompt: `Please provide a subject name.\nExample: * Delete Contracts Law II * `,
    notFound: (name)=>`I couldn't find a subject named *"${name}"* in your active list. 📚`,
    ambiguity: (name, options)=>`I found multiple matches for *"${name}"*: \n\n${options}\n\nWhich one did you mean? 🤔`,
    wrongContext: (name)=>`I found *"${name}"*, but it doesn't seem to be in your current semester context. 📖`,
    deleteError: `I'm sorry, I couldn't remove that subject for now. Please try again!`,
    deleteSuccess: (name)=>`Done! I've removed *${name}* from your active list. 🗑️`,
    renamePrompt: `Format: *Rename <old> to <new>*\nExample: *Rename Family Law I to Family Law II*`,
    renameSuccess: (oldName, newName)=>`Consider it done! I've renamed *"${oldName}"* to *"${newName}"*. ✏️`,
    renameError: `I'm sorry, I couldn't rename that subject. Please ensure the new name is unique and try again!`,
    archiveSuccess: (count)=>`📦 *Semester Archived!*\n\nI've soft-archived your **${count}** academic subjects and cleared your current semester setup. \n\nYour past attendance and grades are all safely stored! When you're ready to start your next semester, just tell me *"setup"* and we'll get you ready for the new classes. 🎓🚀`,
    archiveError: `I'm sorry, I couldn't archive your semester subjects right now. Please try again later!`,
    setupLecturesSuccess: (name, type, val)=>`Updated! *${name}* now has ${val} ${type === 'total' ? 'total' : 'missed'} lectures. ✍️`
  },
  categories: {
    prompt: `🎨 *Add Category*\n\nPlease provide a name for your new category.\nExample: *add category Music*`,
    duplicate: (name)=>`⚠️ The category *"${name}"* already exists!`,
    success: (name)=>`✅ Category *"${name}"* created! \n\n💡 Next step: Try adding a subject to it!\nExample: *Add subject Piano to Category ${name}*`,
    error: `❌ I couldn't create that category right now.`,
    empty: `📂 You don't have any custom categories yet.`,
    listHeader: (count)=>`📂 *Your Categories (${count}):*\n\n`,
    deletePrompt: `🗑️ Please provide the category name to delete.`,
    notFound: (name)=>`❌ Category *"${name}"* not found.`,
    inUse: (name, count)=>`⚠️ Cannot delete *"${name}"* because it contains ${count} subject(s).`,
    deleteError: `❌ I couldn't delete that category.`,
    deleteSuccess: (name)=>`🗑️ Deleted category *"${name}"*.`
  },
  attendance: {
    notFound: (name)=>`I couldn't find a subject named *"${name}"* in your list. 📚`,
    wrongContext: (name)=>`I found *"${name}"*, but it doesn't seem to be in your current semester context. 📖`,
    academicOnly: (name)=>`I noticed *${name}* is a personal subject. I only track attendance for your academic classes! 🎓\n\nYou can track personal subjects using *Dashboard* ${WEBSITE_URL} `,
    alreadyMarked: (name, status)=>`You've already marked *${name}* as *${status}* for today! 😊`,
    error: (name)=>`I'm sorry, I couldn't mark your attendance for *${name}* right now. Please try again! or use *Dashboard* ${WEBSITE_URL} to mark attendance`,
    presentPrefix: (name)=>`Great job! I've marked you present for *${name}*. 🎓\n\n`,
    absentPrefix: (name)=>`Got it. I've marked you absent for *${name}*. ✍️\n\n`,
    deemedPrefix: (name)=>`Got deemed attendance? No problem, I've marked *${name}* as deemed! 🏖️\n\n`,
    summaryNoData: (name)=>`${name}: 0 classes so far.`,
    summaryLine: (emoji, name, attended, total, pct)=>`${emoji} * ${name}*: ${attended}/${total} (${pct}%)`,
    deemedNote: (count)=>` _(incl. ${count} deemed)_`,
    bunksLeft: (count, plural)=>`\n💡 You can still skip *${count}* class${plural ? 'es' : ''} and stay on your goal!`,
    onTrackTip: (count, plural, target)=>`\n💡 You should attend the next **${count}** class${plural ? 'es' : ''} to reach your ${target}% goal.`,
    trackWarning: (count, plural)=>`\n🚨 Warning: You need to attend the next **${count}** class${plural ? 'es' : ''} to get back on track!`,
    allSuccess: (status, count)=>`Done! Marked **${count}** subjects as *${status}* for today. 🗓️`,
    undoSuccess: (name)=>`🔄 Removed today's log for *${name}*.`,
    undoAllSuccess: `🔄 Done! Removed all attendance logs for today.`,
    undoError: `❌ I couldn't find any attendance to undo for today.`,
    attendedPrompt: `📚 *Mark Present*\n\nPlease provide the name of the subject(s) you attended.\nExample: *attended Math, Physics*`,
    missedPrompt: `✍️ *Mark Absent*\n\nPlease provide the name of the subject(s) you missed.\nExample: *missed Law*`,
    deemedPrompt: `🏖️ *Mark Deemed*\n\nPlease provide the name of the subject(s) that were cancelled or had deemed attendance.\nExample: *deemed Constitutional Law*`,
    undoPrompt: `🔄 *Undo Attendance*\n\nPlease provide the name of the subject you want to undo for today.\nExample: *undo Law*`
  },
  stats: {
    academicOnly: `I only track attendance stats for academic subjects! 📊`,
    noSubjects: `You haven't added any academic subjects for this semester yet! 📊🎓\n\nYou can add one by saying *"Add Family Law I"*.`,
    header: (target)=>`📊 *Attendance Stats (Target: ${target}%):*\n\n`,
    noDataEmoji: `⬜`,
    noDataNote: `No data yet`,
    empty: `I don't have any attendance logs for your subjects yet! 📊\n\nTry telling me something like *"I attended Constitutional Law I"* to get started.`
  },
  timers: {
    startPrompt: `Please provide a subject name.\nExample: *Start timer for Contract Law I*`,
    alreadyRunning: (name)=>`⚠️ You already have an active timer for *${name || 'a subject'}*.\n\nPlease reply with *stop* before starting a new one.`,
    notFound: (name)=>`❌ Subject *"${name}"* not found.\n\nView subjects: *subjects*`,
    wrongContext: (name)=>`❌ Subject *"${name}"* exists but is not in your current semester context.\n\n View subjects: *subjects*`,
    startError: `I'm sorry, I couldn't start the timer. Could you try again?`,
    started: (name)=>`⏱️ *Study session started for ${name}!*\n\nI'll keep track of the time for you. Just tell me *"stop"* when you're finished! 💪\n\n Or check the live timer on the *Dashboard:* ${WEBSITE_URL}`,
    noActive: `ℹ️ You don't have an active timer.`,
    stopError: `I'm sorry, I couldn't stop the timer. Could you try again?`,
    stopped: (name, hrs, mins)=>`⏹️ *Great focus!* You've finished your session for *${name || 'Subject'}*.\n\n⏱️ Duration: **${hrs}h ${mins}m**\nI've saved this to your study history. Take a well-deserved break! 💪✨\n\nYou can view your study history on the *Dashboard:* ${WEBSITE_URL}`
  },
  tasks: {
    addPrompt: `Please provide a task title.\nExample: *add task Assignment 1 due on 13th march, 2026*`,
    addError: `I'm sorry, I couldn't add that task for you right now.`,
    addSuccess: (title, dueStr)=>`Consider it done! I've added *"${title}"*${dueStr} to your Tasks. ✅`,
    dueNote: (date)=>` (due ${date})`,
    donePrompt: `Please provide a valid task number.\nExample: *Mark task 1 as complete*`,
    empty: `You don't have any pending tasks right now! 📋`,
    notFound: (id, count)=>`I couldn't find task #${id} in your list. You have ${count} task(s) pending.`,
    doneError: `I'm sorry, I couldn't mark that task as finished.`,
    doneSuccess: (title)=>`Nice work! I've checked off *"${title}"* for you. 🎉💪`,
    listCaughtUp: `You're all caught up! You have no pending tasks right now. 📋✨`,
    listHeader: (count)=>`📋 *Pending Tasks (${count}):*\n\n`,
    listFooter: (count, plural)=>`\nYou have **${count}** task${plural ? 's' : ''} to work on. You've got this! 💪`,
    emptySemester: `📋 No pending tasks for the current semester!`
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
    profileName: (name)=>`*User Name:* ${name}\n`,
    profilePersonal: `*Personal subjects Tracking:* Active\n`,
    profileAcademic: `*Academic subjects Tracking:* Active\n`,
    profileTarget: (pct)=>`*Target Attendance:* ${pct}%\n`,
    profileUniversity: (uni)=>`*University:* ${uni}\n`,
    profileProgram: (prog)=>`*Program:* ${prog}\n`,
    profileSemester: (sem)=>`*Semester:* ${sem}\n`,
    profileFooter: `\nIf you ever need to change any of this, just say *"setup"*!`,
    unknown: `Hmm, I'm not sure I understood that correctly. 🤔\n\nYou can say *"help"* to see some of the things you can ask me!`,
    error: `❌ Something went wrong. Please try again.\n\nIf this keeps happening, use  ${WEBSITE_URL} to complete the task.`
  }
};
export const SETUP_MESSAGES = {
  welcome: `👋 Hi there! Welcome to *Ryu Medha* — I'm your new personal study assistant. 🎓\n\nI'm here to help you track your classes, manage your tasks, and keep an eye on your grades so you can focus on learning.\n\nTo get started, what should I call you? 😊`,
  needsName: `I'd love to know your name so I can set things up for you! 😊`,
  greet: (name)=>({
      type: 'button',
      body: {
        text: `It's great to meet you, *${name}*! 👋\n\nHow would you like to set up your profile?`
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'setup_here',
              title: 'Continue here'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'setup_website',
              title: 'Use the website'
            }
          }
        ]
      }
    }),
  setupChoiceInvalid: `Please use the buttons above to choose your setup method! 🖱️`,
  websiteSetup: (websiteUrl)=>`Perfect! You can complete your setup on our dashboard here:\n\n${websiteUrl}/setup\n\nYour account is already waiting for you. Just log in with your WhatsApp number and I'll see you on the other side! 💻✨`,
  chatSetup: {
    type: 'button',
    body: {
      text: `Awesome, let's do it right here! ✍️\n\nWhat would you like to track with me?`
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'track_academic',
            title: 'Academics'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'track_personal',
            title: 'Personal'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'track_both',
            title: 'Both'
          }
        }
      ]
    }
  },
  trackChoiceInvalid: `Please use the buttons above to select what you'd like to track! 📚`,
  personalOnlySuccess: `All set! I've enabled *Personal Tracking* for you. ✨\n\nI've already added some common categories like "Creative Skills" and "Language Learning" to get you started. \n\n*Try telling me something like:*\n• "Add subject Spanish"\n• "Add category Photography"\n\nWhenever you need a hand, just type *help*! 🚀`,
  universityPrompt: (unis)=>{
    const rows = unis.map((u)=>({
        id: `uni_${u.id}`,
        title: u.name.substring(0, 24)
      }));
    return {
      type: 'list',
      header: {
        type: 'text',
        text: '🏛️ University Selection'
      },
      body: {
        text: 'Which University do you attend?\n\n(Select from the list or just type the name below)'
      },
      footer: {
        text: 'Ryu Medha Onboarding'
      },
      action: {
        button: 'Select University',
        sections: [
          {
            title: 'Top Universities',
            rows
          }
        ]
      }
    };
  },
  universityPromptFreeText: `🏛️ *What is the name of your University?*\n\n(e.g., "Delhi University")`,
  universityError: `❌ Error saving university. Please try again.`,
  programPrompt: (uniName, progs)=>{
    const rows = progs.map((p)=>({
        id: `prog_${p.id}`,
        title: p.name.substring(0, 24)
      }));
    return {
      type: 'list',
      header: {
        type: 'text',
        text: '🎓 Program Selection'
      },
      body: {
        text: `And what is your Program at ${uniName}?\n\n(Select from the list or just type the name below)`
      },
      footer: {
        text: 'Ryu Medha Onboarding'
      },
      action: {
        button: 'Select Program',
        sections: [
          {
            title: 'Available Programs',
            rows
          }
        ]
      }
    };
  },
  programPromptFreeText: `🎓 *What is the name of your Program?*\n\n(e.g., "B.Tech Computer Science" or "BA LLB")`,
  programError: `❌ Error saving program. Please try again.`,
  semesterPrompt: (sems)=>{
    const rows = sems.map((s)=>({
        id: `sem_${s.id}`,
        title: s.name || `Semester ${s.semester_number}`
      }));
    return {
      type: 'list',
      header: {
        type: 'text',
        text: '📖 Semester Selection'
      },
      body: {
        text: 'Which Semester are you in?\n\n(Select from the list or just type the number below)'
      },
      footer: {
        text: 'Ryu Medha Onboarding'
      },
      action: {
        button: 'Select Semester',
        sections: [
          {
            title: 'Available Semesters',
            rows
          }
        ]
      }
    };
  },
  semesterInvalid: `Please enter a valid semester number, e.g. *4*.`,
  semesterError: `❌ Error saving semester.`,
  semesterPromptFallback: {
    type: 'list',
    header: { type: 'text', text: '📖 Semester Selection' },
    body: { text: 'Which Semester are you in?\n\n(Select from the list or just type the number below)' },
    footer: { text: 'Ryu Medha Onboarding' },
    action: {
        button: 'Select Semester',
        sections: [{ 
            title: 'Common Semesters', 
            rows: [
                { id: 'sem_1', title: 'Semester 1' },
                { id: 'sem_2', title: 'Semester 2' },
                { id: 'sem_3', title: 'Semester 3' },
                { id: 'sem_4', title: 'Semester 4' },
                { id: 'sem_5', title: 'Semester 5' },
                { id: 'sem_6', title: 'Semester 6' },
                { id: 'sem_7', title: 'Semester 7' },
                { id: 'sem_8', title: 'Semester 8' }
            ]
        }]
    }
  },
  semesterPromptFreeText: `📖 *Which semester are you in?* (e.g., type "1" or "5")`,
  targetPrompt: (defaultTarget)=>`🎯 *Attendance Goal*\n\nWhat's the minimum attendance percentage you're aiming for?\n${defaultTarget ? `_(Most students in your program aim for **${defaultTarget}%**)_` : ''}\n\n_(Just send me the number, like **75** or **85**)_`,
  subjectSelectionPrompt: (courses)=>{
    const listText = courses.map((c, i)=>`*${i + 1}*. ${c.course_name}`).join('\n');
    const nextNum = courses.length + 1;
    return `📚 *Select Your Courses*\n\nAvailable subjects:\n${listText}\n*${nextNum}*. ➕ Subject not listed\n\n💡 *Tip:* You can type multiple numbers (e.g. *1, 3, 4*) to add them all and finish setup instantly!`;
  },
  customSubjectPrompt: `➕ *What is the name of the subject you'd like to add?*`,
  onboardingComplete: (name, uni, prog, sem, goal)=>`✨ *You're all set, ${name}!* ✨\n\nI've created your profile with these details:\n🏛️ *${uni}*\n🎓 *${prog}*\n📖 *${sem}*\n🎯 *Goal: ${goal}%*\n\n*You can now start managing your studies:*\n• "I went to class"\n• "How are my stats?"\n\nI'm here whenever you need me. Just type *help* if you ever get stuck. Let's make this semester great! 🚀🎓`,
  disambiguateType: {
    type: 'button',
    body: {
      text: `Please clarify: Is this an Academic or Personal subject?`
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'type_academic',
            title: 'Academic'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'type_personal',
            title: 'Personal'
          }
        }
      ]
    }
  }
};
