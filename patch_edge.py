import re

p = 'supabase/functions/send-reminders/index.ts'
with open(p, 'r', encoding='utf-8') as f:
    code = f.read()

target = r"""      const taskTitle = task\?\.title \|\| 'Unknown Task'
      let dueStr = ""
      if \(task\?\.due_date\) \{
        const d = new Date\(task\.due_date\)
        dueStr = d\.toLocaleDateString\('en-US', \{ timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' \}\)
        const timeStr = d\.toLocaleTimeString\('en-US', \{ timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' \}\)
        dueStr \+= ` at \$\{timeStr\}`
      \}
      
      let msg = `🔔 \*Reminder: \$\{taskTitle\}\*\\n\\n`
      if \(dueStr\) \{
        msg \+= `Due: \$\{dueStr\}`
      \} else \{
        msg \+= `Don't forget to complete this task!`
      \}"""

replacement = """      const taskTitle = task?.title || 'Unknown Task'
      let dueStr = ""
      if (task?.due_date) {
        const d = new Date(task.due_date)
        
        // Helper to get YYYY-MM-DD in Asia/Kolkata
        const getKolkataDateStr = (date: Date) => {
          const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
          const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          const year = parts.find(p => p.type === 'year')?.value;
          return `${year}-${month}-${day}`;
        }

        const todayStr = getKolkataDateStr(new Date());
        const taskStr = getKolkataDateStr(d);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = getKolkataDateStr(tomorrow);

        let dayPrefix = ""
        if (taskStr === todayStr) dayPrefix = "Today"
        else if (taskStr === tomorrowStr) dayPrefix = "Tomorrow"
        
        const datePart = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
        
        dueStr = dayPrefix ? `${dayPrefix} (${datePart}) at ${timeStr}` : `${datePart} at ${timeStr}`
      }
      
      let msg = `🔔 *Reminder: ${taskTitle}*\n\n`
      if (dueStr) {
        msg += `Due: ${dueStr}`
      } else {
        msg += `Don't forget to complete this task!`
      }"""

# Since my previous patch might have been different or my manual regex is tricky, let's just look for the block.
# Actually, I'll use a simpler search since I know the previous state.
new_code = re.sub(target, replacement, code)

with open(p, 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Edge Function Patched with Today/Tomorrow logic!")
