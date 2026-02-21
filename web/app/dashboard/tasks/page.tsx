"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CircleCheck, Clock, Trash2, Plus, Bell, Calendar as CalIcon } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [completedTasks, setCompletedTasks] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [subjectId, setSubjectId] = useState("none")
  const [hasReminder, setHasReminder] = useState(false)

  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  
  // Edit State
  const [editingTaskId, setEditingTaskId] = useState<string|null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editPriority, setEditPriority] = useState("medium")
  const [editDueDate, setEditDueDate] = useState("")
  const [editSubjectId, setEditSubjectId] = useState("none")
  const [editHasReminder, setEditHasReminder] = useState(false)

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
        .select('id')
        .eq('whatsapp_number', session.user.phone)
        .single()
        
      if (profile) setProfileId(profile.id)

      await fetchTasksAndSubjects(supabase, profile?.id)
    }
    init()
  }, [])

  async function fetchTasksAndSubjects(supabase: any, pid: string | null) {
    if (!pid) return
    setLoading(true)
    
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, name, color_hex')
      .eq('profile_id', pid)
      .eq('is_active', true)
      .order('name')
    setSubjects(subs || [])

    const { data: pending } = await supabase
      .from('tasks')
      .select('*, subjects(name, color_hex)')
      .eq('profile_id', pid)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      
    const { data: done } = await supabase
      .from('tasks')
      .select('*, subjects(name, color_hex)')
      .eq('profile_id', pid)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(10)

    setTasks(pending || [])
    setCompletedTasks(done || [])
    setLoading(false)
  }

  // Helper to reliably parse local date string 'YYYY-MM-DD' into a stable UTC ISO string
  function getDateISO(dateString: string) {
    if (!dateString) return null
    // Store as midnight UTC to avoid timezone drift pushing date forward
    return `${dateString}T00:00:00.000Z`
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const finalDate = getDateISO(dueDate)

    await supabaseClient
      .from('tasks')
      .insert([{
        profile_id: profileId,
        title: title.trim(),
        priority: priority,
        due_date: finalDate,
        subject_id: subjectId === "none" ? null : subjectId,
        has_reminder: hasReminder,
        is_completed: false
      }])

    setTitle("")
    setDueDate("")
    setPriority("medium")
    setSubjectId("none")
    setHasReminder(false)
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
    setEditHasReminder(task.has_reminder || false)
    setEditSubjectId(task.subject_id || "none")

    if (task.due_date) {
      // Use UTC methods since we store as midnight UTC to avoid timezone drift
      const d = new Date(task.due_date)
      const yr = d.getUTCFullYear()
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dt = String(d.getUTCDate()).padStart(2, '0')
      setEditDueDate(`${yr}-${mo}-${dt}`)
    } else {
      setEditDueDate("")
    }
  }

  async function saveEdit() {
    if (!editingTaskId || !editTitle.trim()) return

    const finalDate = getDateISO(editDueDate)

    await supabaseClient
      .from('tasks')
      .update({
        title: editTitle.trim(),
        priority: editPriority,
        due_date: finalDate,
        subject_id: editSubjectId === "none" ? null : editSubjectId,
        has_reminder: editHasReminder
      })
      .eq('id', editingTaskId)

    setEditingTaskId(null)
    fetchTasksAndSubjects(supabaseClient, profileId)
  }

  async function deleteTask(id: string) {
    await supabaseClient.from('tasks').delete().eq('id', id)
    fetchTasksAndSubjects(supabaseClient, profileId)
  }

  const pColors: any = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-1">Keep track of your assignments and daily to-dos.</p>
      </div>

      <div className="space-y-8">
        
        {/* Quick Add Form */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1.5 w-full sm:flex-1">
                  <Label htmlFor="title" className="text-xs text-muted-foreground uppercase font-bold tracking-wider">What needs doing?</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read Chapter 5" required className="bg-background shadow-sm border-muted-foreground/20" />
                </div>
                
                <div className="space-y-1.5 w-full sm:w-1/3">
                  <Label htmlFor="subject" className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Subject Link</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="No Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Subject</SelectItem>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1.5 w-full sm:w-[150px]">
                  <Label htmlFor="priority" className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="medium">🟡 Med</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5 w-full sm:w-[180px]">
                  <Label htmlFor="duedate" className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><CalIcon className="w-3 h-3"/> Due Date</Label>
                  <Input id="duedate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-background shadow-sm border-muted-foreground/20" />
                </div>

                <div className="flex-1 flex justify-start sm:justify-end items-center gap-2 mb-1">
                  <Button 
                    type="button"
                    variant={hasReminder ? "default" : "outline"} 
                    className="h-10 gap-2" 
                    onClick={() => setHasReminder(!hasReminder)}
                  >
                    <Bell className={`w-4 h-4 ${hasReminder ? "text-primary-foreground fill-current animate-wiggle" : "text-muted-foreground"}`} />
                    {hasReminder ? "Reminder On" : "No Reminder"}
                  </Button>
                  <Button type="submit" className="font-bold gap-2 shrink-0 h-10 shadow-sm w-full sm:w-auto">
                    <Plus className="w-4 h-4" /> Add Task
                  </Button>
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
            {loading ? <p className="text-muted-foreground animate-pulse text-sm">Loading tasks...</p> : tasks.length === 0 ? (
              <p className="text-muted-foreground italic text-sm py-4">No pending tasks! Time to relax. ☕</p>
            ) : (
              <motion.div layout className="grid gap-3">
                <AnimatePresence mode="popLayout">
                  {tasks.map(t => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={t.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-card hover:border-primary/50 transition-colors shadow-sm gap-4"
                      style={t.subjects?.color_hex ? { borderLeft: `4px solid ${t.subjects.color_hex}` } : undefined}
                    >
                      <div className="flex items-start sm:items-center gap-3 w-full">
                        <button onClick={() => toggleComplete(t)} className="text-muted-foreground hover:text-green-500 transition mt-1 sm:mt-0">
                          <CircleCheck className="w-6 h-6 shrink-0" />
                        </button>
                        
                        {editingTaskId === t.id ? (
                          <div className="flex flex-col gap-3 w-full pr-2">
                            <div className="flex gap-2 w-full">
                              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-9 flex-1" />
                              <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                                <SelectTrigger className="h-9 w-[140px]">
                                  <SelectValue placeholder="No Subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No Subject</SelectItem>
                                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2">
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
                              <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="h-9 text-sm w-36" />
                              
                              <Button 
                                type="button"
                                variant={editHasReminder ? "default" : "outline"}
                                className="h-9 px-3"
                                onClick={() => setEditHasReminder(!editHasReminder)}
                              >
                                <Bell className={`w-4 h-4 ${editHasReminder ? "fill-current" : ""}`} />
                              </Button>

                              <div className="flex gap-2 ml-auto">
                                <Button size="sm" onClick={saveEdit} className="h-9 px-4 font-bold">Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingTaskId(null)} className="h-9 px-3">Cancel</Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(t)} className="text-left flex-1 group focus:outline-none">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold group-hover:text-primary transition-colors">{t.title}</p>
                              {t.has_reminder && <Bell className="w-3.5 h-3.5 text-blue-500 fill-blue-500"/>}
                            </div>
                            
                            <div className="flex gap-2 items-center mt-1 flex-wrap">
                              <Badge className={`${pColors[t.priority]} text-white border-0 text-[10px] px-1.5 py-0 uppercase tracking-wider`}>
                                {t.priority}
                              </Badge>
                              {t.subjects && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted border" style={{color: t.subjects.color_hex}}>
                                  {t.subjects.name}
                                </span>
                              )}
                              {t.due_date && <span className="text-xs text-destructive/90 font-bold bg-destructive/10 px-1.5 rounded flex items-center gap-1"><CalIcon className="w-3 h-3"/> Due {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>}
                              
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
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Completed Tasks */}
          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground"><CircleCheck className="w-5 h-5"/> Recently Completed</h2>
            {completedTasks.length > 0 ? (
              <motion.div layout className="grid gap-3 opacity-70">
                <AnimatePresence mode="popLayout">
                  {completedTasks.map(t => (
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
                          <CircleCheck className="w-6 h-6" />
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
    </div>
  )
}
