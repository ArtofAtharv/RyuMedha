"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/dashboard/page-header"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Clock, Play, Square, Pause, History, Trash2, Timer, Pencil, Settings2, FolderOpen } from "lucide-react"
import { useProfile, type UserProfile } from "@/components/dashboard/profile-context"
import { toast } from "sonner"
import { m, AnimatePresence, Variants } from "motion/react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import type { DashboardSubject, StudyTimer } from "@/lib/dashboard-types"
import { getSourceCourse } from "@/lib/source-course"
import { SegmentedControl } from "@/components/dashboard/segmented-control"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: "easeOut" } },
}

// Type alias to avoid repeated union literals
type PomoMode = "pomodoro" | "shortBreak" | "longBreak"

// Pure helper: compute elapsed seconds for a running/paused stopwatch
function calcElapsedForTimer(timer: StudyTimer, syncedNow: number): number {
  const start = new Date(timer.started_at).getTime()
  const totalPauseSecs = timer.total_pause_seconds || 0
  if (timer.pause_started_at) {
    const pauseStart = new Date(timer.pause_started_at).getTime()
    return Math.max(0, Math.floor((pauseStart - start) / 1000) - totalPauseSecs)
  }
  return Math.max(0, Math.floor((syncedNow - start) / 1000) - totalPauseSecs)
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function formatPomoTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function playAlarmBeep() {
  if (typeof window === "undefined") return
  try {
    const audioCtx = new (
      window.AudioContext ||
      (window as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.webkitAudioContext
    )()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime) // A5 note

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)

    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.5)
  } catch (e) {
    console.error("Failed to play alarm beep", e)
  }
}

