"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Clock, Play, Square, Pause, History, Trash2, Timer, Pencil, Settings2 } from "lucide-react"
import { useProfile } from '@/components/dashboard/profile-context'
import { toast } from "sonner"
import { motion, AnimatePresence, Variants } from "motion/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

export default function TimersPage() {
  const { profile } = useProfile()
  const [activeTimer, setActiveTimer] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Pomodoro State
  const [pomoMode, setPomoMode] = useState<'pomodoro'|'shortBreak'|'longBreak'>('pomodoro')
  const [pomoTimeLeft, setPomoTimeLeft] = useState(25 * 60)
  const [pomoIsActive, setPomoIsActive] = useState(false)
  const [pomoEvents, setPomoEvents] = useState<any[]>([])
  
  // Pomodoro Settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [pomoDurationOpts, setPomoDurationOpts] = useState({ pomodoro: 25, shortBreak: 5, longBreak: 15 })
  const [tempOpts, setTempOpts] = useState({ pomodoro: 25, shortBreak: 5, longBreak: 15 })

  // Audio for alarm
  const [alarmAudio, setAlarmAudio] = useState<HTMLAudioElement | null>(null)

  // Edit Timer State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null)
  const [editSubjectId, setEditSubjectId] = useState("")

  useEffect(() => {
    setAlarmAudio(new Audio('/alarm.mp3')) // Expecting a simple ding sound
  }, [])

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

      await fetchData(supabase, profile?.id)
    }
    init()
  }, [])

  // Live counter for active timer
  useEffect(() => {
    if (!activeTimer) return
    
    // If paused, we don't need to increment elapsed live
    if (activeTimer.pause_started_at) {
      const start = new Date(activeTimer.started_at).getTime()
      const pauseStart = new Date(activeTimer.pause_started_at).getTime()
      const totalPauseSecs = activeTimer.total_pause_seconds || 0
      setElapsed(Math.max(0, Math.floor((pauseStart - start) / 1000) - totalPauseSecs))
      return
    }

    const interval = setInterval(() => {
      const start = new Date(activeTimer.started_at).getTime()
      const totalPauseSecs = activeTimer.total_pause_seconds || 0
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000) - totalPauseSecs))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTimer])

  // Local Pomodoro Interval
  useEffect(() => {
    if (!pomoIsActive) return
    const interval = setInterval(() => {
      setPomoTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [pomoIsActive])

  useEffect(() => {
    if (pomoIsActive && pomoTimeLeft <= 0) {
      handlePomoComplete()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomoTimeLeft, pomoIsActive])

  async function fetchData(supabase: any, pid: string | null) {
    if (!pid) return
    
    // Check for active timer
    const { data: activeList, error: fetchActiveErr } = await supabase
      .from('study_timers')
      .select('*, subjects(name)')
      .eq('profile_id', pid)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      
    if (fetchActiveErr) {
      console.error("fetchActiveErr:", fetchActiveErr)
    }

    const active = activeList && activeList.length > 0 ? activeList[0] : null
    setActiveTimer(active)
    if (active) {
      const start = new Date(active.started_at).getTime()
      const totalPauseSecs = active.total_pause_seconds || 0
      if (active.pause_started_at) {
        const pauseStart = new Date(active.pause_started_at).getTime()
        setElapsed(Math.max(0, Math.floor((pauseStart - start) / 1000) - totalPauseSecs))
      } else {
        setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000) - totalPauseSecs))
      }
    } else {
      setElapsed(0)
    }

    // Recent    // History
    const { data: hist } = await supabase
      .from('study_timers')
      .select('*, subjects(id, name, type, source_course_id(semester_id))')
      .eq('profile_id', pid)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(50)

    // Subjects
    const { data: rawSubs } = await supabase
      .from('subjects')
      .select('id, name, type, source_course_id(semester_id)')
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

    const validSubjectIds = new Set(subs.map((s: any) => s.id))
    setHistory((hist || []).filter((h: any) => validSubjectIds.has(h.subject_id)))

    // We no longer hide active timers from other semesters.
    // This ensures they can be stopped regardless of the current view.
    if (subs && subs.length > 0 && !selectedSubject) {
      // Find the first subject that the user is actually allowed to see
      // Cannot reliably use profile context on first render inside fetching logic unless passed in
      setSelectedSubject(subs[0].id) 
    }
  }

  async function startTimer() {
    if (!selectedSubject || activeTimer) {
      return
    }

    // Safety check: close any extra stuck timers BEFORE starting a new one
    try {
      await supabaseClient
        .from('study_timers')
        .update({ ended_at: new Date().toISOString() })
        .eq('profile_id', profileId)
        .is('ended_at', null)
    } catch (e) {
      console.warn("Safety check failed (likely CORS/PATCH issue), proceeding anyway:", e)
    }

    const { error } = await supabaseClient
      .from('study_timers')
      .insert([{
        profile_id: profileId,
        subject_id: selectedSubject,
        started_at: new Date().toISOString(),
        timer_type: 'stopwatch',
        events: [{ type: 'start', timestamp: new Date().toISOString() }]
      }])
    
    if (error) {
      console.error("Supabase insert error:", error)
      toast.error("Failed to start timer", { description: error.message })
      return
    }
    
    toast.success("Timer started!")
    await fetchData(supabaseClient, profileId)
  }

  async function pauseTimer() {
    if (!activeTimer || activeTimer.pause_started_at) return
    try {
      const { error } = await supabaseClient
        .from('study_timers')
        .update({ 
          pause_started_at: new Date().toISOString(),
          events: [...(activeTimer.events || []), { type: 'pause', timestamp: new Date().toISOString() }]
        })
        .eq('id', activeTimer.id)
      
      if (error) {
        toast.error("Failed to pause timer", { description: "Is the server allowing PATCH requests?" })
        return
      }
      
      await fetchData(supabaseClient, profileId)
    } catch (e) {
      toast.error("An error occurred while pausing")
    }
  }

  async function resumeTimer() {
    if (!activeTimer || !activeTimer.pause_started_at) return
    const pauseStart = new Date(activeTimer.pause_started_at).getTime()
    const pauseDuration = Math.floor((Date.now() - pauseStart) / 1000)
    const newTotalPause = (activeTimer.total_pause_seconds || 0) + pauseDuration

    try {
      const { error } = await supabaseClient
        .from('study_timers')
        .update({ 
          pause_started_at: null,
          total_pause_seconds: newTotalPause,
          events: [...(activeTimer.events || []), { type: 'resume', timestamp: new Date().toISOString() }]
        })
        .eq('id', activeTimer.id)
        
      if (error) {
        toast.error("Failed to resume timer", { description: "Is the server allowing PATCH requests?" })
        return
      }
      
      await fetchData(supabaseClient, profileId)
    } catch (e) {
      toast.error("An error occurred while resuming")
    }
  }

  async function stopTimer() {
    if (!activeTimer) return

    // If it was paused when stopped, we need to finalize the total pause time
    let finalPauseSecs = activeTimer.total_pause_seconds || 0
    if (activeTimer.pause_started_at) {
      const pauseStart = new Date(activeTimer.pause_started_at).getTime()
      finalPauseSecs += Math.floor((Date.now() - pauseStart) / 1000)
    }

    try {
      const { error } = await supabaseClient
        .from('study_timers')
        .update({ 
          ended_at: new Date().toISOString(),
          pause_started_at: null,
          total_pause_seconds: finalPauseSecs,
          duration_seconds: Math.floor((Date.now() - new Date(activeTimer.started_at).getTime()) / 1000) - finalPauseSecs,
          events: [...(activeTimer.events || []), { type: 'stop', timestamp: new Date().toISOString() }]
        })
        .eq('id', activeTimer.id)
      
      if (error) {
        toast.error("Failed to stop timer", { description: "Is the server allowing PATCH requests?" })
        return
      }

      toast.success("Timer stopped!")
      setActiveTimer(null)
      setElapsed(0)
      await fetchData(supabaseClient, profileId)
    } catch (e) {
      toast.error("An error occurred while stopping")
    }
  }

  async function deleteTimer(id: string) {
    if (!supabaseClient) return
    await supabaseClient.from('study_timers').delete().eq('id', id)
    toast.success("Timer deleted")
    fetchData(supabaseClient, profileId)
  }

  const openEditModal = (timerId: string, currentSubjectId: string) => {
    setEditingTimerId(timerId)
    setEditSubjectId(currentSubjectId || "")
    setIsEditModalOpen(true)
  }

  const saveTimerEdit = async () => {
    if (!editingTimerId || !editSubjectId) return
    try {
      await supabaseClient.from('study_timers').update({ subject_id: editSubjectId }).eq('id', editingTimerId)
      toast.success("Timer subject updated!")
      setIsEditModalOpen(false)
      fetchData(supabaseClient, profileId)
    } catch(e) {
      toast.error("Failed to update timer")
    }
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  const formatPomoTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  // --- Pomodoro Handlers ---
  const openPomoSettings = () => {
    setTempOpts(pomoDurationOpts)
    setIsSettingsModalOpen(true)
  }

  const savePomoSettings = () => {
    setPomoDurationOpts(tempOpts)
    setIsSettingsModalOpen(false)
    setPomoIsActive(false)
    if (pomoMode === 'pomodoro') setPomoTimeLeft(tempOpts.pomodoro * 60)
    if (pomoMode === 'shortBreak') setPomoTimeLeft(tempOpts.shortBreak * 60)
    if (pomoMode === 'longBreak') setPomoTimeLeft(tempOpts.longBreak * 60)
    toast.success("Timer settings updated")
  }

  const handlePomoModeSwitch = (mode: 'pomodoro'|'shortBreak'|'longBreak') => {
    setPomoIsActive(false)
    setPomoMode(mode)
    if (mode === 'pomodoro') setPomoTimeLeft(pomoDurationOpts.pomodoro * 60)
    if (mode === 'shortBreak') setPomoTimeLeft(pomoDurationOpts.shortBreak * 60)
    if (mode === 'longBreak') setPomoTimeLeft(pomoDurationOpts.longBreak * 60)
    setPomoEvents([])
  }

  const togglePomo = () => {
    if (!selectedSubject && pomoMode === 'pomodoro') {
      toast.error("Please select a subject first")
      return
    }
    const now = new Date().toISOString()
    setPomoEvents(prev => [...prev, { type: pomoIsActive ? 'pause' : 'start', timestamp: now }])
    setPomoIsActive(!pomoIsActive)
  }

  const handlePomoSkip = () => {
    setPomoIsActive(false)
    if (pomoMode === 'pomodoro') handlePomoModeSwitch('shortBreak')
    else handlePomoModeSwitch('pomodoro')
  }

  const handlePomoComplete = async () => {
    setPomoIsActive(false)
    if (alarmAudio) {
      alarmAudio.play().catch(e => console.log('Audio play failed', e))
    }
    
    // Only save strictly Pomodoro (work) sessions to the DB
    if (pomoMode === 'pomodoro' && selectedSubject) {
      const now = new Date().toISOString()
      const startLog = pomoEvents[0]?.timestamp || new Date(Date.now() - (25 * 60 * 1000)).toISOString()
      const finalEvents = [...pomoEvents, { type: 'complete', timestamp: now }]
      
      try {
        await supabaseClient.from('study_timers').insert([{
          profile_id: profileId,
          subject_id: selectedSubject,
          started_at: startLog,
          ended_at: now,
          duration_seconds: pomoDurationOpts.pomodoro * 60,
          total_pause_seconds: 0, // Ignoring pause math for pure pomodoros for simplicity, rely on events log
          timer_type: 'pomodoro',
          events: finalEvents
        }])
        toast.success("Focus Session Complete! Data saved.")
        fetchData(supabaseClient, profileId)
      } catch (e) {
        toast.error("Failed to save Pomodoro session")
      }
      handlePomoModeSwitch('shortBreak')
    } else {
      toast.success("Break Over! Back to work.")
      handlePomoModeSwitch('pomodoro')
    }
  }

  // -------------------------

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Study Timers</span></h1>
        <p className="text-muted-foreground mt-1">Track your dedicated study sessions to build powerful reports.</p>
      </motion.div>

      {subjects.length === 0 ? (
        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {/* Active Timer Skeleton */}
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                </div>
                <div className="h-12 w-full bg-primary/20 animate-pulse rounded-md mt-4" />
              </div>
            </CardContent>
          </Card>

          {/* History Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 w-40 bg-muted animate-pulse rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-card animate-pulse">
                    <div className="space-y-2">
                      <div className="h-5 w-24 bg-muted rounded-md" />
                      <div className="h-3 w-16 bg-muted/60 rounded-md" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-12 bg-muted rounded-md" />
                      <div className="h-8 w-8 bg-muted rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
          
          <Tabs defaultValue="stopwatch" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto mb-8 h-12 rounded-xl p-1 bg-muted/50 border border-border/50">
              <TabsTrigger value="stopwatch" className="rounded-lg font-bold text-sm flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
                <Clock className="w-4 h-4" /> Stopwatch
              </TabsTrigger>
              <TabsTrigger value="pomodoro" className="rounded-lg font-bold text-sm flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-red-500 transition-all">
                <Timer className="w-4 h-4" /> Pomodoro
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stopwatch" className="mt-0">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Active Timer / Start Form */}
                <motion.div variants={itemVariants}>
          <Card className="border-2 border-primary/20 h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary"/> Active Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTimer ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-lg font-medium text-muted-foreground">{activeTimer.subjects?.name}</p>
                <div className={`text-5xl font-mono font-black tracking-tighter transition-all duration-500 ${activeTimer.pause_started_at ? 'text-muted-foreground opacity-70' : 'gradient-accent-text'}`}>
                  {formatTime(elapsed)}
                </div>
                {activeTimer.pause_started_at && <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest animate-pulse">Paused</p>}
                
                <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
                  {activeTimer.pause_started_at ? (
                    <Button onClick={resumeTimer} size="lg" className="w-full sm:w-auto gap-2 gradient-accent text-white border-0 hover:opacity-90 transition-opacity">
                      <Play className="fill-current w-4 h-4"/> Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseTimer} variant="outline" size="lg" className="w-full sm:w-auto gap-2 hover:bg-muted">
                      <Pause className="fill-current w-4 h-4"/> Pause
                    </Button>
                  )}
                  <Button onClick={stopTimer} variant="destructive" size="lg" className="w-full sm:w-auto gap-2">
                    <Square className="fill-current w-4 h-4"/> Stop Timer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Subject</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <SelectValue placeholder="Select a Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects
                        .filter(s => (s.type === 'academic' && profile?.academics_enabled) || (s.type === 'personal' && profile?.personal_enabled))
                        .map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={startTimer} disabled={!selectedSubject} size="lg" className="w-full gap-2 gradient-accent text-white border-0 hover:opacity-90 transition-opacity">
                  <Play className="fill-current w-4 h-4"/> Start Focusing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* History */}
        <motion.div variants={itemVariants}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <History className="w-5 h-5"/> Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <motion.div layout className="space-y-3">
                <AnimatePresence mode="popLayout">
                {history
                  .filter(h => !h.subjects || 
                               (h.subjects.type === 'academic' && profile?.academics_enabled) || 
                               (h.subjects.type === 'personal' && profile?.personal_enabled))
                  .map(h => (
                    <motion.div 
                      key={h.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 border rounded-lg bg-card gap-3 hover:border-primary/50 transition-colors shadow-sm"
                    >
                      <div>
                        <p className="font-semibold">{h.subjects?.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{new Date(h.started_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{new Date(h.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(h.ended_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        {h.total_pause_seconds > 0 && (
                          <p className="text-[10px] text-muted-foreground font-medium mt-0.5 border bg-muted/50 px-1.5 py-0.5 rounded-sm inline-block">
                            Includes {Math.floor(h.total_pause_seconds / 60)}m paused time
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <div className="font-mono bg-muted px-2 py-1 rounded text-sm font-medium border border-border/50">
                          {(() => {
                            const start = new Date(h.started_at).getTime()
                            const end = new Date(h.ended_at).getTime()
                            const grossSecs = Math.floor((end - start) / 1000)
                            const netSecs = Math.max(0, grossSecs - (h.total_pause_seconds || 0))
                            return formatTime(netSecs)
                          })()}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(h.id, h.subject_id)} className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0 bg-muted/40 hover:bg-primary/10 rounded-md">
                          <Pencil className="w-4 h-4"/>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTimer(h.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 bg-muted/40 hover:bg-destructive/10 rounded-md">
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
              </motion.div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No study sessions recorded yet.</p>
            )}
          </CardContent>
        </Card>
        </motion.div>
        
              </div>
            </TabsContent>

            <TabsContent value="pomodoro" className="mt-0 outline-none">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Pomodoro Tracker */}
                <div className="h-full">
                  <Card className={`border-2 transition-colors duration-700 overflow-hidden h-full flex flex-col items-center justify-center p-6 min-h-[400px] relative ${
                    pomoMode === 'pomodoro' ? 'bg-red-500/10 border-red-500/20' : 
                    pomoMode === 'shortBreak' ? 'bg-teal-500/10 border-teal-500/20' : 
                    'bg-blue-500/10 border-blue-500/20'
                  }`}>
                    
                    <div className="absolute top-4 right-4 z-10">
                      <Button variant="ghost" size="icon" onClick={openPomoSettings} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Settings2 className="w-5 h-5"/>
                      </Button>
                    </div>

                    {/* Subject Selector (Only show if in Pomodoro Mode, breaks don't need subjects) */}
                    <div className="absolute top-4 w-full px-6 flex justify-center">
                      <div className="w-full max-w-[200px]">
                        {pomoMode === 'pomodoro' ? (
                          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="flex h-8 bg-background/50 border-0 rounded-full text-xs font-bold w-full justify-center gap-2">
                              <SelectValue placeholder="Select Subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects
                                .filter(s => (s.type === 'academic' && profile?.academics_enabled) || (s.type === 'personal' && profile?.personal_enabled))
                                .map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                              }
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-8 flex items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background/30 rounded-full px-4 w-fit mx-auto">
                            Break Time
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 p-1.5 bg-background/50 backdrop-blur-md rounded-full mb-8 mt-6">
                      <button onClick={() => handlePomoModeSwitch('pomodoro')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${pomoMode === 'pomodoro' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'text-muted-foreground hover:bg-muted'}`}>Pomodoro</button>
                      <button onClick={() => handlePomoModeSwitch('shortBreak')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${pomoMode === 'shortBreak' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-muted-foreground hover:bg-muted'}`}>Short Break</button>
                      <button onClick={() => handlePomoModeSwitch('longBreak')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${pomoMode === 'longBreak' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-muted-foreground hover:bg-muted'}`}>Long Break</button>
                    </div>

                    <div className="text-[100px] leading-none font-mono font-black tracking-tighter tabular-nums drop-shadow-2xl">
                      {formatPomoTime(pomoTimeLeft)}
                    </div>

                    <div className="flex items-center gap-4 mt-12">
                      <Button 
                        onClick={togglePomo} 
                        size="lg" 
                        className={`text-xl font-black h-16 px-12 rounded-3xl transition-all shadow-xl hover:scale-105 ${
                          pomoIsActive ? 'bg-background text-foreground border-2 border-border/50 hover:bg-muted' : 
                          pomoMode === 'pomodoro' ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' :
                          pomoMode === 'shortBreak' ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-teal-500/20' :
                          'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-500/20'
                        }`}
                      >
                        {pomoIsActive ? 'PAUSE' : 'START'}
                      </Button>
                      
                      {pomoIsActive && (
                        <Button onClick={handlePomoSkip} variant="ghost" size="icon" className="h-14 w-14 rounded-full bg-background/50 hover:bg-background/80 shadow-md">
                          <Square className="w-5 h-5 fill-current opacity-70" />
                        </Button>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Shared History View */}
                <div className="h-full">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-muted-foreground flex items-center gap-2">
                        <History className="w-5 h-5"/> Pomodoro History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {history.filter(h => h.timer_type === 'pomodoro').length > 0 ? (
                        <div className="space-y-3">
                          {history.filter(h => h.timer_type === 'pomodoro').slice(0, 10).map(h => (
                            <div key={h.id} className="flex justify-between items-center p-3 border rounded-lg bg-card gap-3 hover:border-red-500/50 transition-colors">
                              <div>
                                <p className="font-semibold">{h.subjects?.name}</p>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(h.ended_at).toLocaleDateString()} at {new Date(h.ended_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md text-sm">{Math.floor(h.duration_seconds / 60)}m</span>
                                <Button variant="ghost" size="icon" onClick={() => openEditModal(h.id, h.subject_id)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                                  <Pencil className="w-4 h-4"/>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteTimer(h.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-4 h-4"/>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No completed Pomodoros yet. Focus up!</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

              </div>
            </TabsContent>
          </Tabs>

      </motion.div>
      )}

      {/* Edit Timer Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Timer Subject</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Re-assign Subject</Label>
              <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects
                    .filter(s => (s.type === 'academic' && profile?.academics_enabled) || (s.type === 'personal' && profile?.personal_enabled))
                    .map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={saveTimerEdit} className="gradient-accent text-white border-0">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pomodoro Settings Dialog */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Timer Settings</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Pomodoro (minutes)</Label>
              <input 
                type="number" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={tempOpts.pomodoro} 
                onChange={e => setTempOpts({...tempOpts, pomodoro: parseInt(e.target.value) || 1})} 
                min="1" max="120" 
              />
            </div>
            <div className="space-y-2">
              <Label>Short Break (minutes)</Label>
              <input 
                type="number" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={tempOpts.shortBreak} 
                onChange={e => setTempOpts({...tempOpts, shortBreak: parseInt(e.target.value) || 1})} 
                min="1" max="60" 
              />
            </div>
            <div className="space-y-2">
              <Label>Long Break (minutes)</Label>
              <input 
                type="number" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={tempOpts.longBreak} 
                onChange={e => setTempOpts({...tempOpts, longBreak: parseInt(e.target.value) || 1})} 
                min="1" max="60" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
            <Button onClick={savePomoSettings} className="gradient-accent text-white border-0">Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
