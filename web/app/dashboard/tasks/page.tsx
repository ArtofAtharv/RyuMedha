"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, Trash2, Plus } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [completedTasks, setCompletedTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  
  // Edit State
  const [editingTaskId, setEditingTaskId] = useState<string|null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editPriority, setEditPriority] = useState("medium")
  const [editDueDate, setEditDueDate] = useState("")

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

      await fetchTasks(supabase, profile?.id)
    }
    init()
  }, [])

  async function fetchTasks(supabase: any, pid: string | null) {
    if (!pid) return
    setLoading(true)
    
    const { data: pending } = await supabase
      .from('tasks')
      .select('*')
      .eq('profile_id', pid)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      
    const { data: done } = await supabase
      .from('tasks')
      .select('*')
      .eq('profile_id', pid)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(10)

    setTasks(pending || [])
    setCompletedTasks(done || [])
    setLoading(false)
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    let finalDate = null
    if (dueDate) {
      const d = new Date(dueDate)
      d.setUTCHours(23, 59, 59, 999)
      finalDate = d.toISOString()
    }

    await supabaseClient
      .from('tasks')
      .insert([{
        profile_id: profileId,
        title: title.trim(),
        priority: priority,
        due_date: finalDate,
        is_completed: false
      }])

    setTitle("")
    setDueDate("")
    setPriority("medium")
    fetchTasks(supabaseClient, profileId)
  }

  async function toggleComplete(task: any) {
    await supabaseClient
      .from('tasks')
      .update({ 
        is_completed: !task.is_completed, 
        completed_at: !task.is_completed ? new Date().toISOString() : null 
      })
      .eq('id', task.id)
    fetchTasks(supabaseClient, profileId)
  }

  function startEdit(task: any) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditPriority(task.priority)
    setEditDueDate(task.due_date ? task.due_date.split('T')[0] : "")
  }

  async function saveEdit() {
    if (!editingTaskId || !editTitle.trim()) return

    let finalDate = null
    if (editDueDate) {
      const d = new Date(editDueDate)
      d.setUTCHours(23, 59, 59, 999)
      finalDate = d.toISOString()
    }

    await supabaseClient
      .from('tasks')
      .update({
        title: editTitle.trim(),
        priority: editPriority,
        due_date: finalDate
      })
      .eq('id', editingTaskId)

    setEditingTaskId(null)
    fetchTasks(supabaseClient, profileId)
  }

  async function deleteTask(id: string) {
    await supabaseClient.from('tasks').delete().eq('id', id)
    fetchTasks(supabaseClient, profileId)
  }

  const pColors: any = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-1">Keep track of your assignments and daily to-dos.</p>
      </div>

      <div className="space-y-8">
        
        {/* Quick Add Form (Horizontal) */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="space-y-1.5 w-full sm:flex-1">
                <Label htmlFor="title" className="text-xs text-muted-foreground uppercase font-bold tracking-wider">What needs doing?</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read Chapter 5" required className="bg-background shadow-sm border-muted-foreground/20" />
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="space-y-1.5 flex-[0.7]">
                  <Label htmlFor="priority" className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-10 min-w-[120px]">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="medium">🟡 Med</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-[1.3]">
                  <Label htmlFor="duedate" className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Due (Opt)</Label>
                  <Input id="duedate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-background shadow-sm border-muted-foreground/20" />
                </div>
              </div>
              
              <Button type="submit" className="w-full sm:w-fit font-bold gap-2 shrink-0 h-10 shadow-sm">
                <Plus className="w-4 h-4" /> Add
              </Button>
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
                    >
                      <div className="flex items-start sm:items-center gap-3 w-full">
                        <button onClick={() => toggleComplete(t)} className="text-muted-foreground hover:text-green-500 transition mt-1 sm:mt-0">
                          <CheckCircle2 className="w-6 h-6 shrink-0" />
                        </button>
                        
                        {editingTaskId === t.id ? (
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-9 sm:flex-1" />
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
                            </div>
                            <div className="flex gap-2 mt-2 sm:mt-0">
                              <Button size="sm" onClick={saveEdit} className="h-9 px-4 font-bold">Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingTaskId(null)} className="h-9 px-3">Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(t)} className="text-left flex-1 group focus:outline-none">
                            <p className="font-semibold group-hover:text-primary transition-colors">{t.title}</p>
                            <div className="flex gap-2 items-center mt-1">
                              <Badge className={`${pColors[t.priority]} text-white border-0 text-[10px] px-1.5 py-0 uppercase tracking-wider`}>
                                {t.priority}
                              </Badge>
                              {t.due_date && <span className="text-xs text-muted-foreground/80 font-medium">Due: {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>}
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
            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-5 h-5"/> Recently Completed</h2>
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
                      className="flex flex-row items-center justify-between p-3 border border-dashed rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleComplete(t)} className="text-green-500 hover:text-orange-500 transition-colors" title="Mark pending">
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                        <p className="font-medium line-through text-muted-foreground">{t.title}</p>
                      </div>
                      <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive p-2 transition-colors"><Trash2 className="w-4 h-4"/></button>
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