export default function TimersPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [activeTimer, setActiveTimer] = useState<StudyTimer | null>(null)
  const [history, setHistory] = useState<StudyTimer[]>([])
  const [subjects, setSubjects] = useState<DashboardSubject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [clockOffset, setClockOffset] = useState<number>(0)

  // Pomodoro State
  const [activePomodoroDB, setActivePomodoroDB] = useState<StudyTimer | null>(null)
  const [pomoMode, setPomoMode] = useState<PomoMode>("pomodoro")
  const [pomoTimeLeft, setPomoTimeLeft] = useState(25 * 60)
  const [pomoIsActive, setPomoIsActive] = useState(false)

  // Tabs State
  const [activeTab, setActiveTab] = useState("stopwatch")

  // Pomodoro Settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [pomoDurationOpts, setPomoDurationOpts] = useState({ pomodoro: 25, shortBreak: 5, longBreak: 15 })
  const [tempOpts, setTempOpts] = useState({ pomodoro: 25, shortBreak: 5, longBreak: 15 })

  // Edit Timer State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null)
  const [editSubjectId, setEditSubjectId] = useState("")

  const availableSubjects = useMemo(() => {
    return subjects.filter(
      (s) =>
        (s.type === "academic" && profile?.academics_enabled) || (s.type === "personal" && profile?.personal_enabled)
    )
  }, [subjects, profile?.academics_enabled, profile?.personal_enabled])

  useEffect(() => {
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { window: Window }).window) {
      const savedTab = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.getItem(
        "ryumedha_timers_tab"
      )
      if (savedTab) setTimeout(() => setActiveTab(savedTab), 0)
    }
  }, [])

  const handleTabChange = (val: string) => {
    setActiveTab(val)
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { window: Window }).window)
      (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem(
        "ryumedha_timers_tab",
        val
      )
  }

  // Unified time getter
  const getSyncedTime = useCallback(() => Date.now() + clockOffset, [clockOffset])

  const fetchData = useCallback(
    async (supabase: AppSupabaseClient, pid: string | null) => {
      if (!pid) return

      // Check for active timer
      const { data: activeList, error: fetchActiveErr } = await supabase
        .from("study_timers")
        .select("*, subjects(name)")
        .eq("profile_id", pid)
        .is("ended_at", null)
        .order("started_at", { ascending: false })

      if (fetchActiveErr) {
        console.error("fetchActiveErr:", fetchActiveErr)
      }

      // Stopwatch Active
      const activeSw = activeList?.find((t: StudyTimer) => t.timer_type === "stopwatch") || null
      setActiveTimer(activeSw)

      // Pomodoro Active
      const activePomo = activeList?.find((t: StudyTimer) => t.timer_type === "pomodoro") || null
      setActivePomodoroDB(activePomo)

      setElapsed(activeSw ? calcElapsedForTimer(activeSw, getSyncedTime()) : 0)

      // Recent    // History
      const { data: hist } = await supabase
        .from("study_timers")
        .select("*, subjects(id, name, type, source_course_id)")
        .eq("profile_id", pid)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(50)

      // Subjects
      const { data: rawSubs } = await supabase
        .from("subjects")
        .select("id, name, type, source_course_id")
        .eq("profile_id", pid)
        .eq("is_active", true)
        .order("name")

      const subs =
        (rawSubs as DashboardSubject[] | null)?.filter(
          (s) =>
            s.type === "personal" || getSourceCourse(s.source_course_id)?.semester_id === profile?.current_semester_id
        ) || []
      setSubjects(subs)

      const validSubjectIds = new Set(subs.map((s) => s.id))
      setHistory(((hist as StudyTimer[] | null) ?? []).filter((h) => validSubjectIds.has(h.subject_id)))

      if (!selectedSubject && subs?.[0]) setSelectedSubject(subs[0].id)
    },
    [getSyncedTime, profile?.current_semester_id, selectedSubject]
  )

  useEffect(() => {
    let mounted = true
    async function initEnv() {
      const supabase = getAppClient()
      setSupabaseClient(supabase)

      const { data: profile } = await supabase.from("profiles").select("id").single()

      if (profile) setProfileId(profile.id)

      // Calculate device clock skew relative to the server
      try {
        const startFetch = Date.now()
        const res = await fetch("/api/time")
        const data = (await res.json()) as { timestamp: number }
        const delay = (Date.now() - startFetch) / 2
        const offset = data.timestamp - delay - Date.now()
        if (mounted) setClockOffset(offset)
      } catch (e) {
        console.warn("Time sync failed, using local time", e)
      }
    }
    initEnv()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    async function load() {
      if (supabaseClient) {
        await fetchData(supabaseClient, profileId)
        setTimeout(() => setIsLoading(false), 0)
      }
    }
    load()
  }, [fetchData, supabaseClient, profileId])

  // Helper: set pomo time left based on current mode
  const applyPomoModeTime = useCallback((mode: PomoMode, opts: typeof pomoDurationOpts) => {
    if (mode === "pomodoro") setPomoTimeLeft(opts.pomodoro * 60)
    else if (mode === "shortBreak") setPomoTimeLeft(opts.shortBreak * 60)
    else setPomoTimeLeft(opts.longBreak * 60)
  }, [])

  const handlePomoModeSwitch = useCallback(
    (mode: PomoMode, force = false) => {
      if (!force && activePomodoroDB && mode !== "pomodoro") {
        toast.error("You have an active Pomodoro session running!")
        return
      }
      setPomoIsActive(false)
      setPomoMode(mode)
      applyPomoModeTime(mode, pomoDurationOpts)
    },
    [activePomodoroDB, pomoDurationOpts, applyPomoModeTime]
  )

  const savePomoSession = useCallback(
    async (dbRecord: StudyTimer) => {
      if (!supabaseClient || !profileId) return
      const now = new Date(getSyncedTime()).toISOString()
      try {
        const target = dbRecord.duration_seconds || pomoDurationOpts.pomodoro * 60
        await supabaseClient
          .from("study_timers")
          .update({
            ended_at: now,
            duration_seconds: target,
            events: [...(dbRecord.events || []), { type: "complete", timestamp: now }],
          })
          .eq("id", dbRecord.id)
        toast.success("Focus Session Complete! Data saved.")
        setActivePomodoroDB(null)
        fetchData(supabaseClient, profileId)
      } catch (e) {
        console.error("Failed to save Pomodoro session", e)
        toast.error("Failed to save Pomodoro session")
      }
    },
    [supabaseClient, profileId, getSyncedTime, pomoDurationOpts.pomodoro, fetchData]
  )

  const handlePomoComplete = useCallback(
    async (passedDbRecord?: StudyTimer) => {
      if (!supabaseClient || !profileId) return
      setPomoIsActive(false)
      playAlarmBeep()

      if (pomoMode === "pomodoro") {
        const dbRecord = passedDbRecord || activePomodoroDB
        if (dbRecord) {
          await savePomoSession(dbRecord)
        } else {
          toast.info("Completed early Pomodoro fallback.")
        }
        handlePomoModeSwitch("shortBreak", true)
      } else {
        toast.success("Break Over! Back to work.")
        handlePomoModeSwitch("pomodoro", true)
      }
    },
    [pomoMode, activePomodoroDB, supabaseClient, profileId, savePomoSession, handlePomoModeSwitch]
  )

  // Live counter for active timer
  useEffect(() => {
    if (!activeTimer) return
    if (activeTimer.pause_started_at) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsed(calcElapsedForTimer(activeTimer, 0))
      return
    }
    const interval = setInterval(() => {
      setElapsed(calcElapsedForTimer(activeTimer, Date.now() + clockOffset))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTimer, clockOffset])

  // Pomodoro DB -> Local UI Sync
  useEffect(() => {
    if (!activePomodoroDB) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activePomodoroDB.is_synced) setPomoMode("pomodoro")
    if (activePomodoroDB.subject_id && !selectedSubject) setSelectedSubject(activePomodoroDB.subject_id)

    const target = activePomodoroDB.duration_seconds || pomoDurationOpts.pomodoro * 60
    const elapsed = calcElapsedForTimer(activePomodoroDB, getSyncedTime())
    setPomoIsActive(!activePomodoroDB.pause_started_at)
    setPomoTimeLeft(Math.max(0, target - elapsed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePomodoroDB, pomoDurationOpts.pomodoro, clockOffset])

  // Local/DB Pomodoro Interval
  useEffect(() => {
    if (!pomoIsActive) return
    const interval = setInterval(() => {
      if (pomoMode === "pomodoro" && activePomodoroDB) {
        const target = activePomodoroDB.duration_seconds || pomoDurationOpts.pomodoro * 60
        const left = target - calcElapsedForTimer(activePomodoroDB, getSyncedTime())
        if (left <= 0) {
          setPomoTimeLeft(0)
          setPomoIsActive(false)
          handlePomoComplete(activePomodoroDB)
        } else {
          setPomoTimeLeft(left)
        }
      } else {
        setPomoTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [pomoIsActive, pomoMode, activePomodoroDB, pomoDurationOpts.pomodoro, getSyncedTime, handlePomoComplete])

  useEffect(() => {
    if (pomoIsActive && pomoMode !== "pomodoro" && pomoTimeLeft === 0) {
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
        .from("study_timers")
        .update({ ended_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .is("ended_at", null)
    } catch (e) {
      console.warn("Safety check failed (likely CORS/PATCH issue), proceeding anyway:", e)
    }

    const { error } = await supabaseClient.from("study_timers").insert([
      {
        profile_id: profileId,
        subject_id: selectedSubject,
        started_at: new Date(getSyncedTime()).toISOString(),
        timer_type: "stopwatch",
        events: [{ type: "start", timestamp: new Date(getSyncedTime()).toISOString() }],
      },
    ])

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
        .from("study_timers")
        .update({
          pause_started_at: new Date(getSyncedTime()).toISOString(),
          events: [
            ...(activeTimer.events || []),
            { type: "pause", timestamp: new Date(getSyncedTime()).toISOString() },
          ],
        })
        .eq("id", activeTimer.id)

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
        .from("study_timers")
        .update({
          pause_started_at: null,
          total_pause_seconds: newTotalPause,
          events: [
            ...(activeTimer.events || []),
            { type: "resume", timestamp: new Date(getSyncedTime()).toISOString() },
          ],
        })
        .eq("id", activeTimer.id)

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
        .from("study_timers")
        .update({
          ended_at: new Date(getSyncedTime()).toISOString(),
          pause_started_at: null,
          total_pause_seconds: finalPauseSecs,
          duration_seconds:
            Math.floor((getSyncedTime() - new Date(activeTimer.started_at).getTime()) / 1000) - finalPauseSecs,
          events: [...(activeTimer.events || []), { type: "stop", timestamp: new Date(getSyncedTime()).toISOString() }],
        })
        .eq("id", activeTimer.id)

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
    await supabaseClient.from("study_timers").delete().eq("id", id)
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
      await supabaseClient.from("study_timers").update({ subject_id: editSubjectId }).eq("id", editingTimerId)
      toast.success("Timer subject updated!")
      setIsEditModalOpen(false)
      fetchData(supabaseClient, profileId)
    } catch (e) {
      console.error(e)
      toast.error("Failed to update timer")
    }
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
    applyPomoModeTime(pomoMode, tempOpts)
    toast.success("Timer settings updated")
  }

  const handlePausePomo = async (now: string) => {
    if (!activePomodoroDB || !supabaseClient || !profileId) return
    const { error } = await supabaseClient
      .from("study_timers")
      .update({
        pause_started_at: now,
        events: [...(activePomodoroDB.events || []), { type: "pause", timestamp: now }],
      })
      .eq("id", activePomodoroDB.id)
    if (!error) fetchData(supabaseClient, profileId)
  }

  const handleStartPomo = async (now: string) => {
    if (!supabaseClient || !profileId) return
    const { data, error } = await supabaseClient
      .from("study_timers")
      .insert([
        {
          profile_id: profileId,
          subject_id: selectedSubject,
          started_at: now,
          timer_type: "pomodoro",
          duration_seconds: pomoDurationOpts.pomodoro * 60,
          events: [{ type: "start", timestamp: now }],
        },
      ])
      .select()
      .single()

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
    const { error } = await supabaseClient
      .from("study_timers")
      .update({
        pause_started_at: null,
        total_pause_seconds: newTotalPause,
        events: [...(activePomodoroDB.events || []), { type: "resume", timestamp: now }],
      })
      .eq("id", activePomodoroDB.id)

    if (!error) fetchData(supabaseClient, profileId)
  }

  const togglePomo = async () => {
    if (!supabaseClient || !profileId) return
    if (pomoMode === "pomodoro") {
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
    const isActivePomodoroMode = pomoMode === "pomodoro" && activePomodoroDB
    if (isActivePomodoroMode) {
      await supabaseClient.from("study_timers").delete().eq("id", activePomodoroDB.id)
      setActivePomodoroDB(null)
      toast.info("Pomodoro discarded and deleted.")
      fetchData(supabaseClient, profileId)
    }
    handlePomoModeSwitch(pomoMode === "pomodoro" ? "shortBreak" : "pomodoro", true)
  }

  // -------------------------

  const hasNoTracks = !profile?.academics_enabled && !profile?.personal_enabled

  if (hasNoTracks) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
        <PageHeader title="Study Timers" description="Track your dedicated study sessions to build powerful reports." />
        <Card className="bg-card/60 rounded-3xl border-none shadow-lg backdrop-blur-2xl">
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-20 text-center">
            <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
              <FolderOpen className="text-muted-foreground/60 h-10 w-10" />
            </div>
            <div className="max-w-sm space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">Tracks Disabled</CardTitle>
              <CardDescription className="text-muted-foreground/80 text-base leading-relaxed font-medium">
                Both Academic and Personal tracking are currently disabled. Enable at least one track in Settings to
                start tracking study sessions.
              </CardDescription>
            </div>
            <Button
              onClick={() => router.push("/dashboard/profile")}
              className="h-12 cursor-pointer rounded-2xl px-8 text-base font-semibold"
            >
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      <PageHeader title="Study Timers" description="Track your dedicated study sessions to build powerful reports." />

      {isLoading ? (
        <TimersSkeleton />
      ) : (
        <m.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="mx-auto mb-8 flex max-w-md justify-center">
              <SegmentedControl
                activeSegment={activeTab}
                onChange={handleTabChange}
                fullWidth={true}
                segments={[
                  { id: "stopwatch", label: "Stopwatch", icon: Clock },
                  { id: "pomodoro", label: "Pomodoro", icon: Timer },
                ]}
              />
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "stopwatch" && (
                <m.div
                  key="stopwatch-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <TabsContent value="stopwatch" className="mt-0 outline-none" forceMount>
                    <m.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="grid gap-6 md:grid-cols-2"
                    >
                      <StopwatchCard
                        activeTimer={activeTimer}
                        elapsed={elapsed}
                        selectedSubject={selectedSubject}
                        setSelectedSubject={setSelectedSubject}
                        availableSubjects={availableSubjects}
                        startTimer={startTimer}
                        pauseTimer={pauseTimer}
                        resumeTimer={resumeTimer}
                        stopTimer={stopTimer}
                      />
                      <m.div variants={itemVariants}>
                        <Card className="border-border/40 bg-card/40 h-full backdrop-blur-3xl">
                          <CardHeader>
                            <CardTitle className="text-muted-foreground flex items-center gap-2">
                              <History className="h-5 w-5" /> Recent Sessions
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <HistoryList
                              history={history}
                              profile={profile}
                              formatTime={formatTime}
                              openEditModal={openEditModal}
                              deleteTimer={deleteTimer}
                            />
                          </CardContent>
                        </Card>
                      </m.div>
                    </m.div>
                  </TabsContent>
                </m.div>
              )}

              {activeTab === "pomodoro" && (
                <m.div
                  key="pomodoro-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <TabsContent value="pomodoro" className="mt-0 outline-none" forceMount>
                    <m.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="grid gap-6 md:grid-cols-2"
                    >
                      <PomodoroTrackerCard
                        pomoMode={pomoMode}
                        pomoTimeLeft={pomoTimeLeft}
                        pomoIsActive={pomoIsActive}
                        selectedSubject={selectedSubject}
                        setSelectedSubject={setSelectedSubject}
                        availableSubjects={availableSubjects}
                        openPomoSettings={openPomoSettings}
                        handlePomoModeSwitch={handlePomoModeSwitch}
                        togglePomo={togglePomo}
                        handlePomoSkip={handlePomoSkip}
                      />
                      <PomodoroHistoryCard history={history} openEditModal={openEditModal} deleteTimer={deleteTimer} />
                    </m.div>
                  </TabsContent>
                </m.div>
              )}
            </AnimatePresence>
          </Tabs>
        </m.div>
      )}

      {/* Edit Timer Dialog */}
      <Dialog modal={false} open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Timer Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Re-assign Subject</Label>
              <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a Subject" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTimerEdit} className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pomodoro Settings Dialog */}
      <Dialog modal={false} open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Timer Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pomodoro (minutes)</Label>
              <input
                type="number"
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={tempOpts.pomodoro}
                onChange={(e) => setTempOpts({ ...tempOpts, pomodoro: Number.parseInt(e.target.value, 10) || 1 })}
                min="1"
                max="120"
              />
            </div>
            <div className="space-y-2">
              <Label>Short Break (minutes)</Label>
              <input
                type="number"
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={tempOpts.shortBreak}
                onChange={(e) => setTempOpts({ ...tempOpts, shortBreak: Number.parseInt(e.target.value, 10) || 1 })}
                min="1"
                max="60"
              />
            </div>
            <div className="space-y-2">
              <Label>Long Break (minutes)</Label>
              <input
                type="number"
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={tempOpts.longBreak}
                onChange={(e) => setTempOpts({ ...tempOpts, longBreak: Number.parseInt(e.target.value, 10) || 1 })}
                min="1"
                max="60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={savePomoSettings}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TimersSkeleton() {
  return (
    <div className="animate-in fade-in grid gap-6 duration-500 md:grid-cols-2">
      {/* Active Timer Skeleton */}
      <Card className="border-border/30 shadow-sm">
        <CardHeader>
          <div className="bg-muted h-6 w-32 animate-pulse rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
              <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
            </div>
            <div className="bg-primary/20 mt-4 h-12 w-full animate-pulse rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* History Skeleton */}
      <Card>
        <CardHeader>
          <div className="bg-muted h-6 w-40 animate-pulse rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {["h-skel-1", "h-skel-2", "h-skel-3", "h-skel-4"].map((key) => (
              <div key={key} className="bg-card flex animate-pulse items-center justify-between rounded-lg border p-3">
                <div className="space-y-2">
                  <div className="bg-muted h-5 w-24 rounded-md" />
                  <div className="bg-muted/60 h-3 w-16 rounded-md" />
                </div>
                <div className="flex gap-2">
                  <div className="bg-muted h-6 w-12 rounded-md" />
                  <div className="bg-muted h-8 w-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StopwatchCard({
  activeTimer,
  elapsed,
  selectedSubject,
  setSelectedSubject,
  availableSubjects,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
}: Readonly<{
  activeTimer: StudyTimer | null
  elapsed: number
  selectedSubject: string
  setSelectedSubject: (id: string) => void
  availableSubjects: DashboardSubject[]
  startTimer: () => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
}>) {
  return (
    <m.div variants={itemVariants} className="h-full">
      <Card className="border-border/40 bg-card/40 h-full shadow-sm backdrop-blur-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-primary h-5 w-5" /> Active Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTimer ? (
            <div className="space-y-4 py-6 text-center">
              <p className="text-muted-foreground text-lg font-medium">{activeTimer.subjects?.name}</p>
              <div
                className={`font-mono text-5xl font-bold tracking-tighter transition-all duration-500 ${activeTimer.pause_started_at ? "text-muted-foreground opacity-70" : "text-primary"}`}
              >
                {formatTime(elapsed)}
              </div>
              {activeTimer.pause_started_at && (
                <p className="text-muted-foreground text-sm font-bold tracking-widest uppercase">Paused</p>
              )}

              <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
                {activeTimer.pause_started_at ? (
                  <Button
                    onClick={resumeTimer}
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 w-full gap-2 border-0 transition-colors sm:w-auto"
                  >
                    <Play className="h-4 w-4 fill-current" /> Resume
                  </Button>
                ) : (
                  <Button
                    onClick={pauseTimer}
                    variant="outline"
                    size="lg"
                    className="hover:bg-muted w-full gap-2 sm:w-auto"
                  >
                    <Pause className="h-4 w-4 fill-current" /> Pause
                  </Button>
                )}
                <Button onClick={stopTimer} variant="destructive" size="lg" className="w-full gap-2 sm:w-auto">
                  <Square className="h-4 w-4 fill-current" /> Stop Timer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none">
                    <SelectValue placeholder="Select a Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={startTimer}
                disabled={!selectedSubject}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full gap-2 border-0 transition-colors"
              >
                <Play className="h-4 w-4 fill-current" /> Start Focusing
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </m.div>
  )
}

function PomodoroTrackerCard({
  pomoMode,
  pomoTimeLeft,
  pomoIsActive,
  selectedSubject,
  setSelectedSubject,
  availableSubjects,
  openPomoSettings,
  handlePomoModeSwitch,
  togglePomo,
  handlePomoSkip,
}: Readonly<{
  pomoMode: PomoMode
  pomoTimeLeft: number
  pomoIsActive: boolean
  selectedSubject: string
  setSelectedSubject: (id: string) => void
  availableSubjects: DashboardSubject[]
  openPomoSettings: () => void
  handlePomoModeSwitch: (mode: PomoMode) => void
  togglePomo: () => void
  handlePomoSkip: () => void
}>) {
  return (
    <m.div variants={itemVariants} className="h-full">
      <Card
        className={`border-border/40 bg-card/40 relative flex h-full min-h-[400px] flex-col items-center justify-center overflow-hidden p-6 backdrop-blur-3xl transition-colors duration-700`}
      >
        {/* Subtle background color overlay based on Pomodoro Mode */}
        <div
          className={`pointer-events-none absolute inset-0 z-0 transition-colors duration-700 ${
            { pomodoro: "bg-red-500/5", shortBreak: "bg-teal-500/5", longBreak: "bg-blue-500/5" }[pomoMode]
          }`}
        />

        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={openPomoSettings}
            className="text-muted-foreground hover:text-foreground h-8 w-8"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Subject Selector */}
        <div className="flex w-full justify-center px-4">
          <div className="w-full max-w-50">
            {pomoMode === "pomodoro" ? (
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger
                  className="bg-background/50 flex w-full justify-center gap-2 rounded-full border-0 text-xs font-bold tracking-widest"
                  size="sm"
                >
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-muted-foreground bg-background/30 mx-auto flex h-8 w-fit items-center justify-center rounded-full px-4 text-xs font-bold tracking-widest uppercase">
                Break Time
              </div>
            )}
          </div>
        </div>

        <div className="bg-background/50 mb-4 flex gap-2 rounded-full p-1.5 backdrop-blur-md">
          <button
            onClick={() => handlePomoModeSwitch("pomodoro")}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${pomoMode === "pomodoro" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "text-muted-foreground hover:bg-muted"}`}
          >
            Pomodoro
          </button>
          <button
            onClick={() => handlePomoModeSwitch("shortBreak")}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${pomoMode === "shortBreak" ? "bg-teal-500 text-white shadow-md shadow-teal-500/20" : "text-muted-foreground hover:bg-muted"}`}
          >
            Short Break
          </button>
          <button
            onClick={() => handlePomoModeSwitch("longBreak")}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${pomoMode === "longBreak" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            Long Break
          </button>
        </div>

        <div className="font-mono text-[100px] leading-none font-bold tracking-tighter tabular-nums">
          {formatPomoTime(pomoTimeLeft)}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Button
            onClick={togglePomo}
            size="lg"
            className={`h-16 rounded-3xl px-12 text-xl font-bold transition-all hover:scale-105 ${
              pomoIsActive
                ? "bg-background text-foreground border-border/50 hover:bg-muted border-2"
                : {
                    pomodoro: "bg-red-500 text-white shadow-red-500/20 hover:bg-red-600",
                    shortBreak: "bg-teal-500 text-white shadow-teal-500/20 hover:bg-teal-600",
                    longBreak: "bg-blue-500 text-white hover:bg-blue-600",
                  }[pomoMode]
            }`}
          >
            {pomoIsActive ? "PAUSE" : "START"}
          </Button>

          {pomoIsActive && (
            <Button
              onClick={handlePomoSkip}
              variant="ghost"
              size="icon"
              className="bg-background/50 hover:bg-background/80 h-14 w-14 rounded-full shadow-md"
            >
              <Square className="h-5 w-5 fill-current opacity-70" />
            </Button>
          )}
        </div>
      </Card>
    </m.div>
  )
}

function PomodoroHistoryCard({
  history,
  openEditModal,
  deleteTimer,
}: Readonly<{
  history: StudyTimer[]
  openEditModal: (id: string, subId: string) => void
  deleteTimer: (id: string) => void
}>) {
  const pomoHistory = history.filter((h) => h.timer_type === "pomodoro")
  return (
    <m.div variants={itemVariants} className="h-full">
      <Card className="border-border/40 bg-card/40 h-full backdrop-blur-3xl">
        <CardHeader>
          <CardTitle className="text-muted-foreground flex items-center gap-2">
            <History className="h-5 w-5" /> Pomodoro History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pomoHistory.length > 0 ? (
            <div className="space-y-3">
              {pomoHistory.slice(0, 10).map((h) => (
                <div
                  key={h.id}
                  className="border-border/40 bg-card/40 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-sm backdrop-blur-xl transition-colors hover:border-red-500/50"
                >
                  <div>
                    <p className="font-semibold">{h.subjects?.name}</p>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {h.ended_at ? new Date(h.ended_at).toLocaleDateString() : "Active"} at{" "}
                      {h.ended_at
                        ? new Date(h.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Now"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-red-500/10 px-2 py-1 text-sm font-bold text-red-500">
                      {Math.floor((h.duration_seconds ?? 0) / 60)}m
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(h.id, h.subject_id)}
                      className="text-muted-foreground hover:text-primary h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTimer(h.id)}
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm font-medium">No completed Pomodoros yet. Focus up!</p>
          )}
        </CardContent>
      </Card>
    </m.div>
  )
}

function HistoryList({
  history,
  profile,
  formatTime,
  openEditModal,
  deleteTimer,
}: Readonly<{
  history: StudyTimer[]
  profile: UserProfile | null
  formatTime: (secs: number) => string
  openEditModal: (id: string, subId: string) => void
  deleteTimer: (id: string) => void
}>) {
  if (history.length === 0) {
    return <p className="text-muted-foreground text-sm font-medium">No study sessions recorded yet.</p>
  }
  return (
    <m.div layout className="space-y-3">
      <AnimatePresence mode="popLayout">
        {history
          .filter(
            (h) =>
              !h.subjects ||
              (h.subjects.type === "academic" && profile?.academics_enabled) ||
              (h.subjects.type === "personal" && profile?.personal_enabled)
          )
          .map((h) => (
            <m.div
              key={h.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border-border/40 bg-card/40 flex flex-col gap-3 rounded-xl border p-3 shadow-sm backdrop-blur-xl transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{h.subjects?.name}</p>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                  <span>{new Date(h.started_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>
                    {new Date(h.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {h.ended_at
                      ? new Date(h.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Now"}
                  </span>
                </div>
                {(h.total_pause_seconds ?? 0) > 0 && (
                  <p className="text-muted-foreground bg-muted/50 mt-0.5 inline-block rounded-sm border px-1.5 py-0.5 text-[10px] font-medium">
                    Includes {Math.floor((h.total_pause_seconds ?? 0) / 60)}m paused time
                  </p>
                )}
              </div>
              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <div className="bg-muted border-border/50 rounded border px-2 py-1 font-mono text-sm font-medium">
                  {(() => {
                    const start = new Date(h.started_at).getTime()
                    const end = h.ended_at ? new Date(h.ended_at).getTime() : new Date(h.started_at).getTime()
                    const grossSecs = Math.floor((end - start) / 1000)
                    const netSecs = Math.max(0, grossSecs - (h.total_pause_seconds || 0))
                    return formatTime(netSecs)
                  })()}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(h.id, h.subject_id)}
                  className="text-muted-foreground hover:text-primary bg-muted/40 hover:bg-primary/10 h-8 w-8 shrink-0 rounded-md"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTimer(h.id)}
                  className="text-muted-foreground hover:text-destructive bg-muted/40 hover:bg-destructive/10 h-8 w-8 shrink-0 rounded-md"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </m.div>
          ))}
      </AnimatePresence>
    </m.div>
  )
}
