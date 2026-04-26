"use client"

import { useState, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  parseISO
} from "date-fns"
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Fingerprint, 
  Calendar as CalIcon,
  ArrowLeft,
  Info,
  Trophy,
  Target,
  Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"

export function SubjectDetailContent({ subject, attendanceLogs, profile, token }: { subject: any, attendanceLogs: any[], profile: any, token: string }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState(attendanceLogs)
  const [isUpdating, setIsUpdating] = useState(false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const stats = useMemo(() => {
    const present = logs.filter(l => l.status === 'present').length + (subject.legacy_attended_lectures || 0)
    const absent = logs.filter(l => l.status === 'absent').length + (subject.legacy_missed_lectures || 0)
    const deemed = logs.filter(l => l.status === 'deemed').length
    const total = present + absent + deemed
    const pct = total > 0 ? Math.round(((present + deemed) / total) * 100) : 0
    return { present, absent, deemed, total, pct }
  }, [logs, subject])

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))

  async function toggleAttendance(day: Date) {
    if (isUpdating) return
    const dateStr = format(day, 'yyyy-MM-dd')
    const existingLog = logs.find(l => l.lecture_date === dateStr)
    
    setIsUpdating(true)
    
    let nextStatus: 'present' | 'absent' | 'deemed' | null = null
    if (!existingLog) nextStatus = 'present'
    else if (existingLog.status === 'present') nextStatus = 'absent'
    else if (existingLog.status === 'absent') nextStatus = 'deemed'
    else nextStatus = null

    try {
      // 1. Delete all existing logs for this date (to handle multiple-log days cleanly in calendar view)
      const { error: delError } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('profile_id', profile.id)
        .eq('subject_id', subject.id)
        .eq('lecture_date', dateStr)

      if (delError) throw delError

      // 2. If we have a next status, insert it
      if (nextStatus) {
        const { data: newLog, error: insError } = await supabase
          .from('attendance_logs')
          .insert({
            profile_id: profile.id,
            subject_id: subject.id,
            lecture_date: dateStr,
            status: nextStatus
          })
          .select()
          .single()

        if (insError) throw insError
        
        setLogs(prev => {
          const filtered = prev.filter(l => l.lecture_date !== dateStr)
          return [...filtered, newLog]
        })
        toast.success(`Marked ${nextStatus} for ${format(day, 'MMM do')}`)
      } else {
        setLogs(prev => prev.filter(l => l.lecture_date !== dateStr))
        toast.info(`Cleared attendance for ${format(day, 'MMM do')}`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Link href="/dashboard" className="flex items-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${subject.color_hex}, ${subject.color_hex}aa)` }}
            >
              <CalIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{subject.name}</h1>
              <p className="text-muted-foreground font-medium">Attendance & Schedule Tracking</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Card className="bg-card/40 backdrop-blur-md border-border/50 px-6 py-3 shadow-sm rounded-2xl flex items-center gap-4">
            <div className="text-center border-r border-border/50 pr-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Goal</p>
              <p className="text-xl font-black text-primary">{profile.target_attendance_pct}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current</p>
              <p className={`text-xl font-black ${stats.pct >= profile.target_attendance_pct ? 'text-green-500' : 'text-destructive'}`}>
                {stats.pct}%
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Meta */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Subject Mastery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-500/10 rounded-2xl p-3 text-center border border-green-500/20">
                  <p className="text-2xl font-black text-green-600 dark:text-green-400">{stats.present}</p>
                  <p className="text-[10px] font-bold text-green-600/70 uppercase">Present</p>
                </div>
                <div className="bg-destructive/10 rounded-2xl p-3 text-center border border-destructive/20">
                  <p className="text-2xl font-black text-destructive">{stats.absent}</p>
                  <p className="text-[10px] font-bold text-destructive/70 uppercase">Absent</p>
                </div>
                <div className="bg-blue-500/10 rounded-2xl p-3 text-center border border-blue-500/20">
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.deemed}</p>
                  <p className="text-[10px] font-bold text-blue-600/70 uppercase">Deemed</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Attendance Progress</span>
                  <span>{stats.pct}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner p-0.5">
                  <motion.div 
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.pct}%` }}
                    transition={{ type: "spring", stiffness: 100 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium italic">
                  *Including {subject.legacy_attended_lectures || 0} legacy attended lectures
                </p>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Instructor</p>
                    <p className="text-sm text-muted-foreground">{subject.source_course_id?.instructor_name || "Not assigned"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Total Lectures</p>
                    <p className="text-sm text-muted-foreground">{stats.total} logged so far</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5 rounded-3xl overflow-hidden p-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" /> Usage Guide
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              Click on any date in the calendar to cycle through attendance states:
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" /> Present
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]" /> Absent
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" /> Deemed
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                <div className="w-3 h-3 rounded-full border border-border bg-background" /> No Record
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Calendar */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-8 pb-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight">{format(currentDate, 'MMMM')}</h2>
                <p className="text-muted-foreground font-bold tracking-widest uppercase text-[10px]">{format(currentDate, 'yyyy')}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth} className="h-10 w-10 rounded-xl border-border/50 bg-background/50">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth} className="h-10 w-10 rounded-xl border-border/50 bg-background/50">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              {/* Day Labels */}
              <div className="grid grid-cols-7 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-3">
                {calendarDays.map((day, idx) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const log = logs.find(l => l.lecture_date === dateStr)
                  const isCurrentMonth = isSameMonth(day, monthStart)
                  const isTodayDate = isToday(day)
                  
                  return (
                    <motion.button
                      key={dateStr}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleAttendance(day)}
                      disabled={!isCurrentMonth || isUpdating}
                      className={`
                        relative h-14 sm:h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border
                        ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                        ${log?.status === 'present' ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 shadow-[inset_0_0_15px_rgba(34,197,94,0.1)]' : ''}
                        ${log?.status === 'absent' ? 'bg-destructive/10 border-destructive/30 text-destructive shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]' : ''}
                        ${log?.status === 'deemed' ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]' : ''}
                        ${!log ? 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50' : ''}
                        ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                      `}
                    >
                      <span className={`text-base font-black ${!isCurrentMonth ? 'text-muted-foreground/20' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      
                      <div className="absolute top-1.5 right-1.5">
                        {log?.status === 'present' && <CheckCircle2 className="w-3 h-3 opacity-50" />}
                        {log?.status === 'absent' && <XCircle className="w-3 h-3 opacity-50" />}
                        {log?.status === 'deemed' && <Fingerprint className="w-3 h-3 opacity-50" />}
                      </div>

                      {isTodayDate && (
                        <span className="absolute bottom-1.5 text-[8px] font-black uppercase tracking-tighter text-primary">Today</span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
