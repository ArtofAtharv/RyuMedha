"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CircleCheck, Clock, Trash2, Plus, Bell, BellRing, Target, Calendar as CalIcon } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProfile } from '@/components/dashboard/profile-context'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import { format, parseISO } from "date-fns"

const pColors = {
  high: "bg-orange-500",
  medium: "bg-blue-500", 
  low: "bg-green-500",
  urgent: "bg-red-500"
}

export default function TasksPage() {
  const { profile } = useProfile()
  const [tasks, setTasks] = useState<any[]>([])
  const [completedTasks, setCompletedTasks] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [subjectId, setSubjectId] = useState("none")
  const [dueTime, setDueTime] = useState("09:00")
  const [remindOnDue, setRemindOnDue] = useState(false)
  const [remind1Day, setRemind1Day] = useState(false)
  const [remindCustom, setRemindCustom] = useState(false)
  const [customHours, setCustomHours] = useState(2)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  
  // Filter State
  const [filterType, setFilterType] = useState("all") // all, exams, generic

  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  
  // Edit State
  const [editingTaskId, setEditingTaskId] = useState<string|null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editPriority, setEditPriority] = useState("medium")
  const [editDueDate, setEditDueDate] = useState<Date | null>(null)
  const [editSubjectId, setEditSubjectId] = useState("none")
  const [editDueTime, setEditDueTime] = useState("09:00")
  const [editRemindOnDue, setEditRemindOnDue] = useState(false)
  const [editRemind1Day, setEditRemind1Day] = useState(false)
  const [editRemindCustom, setEditRemindCustom] = useState(false)
  const [editCustomHours, setEditCustomHours] = useState(2)
  const [isAddDatePickerOpen, setIsAddDatePickerOpen] = useState(false)
  const [isEditDatePickerOpen, setIsEditDatePickerOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const session = await getSession()
      if (!session) return
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
      )
      
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, push_notifications_enabled')
        .eq('whatsapp_number', session.user.phone)
        .single()
        
      if (profile) {
        setProfileId(profile.id)
        setPushEnabled(profile.push_notifications_enabled || false)
      }

      await fetchTasksAndSubjects(supabase, profile?.id)
    }
    init()
  }, [])

  async function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
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
        await navigator.serviceWorker.register('/sw.js')
        const registration = await navigator.serviceWorker.ready
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

  async function fetchTasksAndSubjects(supabase: any, pid: string | null) {
    if (!pid) return
    setLoading(true)
    
    const { data: rawSubs } = await supabase
      .from('subjects')
      .select('id, name, color_hex, type, source_course_id(semester_id)')
      .eq('profile_id', pid)
      .eq('is_active', true)
      .order('name')

    const subs = rawSubs?.filter((s: any) => {
      if (s.type === 'personal') return true
      const semId = Array.isArray(s.source_course_id) 
        ? s.source_course_id[0]?.semester_id 
        : (s.source_course_id as any)?.semester_id
      return semId === profile?.current_semester_id
    }) || []
    setSubjects(subs)

    const { data: pending } = await supabase
      .from('tasks')
      .select('*, subjects(id, name, color_hex, type), task_reminders(id, scheduled_for, reminder_type)')
      .eq('profile_id', pid)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      
    const { data: done } = await supabase
      .from('tasks')
      .select('*, subjects(id, name, color_hex, type), task_reminders(id, scheduled_for, reminder_type)')
      .eq('profile_id', pid)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(10)

    const validSubjectIds = new Set(subs.map((s: any) => s.id))
    
    setTasks((pending || []).filter((t: any) => t.subject_id === null || validSubjectIds.has(t.subject_id)))
    setCompletedTasks((done || []).filter((t: any) => t.subject_id === null || validSubjectIds.has(t.subject_id)))
    setLoading(false)
  }

  // Helper to reliably parse local date string 'YYYY-MM-DD' into a stable UTC ISO string for DB
  // This expects the Date object direct from the datepicker now.
  function getDateISO(date: Date | null, timeString?: string) {
    if (!date) return null
    // Offset local timezone so midnight is preserved perfectly
    const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
    const dateStr = offsetDate.toISOString().split('T')[0]
    
    if (timeString) {
      // Create a full localized Date passing both components
      // This will ensure it creates a valid UTC ISO string for DB
      return new Date(`${dateStr}T${timeString}:00`).toISOString()
    }
    return dateStr
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const finalDate = dueDate ? getDateISO(new Date(dueDate), dueTime) : null
    
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
    }

    setTitle("")
    setDueDate("")
    setPriority("medium")
    setSubjectId("none")
    setRemindOnDue(false)
    setRemind1Day(false)
    setRemindCustom(false)
    setCustomHours(2)
    fetchTasksAndSubjects(supabaseClient, profileId)
  }

  async function toggleComplete(task: any) {
    await supabaseClient
      .from('tasks')
      .update({ 
        is_completed: !task.is_completed, 
        completed_at: !task.is_completed ? new Date().toISOString() : null 
      })
      .eq('id', task.id)
    fetchTasksAndSubjects(supabaseClient, profileId)
  }

  function startEdit(task: any) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditPriority(task.priority)
    setEditSubjectId(task.subject_id || "none")
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
    }

    if (task.due_date) {
      // Use offset date creation to correctly set local time
      const components = task.due_date.split('T')[0].split('-')
      if (components.length === 3) {
        setEditDueDate(new Date(parseInt(components[0]), parseInt(components[1]) - 1, parseInt(components[2])))
      } else {
        setEditDueDate(new Date(task.due_date))
      }
    } else {
      setEditDueDate(null)
    }
  }

  async function saveEdit() {
    if (!editingTaskId || !editTitle.trim()) return

    const finalDate = getDateISO(editDueDate, editDueTime)

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
    }

    setEditingTaskId(null)
    fetchTasksAndSubjects(supabaseClient, profileId)
  }

  async function deleteTask(id: string) {
    await supabaseClient.from('tasks').delete().eq('id', id)
    fetchTasksAndSubjects(supabaseClient, profileId)
  }

  const pColors: any = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 relative">
        <div>
          <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Tasks & Exams</span></h1>
          <p className="text-muted-foreground mt-1">Keep track of your assignments, to-dos, and upcoming assessments.</p>
        </div>
        
        <div className="flex items-center gap-2 mt-4 sm:mt-0 w-full sm:w-auto">
          <Button 
             variant={pushEnabled ? "default" : "outline"} 
             onClick={togglePushNotifications} 
             disabled={isSubscribing}
             className="gap-2 rounded-full h-10 shadow-sm text-xs font-semibold shrink-0"
          >
            {pushEnabled ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            {pushEnabled ? "Push Enabled" : "Enable Push"}
          </Button>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="flex-1 sm:w-[180px] h-10 bg-background shadow-sm border-muted-foreground/20">
              <SelectValue placeholder="View All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">View All</SelectItem>
              <SelectItem value="exams">Exams</SelectItem>
              <SelectItem value="generic">Tasks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Quick Add Form */}
        <Card className="bg-muted/30 border-dashed border-2">
          <CardContent className="p-4">
            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1.5 w-full sm:flex-1">
                  <Label htmlFor="title" className="text-sm font-semibold text-muted-foreground">What needs doing?</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read Chapter 5" required className="bg-background shadow-sm border-muted-foreground/20 h-10" />
                </div>
                
                <div className="space-y-1.5 w-full sm:w-1/3">
                  <Label htmlFor="subject" className="text-sm font-semibold text-muted-foreground">Subject Link</Label>
                  <div className="w-full">
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger className="h-10 bg-background shadow-sm border-muted-foreground/20 w-full">
                      <SelectValue placeholder="No Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Subject</SelectItem>
                      {subjects
                        .filter(s => (s.type === 'academic' && profile?.academics_enabled) || (s.type === 'personal' && profile?.personal_enabled))
                        .map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1.5 w-full sm:w-1/3">
                  <Label htmlFor="priority" className="text-sm font-semibold text-muted-foreground">Priority</Label>
                  <div className="w-full">
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-10 bg-background shadow-sm border-muted-foreground/20 w-full">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                </div>
                
                <div className="space-y-1.5 w-full sm:w-1/3">
                  <Label htmlFor="duedate" className="text-sm font-semibold text-muted-foreground flex items-center gap-1"><CalIcon className="w-3.5 h-3.5"/> Due Date</Label>
                  <DatePicker
                    date={dueDate ? new Date(dueDate) : undefined}
                    setDate={(d) => setDueDate(d ? d.toISOString() : "")}
                    className="w-full bg-background shadow-sm border-muted-foreground/20 h-10"
                  />
                </div>

                <div className="flex flex-col w-full gap-3 mt-2 sm:mt-0">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-muted-foreground">Reminders</Label>
                    <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-muted/20 border border-muted-foreground/10 items-center">
                      <Button type="button" size="sm" variant={remindOnDue ? "default" : "ghost"} className="h-8 text-xs px-3 rounded-lg" onClick={() => setRemindOnDue(!remindOnDue)}>On Due Date</Button>
                      <Button type="button" size="sm" variant={remind1Day ? "default" : "ghost"} className="h-8 text-xs px-3 rounded-lg" onClick={() => setRemind1Day(!remind1Day)}>1 Day Prior</Button>
                      <div className="flex items-center gap-0.5 bg-background/50 rounded-lg border border-muted-foreground/10 overflow-hidden">
                        <Button type="button" size="sm" variant={remindCustom ? "default" : "ghost"} className="h-8 text-[10px] px-2 rounded-none border-0" onClick={() => setRemindCustom(!remindCustom)}>Hours Prior:</Button>
                        <Input type="number" min="1" max="72" value={customHours} onChange={(e) => setCustomHours(Number(e.target.value))} className={`h-8 w-11 text-xs px-1 text-center rounded-none border-0 focus-visible:ring-0 ${remindCustom ? 'bg-primary text-primary-foreground font-bold' : 'bg-transparent'}`} disabled={!remindCustom} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3 w-full">
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
                    <Button type="submit" className="h-12 sm:h-10 px-8 font-bold w-full sm:w-auto gradient-accent shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      <Plus className="w-5 h-5 mr-2" /> Add Task
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Task Lists */}
        <div className="space-y-8">
          
          {/* Pending Tasks */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-orange-500"/> Pending Tasks</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-card shadow-sm gap-4 animate-pulse">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-6 h-6 rounded-full bg-muted/60 shrink-0" />
                      <div className="space-y-2 w-full">
                        <div className="h-5 w-3/4 sm:w-1/2 bg-muted rounded-md" />
                        <div className="flex gap-2">
                          <div className="h-4 w-12 bg-muted/60 rounded-full" />
                          <div className="h-4 w-20 bg-muted/60 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-muted-foreground italic text-sm py-4">No pending tasks! Time to relax. ☕</p>
            ) : (
              <div className="space-y-8">
                {/* Upcoming Exams Section (Visible if not filtered to 'tasks' string) */}
                {filterType !== 'tasks' && tasks.some(t => t.is_exam) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4" /> Upcoming Exams
                    </h3>
                    <motion.div layout className="grid gap-3">
                      <AnimatePresence mode="popLayout">
                        {tasks
                          .filter(t => t.is_exam)
                          .filter(t => !t.subjects || 
                                      (t.subjects.type === 'academic' && profile?.academics_enabled) || 
                                      (t.subjects.type === 'personal' && profile?.personal_enabled))
                          .map(t => (
                            <TaskRow 
                              key={t.id} 
                              task={t} 
                              subjects={subjects} 
                              profile={profile} 
                              editingTaskId={editingTaskId} 
                              toggleComplete={toggleComplete} 
                              startEdit={startEdit} 
                              deleteTask={deleteTask}
                              editTitle={editTitle} setEditTitle={setEditTitle}
                              editSubjectId={editSubjectId} setEditSubjectId={setEditSubjectId}
                              editPriority={editPriority} setEditPriority={setEditPriority}
                              editDueDate={editDueDate} setEditDueDate={setEditDueDate}
                              editDueTime={editDueTime} setEditDueTime={setEditDueTime}
                              editRemindOnDue={editRemindOnDue} setEditRemindOnDue={setEditRemindOnDue}
                              editRemind1Day={editRemind1Day} setEditRemind1Day={setEditRemind1Day}
                              editRemindCustom={editRemindCustom} setEditRemindCustom={setEditRemindCustom}
                              editCustomHours={editCustomHours} setEditCustomHours={setEditCustomHours}
                              
                              isEditDatePickerOpen={isEditDatePickerOpen} setIsEditDatePickerOpen={setIsEditDatePickerOpen}
                              saveEdit={saveEdit} setEditingTaskId={setEditingTaskId}
                            />
                          ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )}
                
                {/* General Tasks Section */}
                {filterType !== 'exams' && tasks.some(t => !t.is_exam) && (
                  <div className="space-y-3">
                    {tasks.some(t => t.is_exam) && <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3 mt-6 border-t pt-6">Other Tasks</h3>}
                    <motion.div layout className="grid gap-3">
                      <AnimatePresence mode="popLayout">
                        {tasks
                          .filter(t => !t.is_exam)
                          .filter(t => !t.subjects || 
                                      (t.subjects.type === 'academic' && profile?.academics_enabled) || 
                                      (t.subjects.type === 'personal' && profile?.personal_enabled))
                          .map(t => (
                            <TaskRow 
                              key={t.id} 
                              task={t} 
                              subjects={subjects} 
                              profile={profile} 
                              editingTaskId={editingTaskId} 
                              toggleComplete={toggleComplete} 
                              startEdit={startEdit} 
                              deleteTask={deleteTask}
                              editTitle={editTitle} setEditTitle={setEditTitle}
                              editSubjectId={editSubjectId} setEditSubjectId={setEditSubjectId}
                              editPriority={editPriority} setEditPriority={setEditPriority}
                              editDueDate={editDueDate} setEditDueDate={setEditDueDate}
                              editDueTime={editDueTime} setEditDueTime={setEditDueTime}
                              editRemindOnDue={editRemindOnDue} setEditRemindOnDue={setEditRemindOnDue}
                              editRemind1Day={editRemind1Day} setEditRemind1Day={setEditRemind1Day}
                              editRemindCustom={editRemindCustom} setEditRemindCustom={setEditRemindCustom}
                              editCustomHours={editCustomHours} setEditCustomHours={setEditCustomHours}
                              
                              isEditDatePickerOpen={isEditDatePickerOpen} setIsEditDatePickerOpen={setIsEditDatePickerOpen}
                              saveEdit={saveEdit} setEditingTaskId={setEditingTaskId}
                            />
                          ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </div>



          {/* Completed Tasks */}
          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground"><CircleCheck className="w-5 h-5"/> Recently Completed</h2>
            {completedTasks.length > 0 ? (
              <motion.div layout className="grid gap-3 opacity-70">
                <AnimatePresence mode="popLayout">
                  {completedTasks
                    .filter(t => !t.subjects || 
                                 (t.subjects.type === 'academic' && profile?.academics_enabled) || 
                                 (t.subjects.type === 'personal' && profile?.personal_enabled))
                    .map(t => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={t.id} 
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border border-dashed rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleComplete(t)} className="text-green-500 hover:text-orange-500 transition-colors shrink-0" title="Mark pending">
                            {t.is_exam ? <Target className="w-6 h-6 text-primary" /> : <CircleCheck className="w-6 h-6" />}
                          </button>
                          <div>
                            <p className="font-medium line-through text-muted-foreground inline-flex items-center gap-2">
                              {t.title}
                              {t.subjects && <span className="text-[10px] font-semibold no-underline text-foreground px-1.5 py-0.5 rounded-sm bg-background border">{t.subjects.name}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 sm:mt-0 w-full justify-end sm:w-auto">
                          {t.completed_at && <span className="text-xs text-muted-foreground">Done: {new Date(t.completed_at).toLocaleDateString()}</span>}
                          <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive p-2 transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : <p className="text-sm text-muted-foreground italic py-2">No completed tasks yet.</p>}
          </div>

        </div>
      </div>
    </main>
  )
}

function TaskRow({ 
  task: t, subjects, profile, editingTaskId, toggleComplete, startEdit, deleteTask,
  editTitle, setEditTitle, editSubjectId, setEditSubjectId, editPriority, setEditPriority,
  editDueDate, setEditDueDate, editDueTime, setEditDueTime,
  editRemindOnDue, setEditRemindOnDue, editRemind1Day, setEditRemind1Day,
  editRemindCustom, setEditRemindCustom, editCustomHours, setEditCustomHours,
  isEditDatePickerOpen, setIsEditDatePickerOpen,
  saveEdit, setEditingTaskId
}: any) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:border-primary/50 transition-colors shadow-sm gap-4 bg-card'}`}
      style={t.subjects?.color_hex ? { borderLeft: `4px solid ${t.subjects.color_hex}` } : undefined}
    >
      <div className="flex items-start sm:items-center gap-3 w-full">
        <button onClick={() => toggleComplete(t)} className={`text-muted-foreground hover:text-green-500 transition mt-1 sm:mt-0 ${t.is_exam ? 'hover:text-primary' : ''}`}>
          {t.is_exam ? <Target className="w-6 h-6 shrink-0 text-primary/70" /> : <CircleCheck className="w-6 h-6 shrink-0" />}
        </button>
        
        {editingTaskId === t.id ? (
          <div className="flex flex-col gap-3 w-full pr-0 sm:pr-2">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-9 flex-1 w-full" />
              <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                <SelectTrigger className="h-9 w-full sm:w-[140px]">
                  <SelectValue placeholder="No Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Subject</SelectItem>
                  {subjects
                    .filter((s: any) => (s.type === 'academic' && profile?.academics_enabled) || (s.type === 'personal' && profile?.personal_enabled))
                    .map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-2 w-full sm:w-auto items-end">
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <DatePicker
                  date={editDueDate ? new Date(editDueDate) : undefined}
                  setDate={(d) => setEditDueDate(d ? d.toISOString() : null)}
                  className="w-[140px] h-9 px-3"
                />
              </div>
              
              <div className="flex flex-col gap-2 w-full">
                <div className="flex gap-2 items-center flex-wrap">
                  <Label className="text-xs font-semibold text-muted-foreground">Reminders</Label>
                  <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-md border border-muted-foreground/10">
                    <Button type="button" size="sm" variant={editRemindOnDue ? "default" : "ghost"} className="h-7 text-xs px-2" onClick={() => setEditRemindOnDue(!editRemindOnDue)}>On Due</Button>
                    <Button type="button" size="sm" variant={editRemind1Day ? "default" : "ghost"} className="h-7 text-xs px-2" onClick={() => setEditRemind1Day(!editRemind1Day)}>1D Prior</Button>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant={editRemindCustom ? "default" : "ghost"} className="h-7 text-xs px-2 rounded-r-none border-r border-background/20" onClick={() => setEditRemindCustom(!editRemindCustom)}>Hrs:</Button>
                      <Input type="number" min="1" max="72" value={editCustomHours} onChange={(e) => setEditCustomHours(Number(e.target.value))} className={`h-7 w-12 text-xs px-1 text-center rounded-l-none border-0 ${editRemindCustom ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`} disabled={!editRemindCustom} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-end sm:ml-auto">
                  <Input 
                    type="time" 
                    value={editDueTime} 
                    onChange={e => setEditDueTime(e.target.value)}
                    className="h-9 w-[100px]"
                  />
                  <Button size="sm" onClick={saveEdit} className="h-9 px-4 font-bold flex-1 sm:flex-none">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTaskId(null)} className="h-9 px-3 flex-1 sm:flex-none">Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => startEdit(t)} className="text-left flex-1 group focus:outline-none">
            <div className="flex items-center gap-2">
              <p className={`font-semibold transition-colors ${t.is_exam ? 'text-primary' : 'group-hover:text-primary'}`}>{t.title}</p>
              {t.has_reminder && <Bell className="w-3.5 h-3.5 text-blue-500 fill-blue-500"/>}
              {t.has_reminder && t.reminder_time && (
                <span className="text-[10px] text-blue-500 font-medium">
                  {new Date(t.reminder_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              )}
            </div>
            
            <div className="flex gap-2 items-center mt-1 flex-wrap">
              <Badge className={`${pColors[t.priority as keyof typeof pColors]} text-white border-0 text-[10px] px-1.5 py-0 uppercase tracking-wider`}>
                {t.priority}
              </Badge>
              {t.subjects && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted border" style={{color: t.subjects.color_hex}}>
                  {t.subjects.name}
                </span>
              )}
              {t.due_date && <span className={`text-xs font-bold px-1.5 rounded flex items-center gap-1 ${t.is_exam ? 'bg-primary/20 text-primary' : 'bg-destructive/10 text-destructive/90'}`}><CalIcon className="w-3 h-3"/> {t.is_exam ? 'Exam on ' : 'Due '} {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>}
              
              <span className="text-[10px] text-muted-foreground/60 ml-auto hidden sm:inline-block">Created: {new Date(t.created_at).toLocaleDateString()}</span>
            </div>
          </button>
        )}
      </div>
      
      {editingTaskId !== t.id && (
        <div className="flex justify-end border-t sm:border-0 pt-2 sm:pt-0">
          <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive p-2 shrink-0 transition-colors bg-muted/40 hover:bg-destructive/10 rounded-md">
            <Trash2 className="w-4 h-4"/>
          </button>
        </div>
      )}
    </motion.div>
  )
}
