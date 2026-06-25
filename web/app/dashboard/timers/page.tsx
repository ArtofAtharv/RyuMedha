"use client"

import { useCallback, useEffect, useState } from "react"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Clock, Play, Square, Pause, History, Trash2, Timer, Pencil, Settings2 } from "lucide-react"
import { useProfile, type UserProfile } from '@/components/dashboard/profile-context'
import { toast } from "sonner"
import { m, AnimatePresence, Variants } from "motion/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DashboardSubject, StudyTimer } from "@/lib/dashboard-types"
import { getSourceCourse } from "@/lib/source-course"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 } }
}

export default function TimersPage() {
  const { profile } = useProfile()
  const [activeTimer, setActiveTimer] = useState<StudyTimer | null>(null)
  const [history, setHistory] = useState<StudyTimer[]>([])
  const [subjects, setSubjects] = useState<DashboardSubject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [clockOffset, setClockOffset] = useState<number>(0)

  // Pomodoro State
  const [activePomodoroDB, setActivePomodoroDB] = useState<StudyTimer | null>(null)
  const [pomoMode, setPomoMode] = useState<'pomodoro'|'shortBreak'|'longBreak'>('pomodoro')
  const [pomoTimeLeft, setPomoTimeLeft] = useState(25 * 60)
  const [pomoIsActive, setPomoIsActive] = useState(false)
  
  // Tabs State
  const [activeTab, setActiveTab] = useState("stopwatch")
  
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
    // Initialise alarm audio outside of setState to satisfy react-hooks/set-state-in-effect
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { window: Window }).window) {
      const audio = new (globalThis as unknown as { window: { Audio: new (src: string) => HTMLAudioElement } }).window.Audio('/alarm.mp3') // Expecting a simple ding sound
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlarmAudio(audio)
      const savedTab = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.getItem("ryumedha_timers_tab")
      if (savedTab) setActiveTab(savedTab)
    }
  }, [])
  
  const handleTabChange = (val: string) => {
    setActiveTab(val)
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { window: Window }).window) (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem("ryumedha_timers_tab", val)
  }

  // Unified time getter
  const getSyncedTime = useCallback(() => Date.now() + clockOffset, [clockOffset])

  const fetchData = useCallback(async (supabase: AppSupabaseClient, pid: string | null) => {
    if (!pid) return
    
    // Check for active timer
    const { data: activeList, error: fetchActiveErr } = await supabase
      .from('study_timers')
      .select('*, subjects(name)')
      .eq('profile_id', pid)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      
    if (fetchActiveErr) {
      console.error("fetchActiveErr:", fetchActiveErr)
    }

    // Stopwatch Active
    const activeSw = activeList?.find((t: StudyTimer) => t.timer_type === 'stopwatch') || null
    setActiveTimer(activeSw)
    
    // Pomodoro Active
    const activePomo = activeList?.find((t: StudyTimer) => t.timer_type === 'pomodoro') || null
    setActivePomodoroDB(activePomo)

    if (activeSw) {
      const start = new Date(activeSw.started_at).getTime()
      const totalPauseSecs = activeSw.total_pause_seconds || 0
      if (activeSw.pause_started_at) {
        const pauseStart = new Date(activeSw.pause_started_at).getTime()
        setElapsed(Math.max(0, Math.floor((pauseStart - start) / 1000) - totalPauseSecs))
      } else {
        setElapsed(Math.max(0, Math.floor((getSyncedTime() - start) / 1000) - totalPauseSecs))
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

    const subs = (rawSubs as DashboardSubject[] | null)?.filter((s) => {
      if (s.type === 'personal') return true
      return getSourceCourse(s.source_course_id)?.semester_id === profile?.current_semester_id
    }) || []
    setSubjects(subs)

    const validSubjectIds = new Set(subs.map((s) => s.id))
    setHistory(((hist as StudyTimer[] | null) ?? []).filter((h) => validSubjectIds.has(h.subject_id)))

    // We no longer hide active timers from other semesters.
    // This ensures they can be stopped regardless of the current view.
    if (subs && subs.length > 0 && !selectedSubject) {
      // Find the first subject that the user is actually allowed to see
      // Cannot reliably use profile context on first render inside fetching logic unless passed in
      setSelectedSubject(subs[0].id) 
    }
  }, [getSyncedTime, profile?.current_semester_id, selectedSubject])

  useEffect(() => {
    async function init() {
      const session = await getSession()
      if (!session) return
      
      const supabase = getAppClient({ global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
      )
      
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', session.user.phone)
        .single()
        
      if (profile) setProfileId(profile.id)
      
      // Calculate device clock skew relative to the server
      try {
        const startFetch = Date.now()
        const res = await fetch('/api/time')
        const data = await res.json() as { timestamp: number }
        const delay = (Date.now() - startFetch) / 2
        // clockOffset = how much we need to add to Date.now() to get true server time
        const offset = (data.timestamp - delay) - Date.now()
        setClockOffset(offset)
      } catch (e) {
        console.warn("Time sync failed, using local time", e)
      }

      await fetchData(supabase, profile?.id)
    }
    init()
  }, [fetchData])

  const handlePomoModeSwitch = useCallback((mode: 'pomodoro'|'shortBreak'|'longBreak', force = false) => {
    if (!force && activePomodoroDB && mode !== 'pomodoro') {
       toast.error("You have an active Pomodoro session running!")
       return
    }
    setPomoIsActive(false)
    setPomoMode(mode)
    if (mode === 'pomodoro') setPomoTimeLeft(pomoDurationOpts.pomodoro * 60)
    if (mode === 'shortBreak') setPomoTimeLeft(pomoDurationOpts.shortBreak * 60)
    if (mode === 'longBreak') setPomoTimeLeft(pomoDurationOpts.longBreak * 60)
  }, [activePomodoroDB, pomoDurationOpts])

  const handlePomoComplete = useCallback(async (passedDbRecord?: StudyTimer) => {
    if (!supabaseClient || !profileId) return
    setPomoIsActive(false)
    if (alarmAudio) {
      alarmAudio.play().catch((e: unknown) => console.log('Audio play failed', e))
    }
    
    if (pomoMode === 'pomodoro') {
      const dbRecord = passedDbRecord || activePomodoroDB
      if (dbRecord) {
        const now = new Date(getSyncedTime()).toISOString()
        try {
          const target = dbRecord.duration_seconds || (pomoDurationOpts.pomodoro * 60)
          await supabaseClient.from('study_timers').update({
            ended_at: now,
            duration_seconds: target, 
            events: [...(dbRecord.events || []), { type: 'complete', timestamp: now }]
          }).eq('id', dbRecord.id)
          
          toast.success("Focus Session Complete! Data saved.")
          setActivePomodoroDB(null)
          fetchData(supabaseClient, profileId)
        } catch (e) {
          console.error("Failed to save Pomodoro session", e)
          toast.error("Failed to save Pomodoro session")
        }
      } else {
        toast.info("Completed early Pomodoro fallback.")
      }
      handlePomoModeSwitch('shortBreak', true)
    } else {
      toast.success("Break Over! Back to work.")
      handlePomoModeSwitch('pomodoro', true)
    }
  }, [alarmAudio, pomoMode, activePomodoroDB, getSyncedTime, supabaseClient, pomoDurationOpts.pomodoro, fetchData, profileId, handlePomoModeSwitch])

  // Live counter for active timer
  useEffect(() => {
    if (!activeTimer) return
    
    // If paused, we don't need to increment elapsed live
    if (activeTimer.pause_started_at) {
      const start = new Date(activeTimer.started_at).getTime()
      const pauseStart = new Date(activeTimer.pause_started_at).getTime()
      const totalPauseSecs = activeTimer.total_pause_seconds || 0
      const elapsed = Math.max(0, Math.floor((pauseStart - start) / 1000) - totalPauseSecs)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (elapsed >= 0) setElapsed(elapsed)
      return
    }

    const interval = setInterval(() => {
      const start = new Date(activeTimer.started_at).getTime()
      const totalPauseSecs = activeTimer.total_pause_seconds || 0
      setElapsed(Math.max(0, Math.floor((Date.now() + clockOffset - start) / 1000) - totalPauseSecs))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTimer, clockOffset])

  // Pomodoro DB -> Local UI Sync
  useEffect(() => {
    if (activePomodoroDB) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!activePomodoroDB.is_synced) setPomoMode('pomodoro') // Enforce pomodoro mode if DB says it's running
      if (activePomodoroDB.subject_id && !selectedSubject) {
         setSelectedSubject(activePomodoroDB.subject_id)
      }
      
      const start = new Date(activePomodoroDB.started_at).getTime()
      const totalPauseSecs = activePomodoroDB.total_pause_seconds || 0
      const target = activePomodoroDB.duration_seconds || (pomoDurationOpts.pomodoro * 60)
      
      if (activePomodoroDB.pause_started_at) {
        setPomoIsActive(false)
        const pauseStart = new Date(activePomodoroDB.pause_started_at).getTime()
        const elapsed = Math.max(0, Math.floor((pauseStart - start) / 1000) - totalPauseSecs)
        setPomoTimeLeft(Math.max(0, target - elapsed))
      } else {
        setPomoIsActive(true)
        const elapsed = Math.max(0, Math.floor((getSyncedTime() - start) / 1000) - totalPauseSecs)
        setPomoTimeLeft(Math.max(0, target - elapsed))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePomodoroDB, pomoDurationOpts.pomodoro, clockOffset])

  // Local/DB Pomodoro Interval
  useEffect(() => {
    if (!pomoIsActive) return
    
    const interval = setInterval(() => {
      if (pomoMode === 'pomodoro' && activePomodoroDB) {
          // DB driven countdown
          const start = new Date(activePomodoroDB.started_at).getTime()
          const totalPauseSecs = activePomodoroDB.total_pause_seconds || 0
          const elapsed = Math.max(0, Math.floor((getSyncedTime() - start) / 1000) - totalPauseSecs)
          const target = activePomodoroDB.duration_seconds || (pomoDurationOpts.pomodoro * 60)
          const left = target - elapsed
          
          if (left <= 0) {
            setPomoTimeLeft(0)
            setPomoIsActive(false)
            handlePomoComplete(activePomodoroDB)
          } else {
            setPomoTimeLeft(left)
          }
      } else {
          // Local break countdown
          setPomoTimeLeft((prev) => prev <= 1 ? 0 : prev - 1)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [pomoIsActive, pomoMode, activePomodoroDB, pomoDurationOpts.pomodoro, getSyncedTime, handlePomoComplete])

  useEffect(() => {
    if (pomoIsActive && pomoMode !== 'pomodoro' && pomoTimeLeft === 0) {
      const t = setTimeout(() => handlePomoComplete(), 0)
      return () => clearTimeout(t)
    }
  }, [pomoIsActive, pomoMode, pomoTimeLeft, handlePomoComplete])

  async function startTimer() {
    if (!supabaseClient || !profileId) return
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
        started_at: new Date(getSyncedTime()).toISOString(),
        timer_type: 'stopwatch',
        events: [{ type: 'start', timestamp: new Date(getSyncedTime()).toISOString() }]
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
    if (!supabaseClient || !profileId) return
    if (!activeTimer || activeTimer.pause_started_at) return
    try {
      const { error } = await supabaseClient
        .from('study_timers')
        .update({ 
          pause_started_at: new Date(getSyncedTime()).toISOString(),
          events: [...(activeTimer.events || []), { type: 'pause', timestamp: new Date(getSyncedTime()).toISOString() }]
        })
        .eq('id', activeTimer.id)
      
      if (error) {
        toast.error("Failed to pause timer", { description: "Is the server allowing PATCH requests?" })
        return
      }
      
      await fetchData(supabaseClient, profileId)
    } catch (e) {
      console.error(e)
      toast.error("An error occurred while pausing")
    }
  }

  async function resumeTimer() {
    if (!supabaseClient || !profileId) return
    if (!activeTimer?.pause_started_at) return
    const pauseStart = new Date(activeTimer.pause_started_at).getTime()
    const pauseDuration = Math.floor((getSyncedTime() - pauseStart) / 1000)
    const newTotalPause = (activeTimer.total_pause_seconds || 0) + pauseDuration

    try {
      const { error } = await supabaseClient
        .from('study_timers')
        .update({ 
          pause_started_at: null,
          total_pause_seconds: newTotalPause,
          events: [...(activeTimer.events || []), { type: 'resume', timestamp: new Date(getSyncedTime()).toISOString() }]
        })
        .eq('id', activeTimer.id)
        
      if (error) {
        toast.error("Failed to resume timer", { description: "Is the server allowing PATCH requests?" })
        return
      }
      
      await fetchData(supabaseClient, profileId)
    } catch (e) {
      console.error(e)
      toast.error("An error occurred while resuming")
    }
  }

  async function stopTimer() {
    if (!supabaseClient || !profileId) return
    if (!activeTimer) return

    // If it was paused when stopped, we need to finalize the total pause time
    let finalPauseSecs = activeTimer.total_pause_seconds || 0
    if (activeTimer.pause_started_at) {
      const pauseStart = new Date(activeTimer.pause_started_at).getTime()
      finalPauseSecs += Math.floor((getSyncedTime() - pauseStart) / 1000)
    }

    try {
      const { error } = await supabaseClient
        .from('study_timers')
        .update({ 
          ended_at: new Date(getSyncedTime()).toISOString(),
          pause_started_at: null,
          total_pause_seconds: finalPauseSecs,
          duration_seconds: Math.floor((getSyncedTime() - new Date(activeTimer.started_at).getTime()) / 1000) - finalPauseSecs,
          events: [...(activeTimer.events || []), { type: 'stop', timestamp: new Date(getSyncedTime()).toISOString() }]
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
      console.error(e)
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
    if (!supabaseClient || !profileId) return
    if (!editingTimerId || !editSubjectId) return
    try {
      await supabaseClient.from('study_timers').update({ subject_id: editSubjectId }).eq('id', editingTimerId)
      toast.success("Timer subject updated!")
      setIsEditModalOpen(false)
      fetchData(supabaseClient, profileId)
    } catch(e) {
      console.error(e)
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

  const handlePausePomo = async (now: string) => {
    if (!activePomodoroDB || !supabaseClient || !profileId) return
    const { error } = await supabaseClient.from('study_timers').update({
      pause_started_at: now,
      events: [...(activePomodoroDB.events || []), { type: 'pause', timestamp: now }]
    }).eq('id', activePomodoroDB.id)
    if (!error) fetchData(supabaseClient, profileId)
  }

  const handleStartPomo = async (now: string) => {
    if (!supabaseClient || !profileId) return
    const { data, error } = await supabaseClient.from('study_timers').insert([{
      profile_id: profileId,
      subject_id: selectedSubject,
      started_at: now,
      timer_type: 'pomodoro',
      duration_seconds: pomoDurationOpts.pomodoro * 60,
      events: [{ type: 'start', timestamp: now }]
    }]).select().single()
    
    if (error) {
      toast.error("Failed to start Pomodoro session on server")
    } else {
      setActivePomodoroDB(data)
      setPomoIsActive(true)
    }
  }

  const handleResumePomo = async (now: string) => {
    if (!activePomodoroDB?.pause_started_at || !supabaseClient || !profileId) return
    const pauseStart = new Date(activePomodoroDB.pause_started_at).getTime()
    const pauseDuration = Math.floor((getSyncedTime() - pauseStart) / 1000)
    const newTotalPause = (activePomodoroDB.total_pause_seconds || 0) + pauseDuration
    const { error } = await supabaseClient.from('study_timers').update({
      pause_started_at: null,
      total_pause_seconds: newTotalPause,
      events: [...(activePomodoroDB.events || []), { type: 'resume', timestamp: now }]
    }).eq('id', activePomodoroDB.id)
      
    if (!error) fetchData(supabaseClient, profileId)
  }

  const togglePomo = async () => {
    if (!supabaseClient || !profileId) return
    if (pomoMode === 'pomodoro') {
      if (!selectedSubject) {
        toast.error("Please select a subject first")
        return
      }

      const now = new Date(getSyncedTime()).toISOString()
      
      if (pomoIsActive) {
        await handlePausePomo(now)
      } else if (!activePomodoroDB) {
        await handleStartPomo(now)
      } else if (activePomodoroDB.pause_started_at) {
        await handleResumePomo(now)
      }
    } else {
      setPomoIsActive(!pomoIsActive)
    }
  }

  const handlePomoSkip = async () => {
    if (!supabaseClient || !profileId) return
    setPomoIsActive(false)
    if (pomoMode === 'pomodoro' && activePomodoroDB) {
       await supabaseClient.from('study_timers').delete().eq('id', activePomodoroDB.id)
       setActivePomodoroDB(null)
       toast.info("Pomodoro discarded and deleted.")
       fetchData(supabaseClient, profileId)
       handlePomoModeSwitch('shortBreak', true)
    } else if (pomoMode === 'pomodoro') {
       handlePomoModeSwitch('shortBreak', true)
    } else {
       handlePomoModeSwitch('pomodoro', true)
    }
  }

  // -------------------------

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <PageHeader 
        title="Study Timers"
        description="Track your dedicated study sessions to build powerful reports."
      />

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
                {['h-skel-1', 'h-skel-2', 'h-skel-3', 'h-skel-4'].map((key) => (
                  <div key={key} className="flex justify-between items-center p-3 border rounded-lg bg-card animate-pulse">
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
        <m.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
          
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                <m.div variants={itemVariants} initial="hidden" animate="show">
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
                <div className={`text-5xl font-mono font-bold tracking-tighter transition-all duration-500 ${activeTimer.pause_started_at ? 'text-muted-foreground opacity-70' : 'text-primary'}`}>
                  {formatTime(elapsed)}
                </div>
                {activeTimer.pause_started_at && <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Paused</p>}
                
                <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
                  {activeTimer.pause_started_at ? (
                    <Button onClick={resumeTimer} size="lg" className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground border-0 hover:bg-primary/90 transition-colors">
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
                <Button onClick={startTimer} disabled={!selectedSubject} size="lg" className="w-full gap-2 bg-primary text-primary-foreground border-0 hover:bg-primary/90 transition-colors">
                  <Play className="fill-current w-4 h-4"/> Start Focusing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </m.div>

        {/* History */}
        <m.div variants={itemVariants} initial="hidden" animate="show">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <History className="w-5 h-5"/> Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryList history={history} profile={profile} formatTime={formatTime} openEditModal={openEditModal} deleteTimer={deleteTimer} />
          </CardContent>
        </Card>
        </m.div>
        
              </div>
            </TabsContent>

            <TabsContent value="pomodoro" className="mt-0 outline-none">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Pomodoro Tracker */}
                <div className="h-full">
                  <Card className={`border-2 transition-colors duration-700 overflow-hidden h-full flex flex-col items-center justify-center p-6 min-h-100 relative ${
                    { pomodoro: 'bg-red-500/10 border-red-500/20', shortBreak: 'bg-teal-500/10 border-teal-500/20', longBreak: 'bg-blue-500/10 border-blue-500/20' }[pomoMode]
                  }`}>
                    
                    <div className="absolute top-4 right-4 z-10">
                      <Button variant="ghost" size="icon" onClick={openPomoSettings} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Settings2 className="w-5 h-5"/>
                      </Button>
                    </div>

                    {/* Subject Selector (Only show if in Pomodoro Mode, breaks don't need subjects) */}
                    <div className="w-full px-4 flex justify-center">
                      <div className="w-full max-w-50">
                        {pomoMode === 'pomodoro' ? (
                          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="flex bg-background/50 border-0 rounded-full text-xs font-bold tracking-widest w-full justify-center gap-2" size="sm">
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

                    <div className="flex gap-2 p-1.5 bg-background/50 backdrop-blur-md rounded-full mb-4">
                      <button onClick={() => handlePomoModeSwitch('pomodoro')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${pomoMode === 'pomodoro' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'text-muted-foreground hover:bg-muted'}`}>Pomodoro</button>
                      <button onClick={() => handlePomoModeSwitch('shortBreak')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${pomoMode === 'shortBreak' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-muted-foreground hover:bg-muted'}`}>Short Break</button>
                      <button onClick={() => handlePomoModeSwitch('longBreak')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${pomoMode === 'longBreak' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}>Long Break</button>
                    </div>

                    <div className="text-[100px] leading-none font-mono font-bold tracking-tighter tabular-nums">
                      {formatPomoTime(pomoTimeLeft)}
                    </div>

                    <div className="flex items-center gap-4 mt-6">
                      <Button 
                        onClick={togglePomo} 
                        size="lg" 
                        className={`text-xl font-bold h-16 px-12 rounded-3xl transition-all hover:scale-105 ${
                          pomoIsActive 
                            ? 'bg-background text-foreground border-2 border-border/50 hover:bg-muted' 
                            : { pomodoro: 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20', shortBreak: 'bg-teal-500 text-white hover:bg-teal-600 shadow-teal-500/20', longBreak: 'bg-blue-500 text-white hover:bg-blue-600' }[pomoMode]
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
                      {history.some(h => h.timer_type === 'pomodoro') ? (
                        <div className="space-y-3">
                          {history.filter(h => h.timer_type === 'pomodoro').slice(0, 10).map(h => (
                            <div key={h.id} className="flex justify-between items-center p-3 border rounded-lg bg-card gap-3 hover:border-red-500/50 transition-colors">
                              <div>
                                <p className="font-semibold">{h.subjects?.name}</p>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {h.ended_at ? new Date(h.ended_at).toLocaleDateString() : '—'} at {h.ended_at ? new Date(h.ended_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md text-sm">{Math.floor((h.duration_seconds ?? 0) / 60)}m</span>
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
                        <p className="text-sm text-muted-foreground font-medium">No completed Pomodoros yet. Focus up!</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

              </div>
            </TabsContent>
          </Tabs>

      </m.div>
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
            <Button onClick={saveTimerEdit} className="bg-primary text-primary-foreground border-0 hover:bg-primary/90">Save Changes</Button>
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
                onChange={(e) => setTempOpts({...tempOpts, pomodoro: Number.parseInt(e.target.value, 10) || 1})} 
                min="1" max="120" 
              />
            </div>
            <div className="space-y-2">
              <Label>Short Break (minutes)</Label>
              <input 
                type="number" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={tempOpts.shortBreak} 
                onChange={(e) => setTempOpts({...tempOpts, shortBreak: Number.parseInt(e.target.value, 10) || 1})} 
                min="1" max="60" 
              />
            </div>
            <div className="space-y-2">
              <Label>Long Break (minutes)</Label>
              <input 
                type="number" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={tempOpts.longBreak} 
                onChange={(e) => setTempOpts({...tempOpts, longBreak: Number.parseInt(e.target.value, 10) || 1})} 
                min="1" max="60" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
            <Button onClick={savePomoSettings} className="bg-primary text-primary-foreground border-0 hover:bg-primary/90">Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HistoryList({ history, profile, formatTime, openEditModal, deleteTimer }: Readonly<{
  history: StudyTimer[]; profile: UserProfile | null; formatTime: (secs: number) => string;
  openEditModal: (id: string, subId: string) => void; deleteTimer: (id: string) => void;
}>) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground font-medium">No study sessions recorded yet.</p>
  }
  return (
    <m.div layout className="space-y-3">
      <AnimatePresence mode="popLayout">
      {history
        .filter(h => !h.subjects || 
                     (h.subjects.type === 'academic' && profile?.academics_enabled) || 
                     (h.subjects.type === 'personal' && profile?.personal_enabled))
        .map(h => (
          <m.div 
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
                <span>{new Date(h.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {h.ended_at ? new Date(h.ended_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</span>
              </div>
              {(h.total_pause_seconds ?? 0) > 0 && (
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5 border bg-muted/50 px-1.5 py-0.5 rounded-sm inline-block">
                  Includes {Math.floor((h.total_pause_seconds ?? 0) / 60)}m paused time
                </p>
              )}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="font-mono bg-muted px-2 py-1 rounded text-sm font-medium border border-border/50">
                {(() => {
                  const start = new Date(h.started_at).getTime()
                  const end = h.ended_at ? new Date(h.ended_at).getTime() : new Date(h.started_at).getTime()
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
          </m.div>
        ))}
        </AnimatePresence>
    </m.div>
  )
}
