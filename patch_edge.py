import re

p = 'supabase/functions/send-reminders/index.ts'
with open(p, 'r', encoding='utf-8') as f:
    code = f.read()

target = """      const taskTitle = task?.title || 'Unknown Task'
      let msg = `🔔 *Reminder: ${taskTitle}*\\n\\n`
      if (reminder.reminder_type === 'due_date') {
        msg += `This task is due today!`
      } else if (reminder.reminder_type === '1_day_prior') {
        msg += `This task is due tomorrow!`
      } else {
        msg += `Don't forget to complete this task!`
      }"""

replacement = """      const taskTitle = task?.title || 'Unknown Task'
      let dueStr = ""
      if (task?.due_date) {
        const d = new Date(task.due_date)
        dueStr = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
        dueStr += ` at ${timeStr}`
      }
      
      let msg = `🔔 *Reminder: ${taskTitle}*\\n\\n`
      if (dueStr) {
        msg += `Due: ${dueStr}`
      } else {
        msg += `Don't forget to complete this task!`
      }"""

new_code = code.replace(target, replacement)

with open(p, 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Edge Function Patched!")
