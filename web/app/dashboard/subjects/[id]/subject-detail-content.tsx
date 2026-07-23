"use client"

import { useState, useMemo } from "react"
import { getAppClient } from "@/lib/supabase-client"
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
  isToday
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
  Trash2,
  CalendarDays,
  Pencil,
  Plus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import Link from "next/link"
import { m } from "motion/react"
import { haptic } from "@/lib/haptic"
import { createReminder, deleteReminder } from "@/app/actions/google-tasks"

interface SubjectCourse {
  id?: string
  instructor_name?: string
  expected_total_lectures?: number
  exam_dates?: Record<string, string>
}

interface SubjectData {
  id: string
  name: string
  color_hex?: string
  source_course_id?: SubjectCourse
  instructor_name?: string
  expected_total_lectures?: number
}

interface AttendanceLog {
  id: string
  status: string
  lecture_date: string
  created_at: string
}

interface ProfileData {
  id: string
  target_attendance_pct: number
}

export function SubjectDetailContent({ subject, attendanceLogs, exams = [], profile, token }: Readonly<{ subject: SubjectData, attendanceLogs: AttendanceLog[], exams: Record<string, unknown>[], profile: ProfileData, token: string }>) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState(attendanceLogs)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localSubject, setLocalSubject] = useState(subject)
  const [localExams, setLocalExams] = useState(exams)

  // Edit Subject states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editName, setEditName] = useState(subject.name)
  const [editInstructor, setEditInstructor] = useState(
    (subject as any   ).source_course_id?.instructor_name || (subject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).instructor_name || ""
  )
  const [editExpectedLectures, setEditExpectedLectures] = useState(
    (subject as any   ).source_course_id?.expected_total_lectures || (subject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).expected_total_lectures || 0
  )
  const [editColorHex, setEditColorHex] = useState(subject.color_hex || "#8b5cf6")

  // Add Exam states
  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false)
  const [examLabel, setExamLabel] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)

  const supabase = useMemo(
    () => getAppClient({ global: { headers: { Authorization: `Bearer ${token}` } } }),
    [token]
  )

  async function handleSaveSubject() {
    if (!editName.trim() || isUpdating) return
    setIsUpdating(true)
    try {
      const isAcademic = (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).type === 'academic'
      
      if (isAcademic && (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).source_course_id) {
        const courseId = (localSubject as any   ).source_course_id.id || (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).source_course_id
        await supabase
          .from('academic_courses')
          .update({
            instructor_name: editInstructor,
            expected_total_lectures: Number(editExpectedLectures)
          })
          .eq('id', courseId)
      }

      const updates: Record<string, unknown> = {
        name: editName.trim(),
        color_hex: editColorHex,
        expected_total_lectures: Number(editExpectedLectures),
        instructor_name: editInstructor
      }

      const { data, error } = await supabase
        .from('subjects')
        .update(updates)
        .eq('id', localSubject.id)
        .select('*, source_course_id(*)')
        .single()

      if (error) throw error
      setLocalSubject(data || {
        ...localSubject,
        name: editName.trim(),
        color_hex: editColorHex,
        source_course_id: isAcademic ? {
          ...(localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).source_course_id,
          instructor_name: editInstructor,
          expected_total_lectures: Number(editExpectedLectures)
        } : undefined,
        instructor_name: editInstructor,
        expected_total_lectures: Number(editExpectedLectures)
      })
      toast.success("Subject details updated")
      setIsEditModalOpen(false)
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to update subject")
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleAddExam() {
    if (!examLabel.trim() || !examDate || isUpdating) return
    setIsUpdating(true)
    try {
      const dateStr = format(examDate, 'yyyy-MM-dd')
      
      let createdTask = null
      try {
        createdTask = await createReminder({
          title: `[Exam] ${examLabel.trim()}`,
          due: new Date(dateStr).toISOString(),
          subjectId: localSubject.id,
          reminderSettings: {
            dueTime: true,
            oneDayPrior: true,
            twoDaysPrior: false,
            oneWeekPrior: true,
            twoWeeksPrior: false,
            customPrior: false
          }
        })
      } catch (googleError) {
        console.warn("Google Tasks sync failed, falling back to direct db insert:", googleError)
      }

      if (!createdTask) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            profile_id: profile.id,
            subject_id: localSubject.id,
            title: `[Exam] ${examLabel.trim()}`,
            due_date: dateStr,
            priority: 'high',
            is_completed: false,
            is_exam: true
          })
          .select()
          .single()
        if (error) throw error
        createdTask = data
      } else {
        await supabase
          .from('tasks')
          .update({ is_exam: true })
          .eq('title', `[Exam] ${examLabel.trim()}`)
          .eq('profile_id', profile.id)
      }

      const isAcademic = (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).type === 'academic'
      if (isAcademic && (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).source_course_id) {
        const courseId = (localSubject as any   ).source_course_id.id || (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).source_course_id
        const existingDates = (localSubject as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ).source_course_id.exam_dates || {}
        const updatedDates = { ...existingDates, [examLabel.trim()]: dateStr }
        await supabase
          .from('academic_courses')
          .update({ exam_dates: updatedDates })
          .eq('id', courseId)
      }

      setLocalExams(prev => [...prev, createdTask])
      toast.success("Exam date added successfully")
      setIsAddExamModalOpen(false)
      setExamLabel("")
      setExamDate(null)
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to add exam")
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDeleteExam(taskId: string) {
    if (isUpdating) return
    setIsUpdating(true)
    try {
      if (localExams.some(ex => ex.id === taskId)) {
        await deleteReminder(taskId)
      }
      setLocalExams(prev => prev.filter(ex => ex.id !== taskId))
      toast.success("Exam deleted successfully")
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to delete exam")
    } finally {
      setIsUpdating(false)
    }
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const stats = useMemo(() => {
    const present = logs.filter(l => l.status === 'present').length
    const absent = logs.filter(l => l.status === 'absent').length
    const deemed = logs.filter(l => l.status === 'deemed').length
    const total = present + absent + deemed
    const pct = total > 0 ? Math.round(((present + deemed) / total) * 100) : 0
    return { present, absent, deemed, total, pct }
  }, [logs])

  const nextMonth = () => { haptic(); setCurrentDate(addMonths(currentDate, 1)); }
  const prevMonth = () => { haptic(); setCurrentDate(subMonths(currentDate, 1)); }

  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const dayLogs = useMemo(() => {
    if (!selectedDay) return []
    const dateStr = format(selectedDay, 'yyyy-MM-dd')
    return logs.filter(l => l.lecture_date === dateStr).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [selectedDay, logs])

  async function addAttendanceLog(status: 'present' | 'absent' | 'deemed') {
    haptic()
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? (e as Error).message : String(e))
    } finally {
      setIsUpdating(false)
    }
  }

  async function deleteAttendanceLog(id: string) {
    haptic()
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? (e as Error).message : String(e))
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Goal Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/subjects" className="p-3 bg-muted/50 rounded-2xl hover:bg-muted transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background: localSubject.color_hex }}
            >
              <CalIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{localSubject.name}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="hidden lg:block" />
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/40 backdrop-blur-xl rounded-[2.5rem] px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-12">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Goal</p>
                  <p className="text-xl font-bold text-primary">{profile.target_attendance_pct}%</p>
                </div>
                
                <div className="h-6 w-px bg-border/40" />
                
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current</p>
                  <p className={`text-xl font-bold ${stats.pct >= profile.target_attendance_pct ? 'text-green-500' : 'text-destructive'}`}>
                    {stats.pct}%
                  </p>
                </div>
              </div>

              <Badge variant="outline" className={`font-bold px-6 py-1.5 rounded-full whitespace-nowrap shadow-sm ${stats.pct >= profile.target_attendance_pct ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                {stats.pct >= profile.target_attendance_pct ? 'SAFE' : 'ACTION REQUIRED'}
              </Badge>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Meta */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-xl rounded-3xl overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Subject Mastery
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
                <Pencil className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-500/10 rounded-2xl p-3 text-center border border-green-500/20">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.present}</p>
                  <p className="text-[10px] font-bold text-green-600/70 uppercase">Present</p>
                </div>
                <div className="bg-destructive/10 rounded-2xl p-3 text-center border border-destructive/20">
                  <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
                  <p className="text-[10px] font-bold text-destructive/70 uppercase">Absent</p>
                </div>
                <div className="bg-blue-500/10 rounded-2xl p-3 text-center border border-blue-500/20">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.deemed}</p>
                  <p className="text-[10px] font-bold text-blue-600/70 uppercase">Deemed</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Attendance Progress</span>
                  <span>{stats.pct}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner p-0.5">
                  <m.div 
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.pct}%` }}
                    transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium font-medium">
                  *Based on logged lectures only
                </p>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Instructor</p>
                    <p className="text-sm text-muted-foreground">{localSubject.source_course_id?.instructor_name || localSubject.instructor_name || "Not assigned"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Expected / Total Lectures</p>
                    <p className="text-sm text-muted-foreground">
                      {localSubject.source_course_id?.expected_total_lectures || localSubject.expected_total_lectures || 0} Expected / {stats.total} logged
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exams & Milestones Card */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-xl rounded-3xl overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CalIcon className="w-5 h-5 text-primary" /> Exams & Dates
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setIsAddExamModalOpen(true)} className="h-8 rounded-xl font-bold text-xs cursor-pointer">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {localExams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 font-medium">No exams scheduled yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {localExams.map(ex => (
                    <div key={ex.id as string} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm truncate">{String(ex.title).replace("[Exam] ", "")}</span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                          {ex.due_date ? format(new Date(ex.due_date as string), 'MMM do, yyyy') : 'No date'}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExam(ex.id as string)} className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5 rounded-3xl overflow-hidden p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" /> Calendar Legend
            </h3>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-green-600">
                <div className="w-4 h-4 rounded-md bg-green-500/20 border border-green-500/30" /> Present
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-destructive">
                <div className="w-4 h-4 rounded-md bg-destructive/20 border border-destructive/30" /> Absent
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600">
                <div className="w-4 h-4 rounded-md bg-blue-500/20 border border-blue-500/30" /> Deemed
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600">
                <div className="w-4 h-4 rounded-md bg-amber-500/20 border border-amber-500/30" /> Mixed Day
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Calendar */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-6 sm:p-8 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{format(currentDate, 'MMMM yyyy')}</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-bold tracking-widest uppercase">Attendance History</p>
              </div>
              <div className="flex gap-1 sm:gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-xl w-8 h-8 sm:w-10 sm:h-10">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-xl w-8 h-8 sm:w-10 sm:h-10">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-8 pt-4">
              {/* Desktop Calendar (7-Column Grid) */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-7 gap-6 mb-6">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/30">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-6">
                  {calendarDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const dayLogsForGrid = logs.filter(l => l.lecture_date === dateStr)
                    const isCurrentMonth = isSameMonth(day, monthStart)
                    const isTodayDate = isToday(day)
                    
                    let cellClasses = 'bg-muted/5 border-border/20 text-muted-foreground/50'
                    let textClasses = 'text-foreground'
                    let tagClasses = 'text-muted-foreground/50'
                    
                    if (dayLogsForGrid.length > 0) {
                      const statuses = Array.from(new Set(dayLogsForGrid.map(l => l.status)))
                      if (statuses.length > 1) {
                        cellClasses = 'bg-amber-500/10 border-amber-500/20'
                        textClasses = 'text-amber-600 dark:text-amber-400'
                        tagClasses = 'text-amber-600/70'
                      } else if (statuses[0] === 'present') {
                        cellClasses = 'bg-green-500/10 border-green-500/20'
                        textClasses = 'text-green-600 dark:text-green-400'
                        tagClasses = 'text-green-600/70'
                      } else if (statuses[0] === 'absent') {
                        cellClasses = 'bg-destructive/10 border-destructive/20'
                        textClasses = 'text-destructive'
                        tagClasses = 'text-destructive/70'
                      } else {
                        cellClasses = 'bg-blue-500/10 border-blue-500/20'
                        textClasses = 'text-blue-600 dark:text-blue-400'
                        tagClasses = 'text-blue-600/70'
                      }
                    }

                    return (
                      <m.button
                        key={dateStr}
                        onClick={() => { haptic(); setSelectedDay(day); }}
                        className={`
                          relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border
                          ${isCurrentMonth ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                          ${cellClasses}
                          ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-background z-20' : ''}
                        `}
                      >
                        <p className={`text-2xl font-bold ${textClasses}`}>
                          {format(day, 'd')}
                        </p>
                        {dayLogsForGrid.length > 0 && (
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${tagClasses}`}>
                            #L{dayLogsForGrid.length}
                          </p>
                        )}
                        {isTodayDate && (
                          <div className="absolute top-2 right-3 flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                            </span>
                            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-primary">TODAY</span>
                          </div>
                        )}
                      </m.button>
                    )
                  })}
                </div>
              </div>

              {/* Mobile Calendar (3-Column Vertical Grid) */}
              <div className="sm:hidden grid grid-cols-3 gap-4">
                {calendarDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayLogsForGrid = logs.filter(l => l.lecture_date === dateStr)
                  const isTodayDate = isToday(day)
                  const isCurrentMonth = isSameMonth(day, monthStart)
                  
                  if (!isCurrentMonth) return null;

                  let cellClasses = 'bg-muted/5 border-border/20 text-muted-foreground/50'
                  let textClasses = 'text-foreground'
                  let tagClasses = 'text-muted-foreground/50'
                  
                  if (dayLogsForGrid.length > 0) {
                    const statuses = Array.from(new Set(dayLogsForGrid.map(l => l.status)))
                    if (statuses.length > 1) {
                      cellClasses = 'bg-amber-500/10 border-amber-500/20'
                      textClasses = 'text-amber-600'
                      tagClasses = 'text-amber-600/70'
                    } else if (statuses[0] === 'present') {
                      cellClasses = 'bg-green-500/10 border-green-500/20'
                      textClasses = 'text-green-600'
                      tagClasses = 'text-green-600/70'
                    } else if (statuses[0] === 'absent') {
                      cellClasses = 'bg-destructive/10 border-destructive/20'
                      textClasses = 'text-destructive'
                      tagClasses = 'text-destructive/70'
                    } else {
                      cellClasses = 'bg-blue-500/10 border-blue-500/20'
                      textClasses = 'text-blue-600'
                      tagClasses = 'text-blue-600/70'
                    }
                  }

                  return (
                    <m.button
                      key={dateStr}
                      onClick={() => { haptic(); setSelectedDay(day); }}
                      className={`
                        relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border
                        ${cellClasses}
                        ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-background z-20' : ''}
                      `}
                    >
                      <div className="flex flex-col items-center">
                        <span className={`text-xl font-bold ${textClasses}`}>
                          {format(day, 'd')}
                        </span>
                        <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-widest -mt-1">
                          {format(day, 'EEE')}
                        </span>
                      </div>
                      
                      {dayLogsForGrid.length > 0 && (
                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${tagClasses}`}>
                          #L{dayLogsForGrid.length}
                        </p>
                      )}

                      {isTodayDate && (
                        <div className="absolute top-1.5 right-2 flex items-center gap-1">
                          <span className="relative flex h-1 w-1">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
                            <span className="relative inline-flex rounded-full h-1 w-1 bg-primary"></span>
                          </span>
                          <span className="text-[5px] font-bold uppercase tracking-[0.2em] text-primary">TODAY</span>
                        </div>
                      )}
                    </m.button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-3xl">
          <div className="bg-card p-6 pt-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">{selectedDay ? format(selectedDay, 'EEEE, MMM do') : ''}</DialogTitle>
                  <DialogDescription className="font-medium">Manage lectures for this day</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {dayLogs.length === 0 ? (
                  <div className="text-center py-8 bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl border-border/50">
                    <p className="text-sm font-bold text-muted-foreground">No lectures logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayLogs.map((log, index) => (
                      <div key={log.id} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50 shadow-sm group">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-muted-foreground w-4">#{index + 1}</span>
                          {(() => {
                            let badgeClass = 'bg-blue-500/10 text-blue-600'
                            if (log.status === 'present') badgeClass = 'bg-green-500/10 text-green-600'
                            else if (log.status === 'absent') badgeClass = 'bg-destructive/10 text-destructive'
                            return (
                              <Badge
                                variant="secondary"
                                className={`font-bold uppercase text-[10px] tracking-widest px-2.5 py-1 rounded-lg ${badgeClass}`}
                              >
                                {log.status}
                              </Badge>
                            )
                          })()}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteAttendanceLog(log.id)}
                          className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 text-center">Add New Lecture</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    onClick={() => { haptic(); addAttendanceLog('present'); }}
                    disabled={isUpdating}
                    className="flex flex-col gap-1 h-16 rounded-2xl bg-green-500 hover:bg-green-600"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase">Present</span>
                  </Button>
                  <Button 
                    onClick={() => { haptic(); addAttendanceLog('absent'); }}
                    disabled={isUpdating}
                    className="flex flex-col gap-1 h-16 rounded-2xl bg-destructive hover:bg-red-600 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase">Absent</span>
                  </Button>
                  <Button 
                    onClick={() => { haptic(); addAttendanceLog('deemed'); }}
                    disabled={isUpdating}
                    className="flex flex-col gap-1 h-16 rounded-2xl bg-blue-500 hover:bg-blue-600"
                  >
                    <Fingerprint className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase">Deemed</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl border-t border-border/50">
            <Button variant="ghost" onClick={() => { haptic(); setSelectedDay(null); }} className="w-full font-bold">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- EDIT SUBJECT DETAILS DIALOG --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden outline-none border-border/50">
          <DialogHeader className="pt-6 px-6 pb-2 border-b bg-muted/20">
            <DialogTitle>Edit Subject details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-4">
            <div className="space-y-1.5">
              <Label>Subject Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-card shadow-sm rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label>Instructor Name</Label>
              <Input 
                value={editInstructor} 
                onChange={e => setEditInstructor(e.target.value)} 
                placeholder="Instructor name" 
                className="bg-card shadow-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Expected Total Lectures</Label>
              <Input type="number" min="0" value={editExpectedLectures} onChange={e => setEditExpectedLectures(Number(e.target.value) || 0)} className="bg-card shadow-sm rounded-xl" />
            </div>
            
            <div className="space-y-1.5">
              <Label>Color Identity</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#a855f7'].map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setEditColorHex(hex)}
                    className={`w-8 h-8 rounded-full border-2 transition-all shrink-0 shadow-sm ${editColorHex === hex ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'border-transparent hover:scale-110'}`}
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={handleSaveSubject} className="flex-1 font-bold tracking-wider rounded-xl bg-primary text-primary-foreground hover:bg-primary/95">Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- ADD EXAM DATE DIALOG --- */}
      <Dialog open={isAddExamModalOpen} onOpenChange={setIsAddExamModalOpen}>
        <DialogContent className="sm:max-w-sm p-0 bg-background border-primary/20 overflow-hidden rounded-3xl">
          <div className="h-1 w-full bg-primary/50" />
          <div className="p-5 space-y-4">
            <DialogHeader className="flex flex-row justify-between items-center pb-3 border-b border-border/50">
              <DialogTitle className="font-bold text-lg flex items-center gap-2"><CalIcon className="w-5 h-5 text-primary"/> Add Date / Exam</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Label</Label>
                <Input value={examLabel} onChange={(e) => setExamLabel(e.target.value)} placeholder="e.g., Final Exam" className="bg-muted/30 border-border/50 h-11 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Date</Label>
                <DatePicker
                  date={examDate || undefined}
                  setDate={(d) => setExamDate(d as Date)}
                  className="w-full h-11 border-border/50 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleAddExam} disabled={!examLabel.trim() || !examDate} className="w-full font-bold h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Save Exam Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
