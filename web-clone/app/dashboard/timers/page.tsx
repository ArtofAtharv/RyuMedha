"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Play, Square, Pause, History, Trash2 } from "lucide-react"
import { useProfile } from '@/components/dashboard/profile-context'
import { toast } from "sonner"
import { motion, AnimatePresence, Variants } from "motion/react"

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
        started_at: new Date().toISOString()
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
        .update({ pause_started_at: new Date().toISOString() })
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
          total_pause_seconds: newTotalPause
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
          total_pause_seconds: finalPauseSecs
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
    fetchData(supabaseClient, profileId)
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Study Timers</span></h1>
        <p className="text-muted-foreground mt-1">Track your dedicated study sessions live.</p>
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
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid md:grid-cols-2 gap-6">
        
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

      </motion.div>
      )}
    </div>
  )
}
