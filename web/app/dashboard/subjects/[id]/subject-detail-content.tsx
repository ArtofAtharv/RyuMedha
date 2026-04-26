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
  Clock,
  Plus,
  Trash2,
  CalendarDays
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
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

  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const dayLogs = useMemo(() => {
    if (!selectedDay) return []
    const dateStr = format(selectedDay, 'yyyy-MM-dd')
    return logs.filter(l => l.lecture_date === dateStr).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [selectedDay, logs])

  async function addAttendanceLog(status: 'present' | 'absent' | 'deemed') {
    if (!selectedDay || isUpdating) return
    const dateStr = format(selectedDay, 'yyyy-MM-dd')
    setIsUpdating(true)

    try {
      const { data: newLog, error } = await supabase
        .from('attendance_logs')
        .insert({
          profile_id: profile.id,
          subject_id: subject.id,
          lecture_date: dateStr,
          status
        })
        .select()
        .single()

      if (error) throw error
      setLogs(prev => [...prev, newLog])
      toast.success(`Added ${status} lecture`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsUpdating(false)
    }
  }

  async function deleteAttendanceLog(id: string) {
    if (isUpdating) return
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', id)

      if (error) throw error
      setLogs(prev => prev.filter(l => l.id !== id))
      toast.info("Lecture record removed")
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
                  const dayLogsForGrid = logs.filter(l => l.lecture_date === dateStr)
                  const isCurrentMonth = isSameMonth(day, monthStart)
                  const isTodayDate = isToday(day)
                  
                  return (
                    <motion.button
                      key={dateStr}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedDay(day)}
                      disabled={!isCurrentMonth}
                      className={`
                        relative h-14 sm:h-24 rounded-2xl flex flex-col items-center justify-between p-2 transition-all duration-300 border
                        ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                        ${dayLogsForGrid.length > 0 ? 'bg-card/80 border-primary/20 shadow-sm' : 'bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40'}
                        ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-background z-20' : ''}
                      `}
                    >
                      <span className={`text-base font-black self-start ${!isCurrentMonth ? 'text-muted-foreground/20' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      
                      {/* Status Indicators Container */}
                      <div className="flex flex-wrap gap-1 justify-center w-full pb-1">
                        {dayLogsForGrid.map((l, i) => (
                          <div 
                            key={l.id || i} 
                            className={`w-2 h-2 rounded-full shadow-sm ${
                              l.status === 'present' ? 'bg-green-500 shadow-green-500/40' : 
                              l.status === 'absent' ? 'bg-destructive shadow-destructive/40' : 
                              'bg-blue-500 shadow-blue-500/40'
                            }`} 
                          />
                        ))}
                      </div>

                      {isTodayDate && (
                        <span className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-tighter text-primary bg-primary/10 px-1 rounded">Today</span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-gradient-to-br from-card to-muted/20 p-6 pt-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black">{selectedDay ? format(selectedDay, 'EEEE, MMM do') : ''}</DialogTitle>
                  <DialogDescription className="font-medium">Manage lectures for this day</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {dayLogs.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50">
                    <p className="text-sm font-bold text-muted-foreground">No lectures logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayLogs.map((log, index) => (
                      <div key={log.id} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50 shadow-sm group">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-muted-foreground w-4">#{index + 1}</span>
                          <Badge 
                            variant="secondary" 
                            className={`
                              font-black uppercase text-[10px] tracking-widest px-2.5 py-1 rounded-lg
                              ${log.status === 'present' ? 'bg-green-500/10 text-green-600' : 
                                log.status === 'absent' ? 'bg-destructive/10 text-destructive' : 
                                'bg-blue-500/10 text-blue-600'}
                            `}
                          >
                            {log.status}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteAttendanceLog(log.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 text-center">Add New Lecture</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    onClick={() => addAttendanceLog('present')}
                    disabled={isUpdating}
                    className="flex flex-col gap-1 h-16 rounded-2xl bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Present</span>
                  </Button>
                  <Button 
                    onClick={() => addAttendanceLog('absent')}
                    disabled={isUpdating}
                    className="flex flex-col gap-1 h-16 rounded-2xl bg-destructive hover:bg-destructive/110 shadow-lg shadow-destructive/20"
                  >
                    <XCircle className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Absent</span>
                  </Button>
                  <Button 
                    onClick={() => addAttendanceLog('deemed')}
                    disabled={isUpdating}
                    className="flex flex-col gap-1 h-16 rounded-2xl bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                  >
                    <Fingerprint className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Deemed</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-muted/30 border-t border-border/50">
            <Button variant="ghost" onClick={() => setSelectedDay(null)} className="w-full font-bold">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
