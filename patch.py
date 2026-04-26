import re

with open('web/app/dashboard/tasks/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add BellRing
code = code.replace(
    'import { CircleCheck, Clock, Trash2, Plus, Bell, Target, Calendar as CalIcon } from "lucide-react"',
    'import { CircleCheck, Clock, Trash2, Plus, Bell, BellRing, Target, Calendar as CalIcon } from "lucide-react"'
)

# 2. Main States
code = re.sub(
    r'const \[hasReminder, setHasReminder\] = useState\(false\)\s*const \[reminderTime, setReminderTime\] = useState\("09:00"\)',
    """const [dueTime, setDueTime] = useState("09:00")
  const [remindOnDue, setRemindOnDue] = useState(false)
  const [remind1Day, setRemind1Day] = useState(false)
  const [remindCustom, setRemindCustom] = useState(false)
  const [customHours, setCustomHours] = useState(2)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)""",
    code
)

# 3. Edit States
code = re.sub(
    r'const \[editHasReminder, setEditHasReminder\] = useState\(false\)\s*const \[editReminderTime, setEditReminderTime\] = useState\("09:00"\)',
    """const [editDueTime, setEditDueTime] = useState("09:00")
  const [editRemindOnDue, setEditRemindOnDue] = useState(false)
  const [editRemind1Day, setEditRemind1Day] = useState(false)
  const [editRemindCustom, setEditRemindCustom] = useState(false)
  const [editCustomHours, setEditCustomHours] = useState(2)""",
    code
)

# 4. Init block
code = re.sub(
    r'if \(profile\) setProfileId\(profile\.id\)',
    """if (profile) {
        setProfileId(profile.id)
        setPushEnabled(profile.push_notifications_enabled || false)
      }""",
    code
)

# 5. togglePushNotifications
toggle_func = """async function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  }

  async function togglePushNotifications() {
    try {
      setIsSubscribing(true)
      if (!pushEnabled) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          alert('Push notifications are not supported by your browser.')
          setIsSubscribing(false)
          return
        }
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          alert('Permission not granted for Notification')
          setIsSubscribing(false)
          return
        }
        const registration = await navigator.serviceWorker.register('/sw.js')
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) throw new Error("VAPID key not configured")
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: await urlB64ToUint8Array(vapidKey)
        })
        
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'subscribe', subscription })
        })
        setPushEnabled(true)
      } else {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) await subscription.unsubscribe()
        
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', subscription })
        })
        setPushEnabled(false)
      }
    } catch (e) {
      console.error(e)
      alert("Failed to toggle push notifications.")
    } finally {
      setIsSubscribing(false)
    }
  }

  async function fetchTasksAndSubjects"""

code = code.replace("async function fetchTasksAndSubjects", toggle_func)

# 6. Select Queries
code = code.replace(
    ".select('*, subjects(id, name, color_hex, type)')",
    ".select('*, subjects(id, name, color_hex, type), task_reminders(id, scheduled_for, reminder_type)')"
)

# 7. Add Task Logic
code = re.sub(
    r'const finalDate = dueDate \? getDateISO\(new Date\(dueDate\), hasReminder \? reminderTime : undefined\) : null.*?is_exam: false\s+\}\]\)',
    """const finalDate = dueDate ? getDateISO(new Date(dueDate), dueTime) : null
    
    const { data: newTask, error } = await supabaseClient
      .from('tasks')
      .insert([{
        profile_id: profileId,
        title: title.trim(),
        priority: priority,
        due_date: finalDate,
        subject_id: subjectId === "none" ? null : subjectId,
        has_reminder: remindOnDue || remind1Day || remindCustom,
        reminder_time: finalDate,
        is_completed: false,
        is_exam: false
      }]).select().single()

    if (newTask && finalDate) {
      const baseTime = new Date(finalDate).getTime()
      const rems = []
      if (remindOnDue) rems.push({ task_id: newTask.id, profile_id: profileId, scheduled_for: new Date(baseTime).toISOString(), reminder_type: 'due_date' })
      if (remind1Day) rems.push({ task_id: newTask.id, profile_id: profileId, scheduled_for: new Date(baseTime - 86400000).toISOString(), reminder_type: '1_day_prior' })
      if (remindCustom) rems.push({ task_id: newTask.id, profile_id: profileId, scheduled_for: new Date(baseTime - (customHours * 3600000)).toISOString(), reminder_type: 'custom_hours' })
      
      if (rems.length > 0) {
        await supabaseClient.from('task_reminders').insert(rems)
      }
    }""",
    code, flags=re.DOTALL
)

code = re.sub(
    r'setTitle\(""\)\s*setDueDate\(""\)\s*setPriority\("medium"\)\s*setSubjectId\("none"\)\s*setHasReminder\(false\)',
    """setTitle("")
    setDueDate("")
    setPriority("medium")
    setSubjectId("none")
    setRemindOnDue(false)
    setRemind1Day(false)
    setRemindCustom(false)
    setCustomHours(2)""",
    code
)

# 8. Edit Task Start Logic
code = re.sub(
    r'setEditHasReminder\(task\.has_reminder \|\| false\)\s*setEditSubjectId\(task\.subject_id \|\| "none"\)\s*if \(task\.reminder_time\) \{.*?\s*setEditReminderTime\("09:00"\)\s*\}',
    """setEditSubjectId(task.subject_id || "none")
    setEditRemindOnDue(false)
    setEditRemind1Day(false)
    setEditRemindCustom(false)
    setEditCustomHours(2)
    
    if (task.task_reminders) {
      task.task_reminders.forEach((r: any) => {
        if (r.reminder_type === 'due_date') setEditRemindOnDue(true)
        if (r.reminder_type === '1_day_prior') setEditRemind1Day(true)
        if (r.reminder_type === 'custom_hours') {
           setEditRemindCustom(true)
           if (task.due_date) {
             const diffMs = new Date(task.due_date).getTime() - new Date(r.scheduled_for).getTime()
             setEditCustomHours(Math.round(diffMs / 3600000))
           }
        }
      })
    }
    
    if (task.due_date) {
      const rt = new Date(task.due_date);
      setEditDueTime(`${rt.getHours().toString().padStart(2, '0')}:${rt.getMinutes().toString().padStart(2, '0')}`)
    } else {
      setEditDueTime("09:00")
    }""",
    code, flags=re.DOTALL
)

# 9. Edit Save Logic
code = re.sub(
    r'const finalDate = getDateISO\(editDueDate, editHasReminder \? editReminderTime : undefined\).*?\.eq\(\'id\', editingTaskId\)',
    """const finalDate = getDateISO(editDueDate, editDueTime)

    await supabaseClient
      .from('tasks')
      .update({
        title: editTitle.trim(),
        priority: editPriority,
        due_date: finalDate,
        subject_id: editSubjectId === "none" ? null : editSubjectId,
        has_reminder: editRemindOnDue || editRemind1Day || editRemindCustom,
        reminder_time: finalDate,
      })
      .eq('id', editingTaskId)
      
    await supabaseClient.from('task_reminders').delete().eq('task_id', editingTaskId)
    if (finalDate) {
      const baseTime = new Date(finalDate).getTime()
      const rems = []
      if (editRemindOnDue) rems.push({ task_id: editingTaskId, profile_id: profileId, scheduled_for: new Date(baseTime).toISOString(), reminder_type: 'due_date' })
      if (editRemind1Day) rems.push({ task_id: editingTaskId, profile_id: profileId, scheduled_for: new Date(baseTime - 86400000).toISOString(), reminder_type: '1_day_prior' })
      if (editRemindCustom) rems.push({ task_id: editingTaskId, profile_id: profileId, scheduled_for: new Date(baseTime - (editCustomHours * 3600000)).toISOString(), reminder_type: 'custom_hours' })
      
      if (rems.length > 0) {
        await supabaseClient.from('task_reminders').insert(rems)
      }
    }""",
    code, flags=re.DOTALL
)

# 10. Title Block
code = re.sub(
    r'<div>\s*<h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Tasks & Exams</span></h1>\s*<p className="text-muted-foreground mt-1">Keep track of your assignments, to-dos, and upcoming assessments\.</p>\s*</div>',
    """<div>
          <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Tasks & Exams</span></h1>
          <p className="text-muted-foreground mt-1">Keep track of your assignments, to-dos, and upcoming assessments.</p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0 sm:absolute sm:top-10 sm:right-6">
          <Button 
             variant={pushEnabled ? "default" : "outline"} 
             onClick={togglePushNotifications} 
             disabled={isSubscribing}
             className="gap-2 rounded-full h-9 shadow-sm text-xs font-semibold"
          >
            {pushEnabled ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            {pushEnabled ? "Push Enabled" : "Enable Push"}
          </Button>
        </div>""",
    code, flags=re.DOTALL
)

# 11. Add Form UI
code = re.sub(
    r'<div className="flex-1 flex flex-col sm:flex-row w-full justify-start sm:justify-end items-stretch sm:items-center gap-2 mb-0\.5 mt-2 sm:mt-0">.*?</Button>\s*</div>\s*</div>',
    """<div className="flex flex-col w-full gap-3 mt-2 sm:mt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-sm font-semibold text-muted-foreground mr-2">Reminders:</Label>
                    <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-md border border-muted-foreground/10">
                      <Button type="button" size="sm" variant={remindOnDue ? "default" : "ghost"} className="h-7 text-xs px-2" onClick={() => setRemindOnDue(!remindOnDue)}>On Due Date</Button>
                      <Button type="button" size="sm" variant={remind1Day ? "default" : "ghost"} className="h-7 text-xs px-2" onClick={() => setRemind1Day(!remind1Day)}>1 Day Prior</Button>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="sm" variant={remindCustom ? "default" : "ghost"} className="h-7 text-xs px-2 rounded-r-none border-r border-background/20" onClick={() => setRemindCustom(!remindCustom)}>Hours Prior:</Button>
                        <Input type="number" min="1" max="72" value={customHours} onChange={(e) => setCustomHours(Number(e.target.value))} className={`h-7 w-12 text-xs px-1 text-center rounded-l-none border-0 ${remindCustom ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`} disabled={!remindCustom} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end gap-3 w-full">
                    <div className="space-y-1.5 w-full sm:w-[120px]">
                      <Label htmlFor="duetime" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Due Time</Label>
                      <Input 
                        id="duetime" 
                        type="time" 
                        value={dueTime} 
                        onChange={(e) => setDueTime(e.target.value)} 
                        className="bg-background shadow-sm border-muted-foreground/20 h-10" 
                      />
                    </div>
                    <Button type="submit" className="h-10 px-8 font-semibold w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-2" /> Add Task
                    </Button>
                  </div>
                </div>""",
    code, flags=re.DOTALL, count=1
)

# 12. Edit UI Form
code = re.sub(
    r'\{editHasReminder && \(\s*<div className="space-y-1\.5">.*?<Bell className={`w-4 h-4 \$\{editHasReminder \? "fill-current" : ""\}`} />\s*\{editHasReminder \? "Reminder On" : "No Reminder"\}\s*</Button>',
    """<div className="space-y-2 mt-4 pt-2 border-t">
                    <Label className="text-xs font-semibold text-muted-foreground">Reminders</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant={editRemindOnDue ? "default" : "outline"} className="h-7 text-xs" onClick={() => setEditRemindOnDue(!editRemindOnDue)}>On Due Date</Button>
                      <Button size="sm" variant={editRemind1Day ? "default" : "outline"} className="h-7 text-xs" onClick={() => setEditRemind1Day(!editRemind1Day)}>1 Day Prior</Button>
                      <div className="flex items-center">
                        <Button size="sm" variant={editRemindCustom ? "default" : "outline"} className="h-7 text-xs rounded-r-none" onClick={() => setEditRemindCustom(!editRemindCustom)}>Hours Prior:</Button>
                        <Input type="number" min="1" max="72" value={editCustomHours} onChange={(e) => setEditCustomHours(Number(e.target.value))} className={`h-7 w-12 text-xs px-1 text-center rounded-l-none border-l-0 ${editRemindCustom ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`} disabled={!editRemindCustom} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <Label htmlFor="edit-duetime" className="text-xs font-semibold text-muted-foreground">Due Time</Label>
                    <Input 
                      id="edit-duetime" 
                      type="time" 
                      value={editDueTime} 
                      onChange={(e) => setEditDueTime(e.target.value)} 
                      className="bg-background" 
                    />
                  </div>""",
    code, flags=re.DOTALL
)


with open('web/app/dashboard/tasks/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("PYTHON_PATCH_DONE")
