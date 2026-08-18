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
  isToday,
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
  Plus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
  type?: string
  label?: string
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

export function SubjectDetailContent({
  subject,
  attendanceLogs,
  exams = [],
  profile,
  token,
}: Readonly<{
  subject: SubjectData
  attendanceLogs: AttendanceLog[]
  exams: Record<string, unknown>[]
  profile: ProfileData
  token: string
}>) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState(attendanceLogs)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localSubject, setLocalSubject] = useState(subject)
  const [localExams, setLocalExams] = useState(exams)

  // Edit Subject states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editName, setEditName] = useState(subject.name)
  const [editInstructor, setEditInstructor] = useState(
    subject.source_course_id?.instructor_name || subject.instructor_name || ""
  )
  const [editExpectedLectures, setEditExpectedLectures] = useState(
    subject.source_course_id?.expected_total_lectures || subject.expected_total_lectures || 0
  )
  const [editColorHex, setEditColorHex] = useState(subject.color_hex || "#8b5cf6")

  // Add Exam states
  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false)
  const [examLabel, setExamLabel] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)

  const supabase = useMemo(() => getAppClient({ global: { headers: { Authorization: `Bearer ${token}` } } }), [token])

  async function handleSaveSubject() {
    if (!editName.trim() || isUpdating) return
    setIsUpdating(true)
    try {
      const isAcademic = localSubject.type === "academic"

      if (isAcademic && localSubject.source_course_id) {
        const courseId = localSubject.source_course_id.id || (localSubject.source_course_id as unknown as string)
        await supabase
          .from("academic_courses")
          .update({
            instructor_name: editInstructor,
            expected_total_lectures: Number(editExpectedLectures),
          })
          .eq("id", courseId)
      }

      const updates: Record<string, unknown> = {
        name: editName.trim(),
        color_hex: editColorHex,
        expected_total_lectures: Number(editExpectedLectures),
        instructor_name: editInstructor,
      }

      const { data, error } = await supabase
        .from("subjects")
        .update(updates)
        .eq("id", localSubject.id)
        .select("*, source_course_id(*)")
        .single()

      if (error) throw error
      setLocalSubject(
        data || {
          ...localSubject,
          name: editName.trim(),
          color_hex: editColorHex,
          source_course_id: isAcademic
            ? {
                ...(localSubject as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.source_course_id,
                instructor_name: editInstructor,
                expected_total_lectures: Number(editExpectedLectures),
              }
            : undefined,
          instructor_name: editInstructor,
          expected_total_lectures: Number(editExpectedLectures),
        }
      )
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
      const dateStr = format(examDate, "yyyy-MM-dd")

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
            customPrior: false,
          },
        })
      } catch (googleError) {
        console.warn("Google Tasks sync failed, falling back to direct db insert:", googleError)
      }

      if (!createdTask) {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            profile_id: profile.id,
            subject_id: localSubject.id,
            title: `[Exam] ${examLabel.trim()}`,
            due_date: dateStr,
            priority: "high",
            is_completed: false,
            is_exam: true,
          })
          .select()
          .single()
        if (error) throw error
        createdTask = data
      } else {
        await supabase
          .from("tasks")
          .update({ is_exam: true })
          .eq("title", `[Exam] ${examLabel.trim()}`)
          .eq("profile_id", profile.id)
      }

      const isAcademic = localSubject.type === "academic"
      if (isAcademic && localSubject.source_course_id) {
        const courseId = localSubject.source_course_id.id || (localSubject.source_course_id as unknown as string)
        const existingDates = localSubject.source_course_id.exam_dates || {}
        const updatedDates = { ...existingDates, [examLabel.trim()]: dateStr }
        await supabase.from("academic_courses").update({ exam_dates: updatedDates }).eq("id", courseId)
      }

      setLocalExams((prev) => [...prev, createdTask])
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
      if (localExams.some((ex) => ex.id === taskId)) {
        await deleteReminder(taskId)
      }
      setLocalExams((prev) => prev.filter((ex) => ex.id !== taskId))
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
    const present = logs.filter((l) => l.status === "present").length
    const absent = logs.filter((l) => l.status === "absent").length
    const deemed = logs.filter((l) => l.status === "deemed").length
    const total = present + absent + deemed
    const pct = total > 0 ? Math.round(((present + deemed) / total) * 100) : 0
    return { present, absent, deemed, total, pct }
  }, [logs])

  const nextMonth = () => {
    haptic()
    setCurrentDate(addMonths(currentDate, 1))
  }
  const prevMonth = () => {
    haptic()
    setCurrentDate(subMonths(currentDate, 1))
  }

  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const dayLogs = useMemo(() => {
    if (!selectedDay) return []
    const dateStr = format(selectedDay, "yyyy-MM-dd")
    return logs
      .filter((l) => l.lecture_date === dateStr)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [selectedDay, logs])

  async function addAttendanceLog(status: "present" | "absent" | "deemed") {
    haptic()
    if (!selectedDay || isUpdating) return
    const dateStr = format(selectedDay, "yyyy-MM-dd")
    setIsUpdating(true)

    try {
      const { data: newLog, error } = await supabase
        .from("attendance_logs")
        .insert({
          profile_id: profile.id,
          subject_id: subject.id,
          lecture_date: dateStr,
          status,
        })
        .select()
        .single()

      if (error) throw error
      setLogs((prev) => [...prev, newLog])
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
      const { error } = await supabase.from("attendance_logs").delete().eq("id", id)

      if (error) throw error
      setLogs((prev) => prev.filter((l) => l.id !== id))
      toast.info("Lecture record removed")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? (e as Error).message : String(e))
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="animate-in fade-in space-y-8 duration-700">
      {/* Header & Goal Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/subjects"
            className="bg-muted/50 hover:bg-muted group rounded-2xl p-3 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ background: localSubject.color_hex }}
            >
              <CalIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{localSubject.name}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="hidden lg:block" />
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/40 flex items-center justify-between rounded-[2.5rem] px-8 py-5 backdrop-blur-xl">
              <div className="flex items-center gap-12">
                <div className="flex items-center gap-3">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Goal</p>
                  <p className="text-primary text-xl font-bold">{profile.target_attendance_pct}%</p>
                </div>

                <div className="bg-border/40 h-6 w-px" />

                <div className="flex items-center gap-3">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Current</p>
                  <p
                    className={`text-xl font-bold ${stats.pct >= profile.target_attendance_pct ? "text-green-500" : "text-destructive"}`}
                  >
                    {stats.pct}%
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={`rounded-full px-6 py-1.5 font-bold whitespace-nowrap shadow-sm ${stats.pct >= profile.target_attendance_pct ? "border-green-500/20 bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive border-destructive/20"}`}
              >
                {stats.pct >= profile.target_attendance_pct ? "SAFE" : "ACTION REQUIRED"}
              </Badge>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Stats & Meta */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Trophy className="text-primary h-5 w-5" /> Subject Mastery
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditModalOpen(true)}
                className="text-muted-foreground hover:text-foreground h-8 w-8 cursor-pointer rounded-lg"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.present}</p>
                  <p className="text-[10px] font-bold text-green-600/70 uppercase">Present</p>
                </div>
                <div className="bg-destructive/10 border-destructive/20 rounded-2xl border p-3 text-center">
                  <p className="text-destructive text-2xl font-bold">{stats.absent}</p>
                  <p className="text-destructive/70 text-[10px] font-bold uppercase">Absent</p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.deemed}</p>
                  <p className="text-[10px] font-bold text-blue-600/70 uppercase">Deemed</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground flex justify-between text-xs font-bold tracking-wider uppercase">
                  <span>Attendance Progress</span>
                  <span>{stats.pct}%</span>
                </div>
                <div className="bg-muted h-3 w-full overflow-hidden rounded-full p-0.5 shadow-inner">
                  <m.div
                    className="bg-primary h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.pct}%` }}
                    transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
                  />
                </div>
                <p className="text-muted-foreground text-[10px] font-medium">*Based on logged lectures only</p>
              </div>

              <div className="border-border/50 space-y-4 border-t pt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-muted rounded-xl p-2">
                    <Info className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Instructor</p>
                    <p className="text-muted-foreground text-sm">
                      {localSubject.source_course_id?.instructor_name || localSubject.instructor_name || "Not assigned"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-muted rounded-xl p-2">
                    <Clock className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Expected / Total Lectures</p>
                    <p className="text-muted-foreground text-sm">
                      {localSubject.source_course_id?.expected_total_lectures ||
                        localSubject.expected_total_lectures ||
                        0}{" "}
                      Expected / {stats.total} logged
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exams & Milestones Card */}
          <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <CalIcon className="text-primary h-5 w-5" /> Exams & Dates
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddExamModalOpen(true)}
                className="h-8 cursor-pointer rounded-xl text-xs font-bold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {localExams.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm font-medium">No exams scheduled yet.</p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {localExams.map((ex) => (
                    <div
                      key={ex.id as string}
                      className="border-border/50 bg-muted/20 flex items-center justify-between rounded-xl border p-3"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-bold">{String(ex.title).replace("[Exam] ", "")}</span>
                        <span className="text-muted-foreground text-[10px] font-bold">
                          {ex.due_date ? format(new Date(ex.due_date as string), "MMM do, yyyy") : "No date"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteExam(ex.id as string)}
                        className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0 cursor-pointer rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5 overflow-hidden rounded-3xl p-6">
            <h3 className="text-primary mb-2 flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
              <Target className="h-4 w-4" /> Calendar Legend
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-green-600">
                <div className="h-4 w-4 rounded-md border border-green-500/30 bg-green-500/20" /> Present
              </div>
              <div className="text-destructive flex items-center gap-2 text-[10px] font-bold">
                <div className="bg-destructive/20 border-destructive/30 h-4 w-4 rounded-md border" /> Absent
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600">
                <div className="h-4 w-4 rounded-md border border-blue-500/30 bg-blue-500/20" /> Deemed
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600">
                <div className="h-4 w-4 rounded-md border border-amber-500/30 bg-amber-500/20" /> Mixed Day
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Calendar */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/40 overflow-hidden rounded-[2.5rem] backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-4 sm:p-8">
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{format(currentDate, "MMMM yyyy")}</h2>
                <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase sm:text-xs">
                  Attendance History
                </p>
              </div>
              <div className="flex gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prevMonth}
                  className="h-8 w-8 rounded-xl sm:h-10 sm:w-10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextMonth}
                  className="h-8 w-8 rounded-xl sm:h-10 sm:w-10"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 sm:p-8">
              {/* Desktop Calendar (7-Column Grid) */}
              <div className="hidden sm:block">
                <div className="mb-6 grid grid-cols-7 gap-6">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="text-muted-foreground/30 text-center text-[10px] font-bold tracking-[0.3em] uppercase"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-6">
                  {calendarDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd")
                    const dayLogsForGrid = logs.filter((l) => l.lecture_date === dateStr)
                    const isCurrentMonth = isSameMonth(day, monthStart)
                    const isTodayDate = isToday(day)

                    let cellClasses = "bg-muted/5 border-border/20 text-muted-foreground/50"
                    let textClasses = "text-foreground"
                    let tagClasses = "text-muted-foreground/50"

                    if (dayLogsForGrid.length > 0) {
                      const statuses = Array.from(new Set(dayLogsForGrid.map((l) => l.status)))
                      if (statuses.length > 1) {
                        cellClasses = "bg-amber-500/10 border-amber-500/20"
                        textClasses = "text-amber-600 dark:text-amber-400"
                        tagClasses = "text-amber-600/70"
                      } else if (statuses[0] === "present") {
                        cellClasses = "bg-green-500/10 border-green-500/20"
                        textClasses = "text-green-600 dark:text-green-400"
                        tagClasses = "text-green-600/70"
                      } else if (statuses[0] === "absent") {
                        cellClasses = "bg-destructive/10 border-destructive/20"
                        textClasses = "text-destructive"
                        tagClasses = "text-destructive/70"
                      } else {
                        cellClasses = "bg-blue-500/10 border-blue-500/20"
                        textClasses = "text-blue-600 dark:text-blue-400"
                        tagClasses = "text-blue-600/70"
                      }
                    }

                    return (
                      <m.button
                        key={dateStr}
                        onClick={() => {
                          haptic()
                          setSelectedDay(day)
                        }}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all duration-300 ${isCurrentMonth ? "opacity-100" : "pointer-events-none opacity-0"} ${cellClasses} ${isTodayDate ? "ring-primary ring-offset-background z-20 ring-2 ring-offset-2" : ""} `}
                      >
                        <p className={`text-2xl font-bold ${textClasses}`}>{format(day, "d")}</p>
                        {dayLogsForGrid.length > 0 && (
                          <p className={`text-[10px] font-bold tracking-widest uppercase ${tagClasses}`}>
                            #L{dayLogsForGrid.length}
                          </p>
                        )}
                        {isTodayDate && (
                          <div className="absolute top-2 right-3 flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="bg-primary absolute inline-flex h-full w-full rounded-full opacity-20"></span>
                              <span className="bg-primary relative inline-flex h-1.5 w-1.5 rounded-full"></span>
                            </span>
                            <span className="text-primary text-[7px] font-bold tracking-[0.2em] uppercase">TODAY</span>
                          </div>
                        )}
                      </m.button>
                    )
                  })}
                </div>
              </div>

              {/* Mobile Calendar (3-Column Vertical Grid -> Now 1 Column) */}
              <div className="grid grid-cols-1 gap-4 sm:hidden">
                {calendarDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const dayLogsForGrid = logs.filter((l) => l.lecture_date === dateStr)
                  const isTodayDate = isToday(day)
                  const isCurrentMonth = isSameMonth(day, monthStart)

                  if (!isCurrentMonth) return null

                  let cellClasses = "bg-muted/5 border-border/20 text-muted-foreground/50"
                  let textClasses = "text-foreground"
                  let tagClasses = "text-muted-foreground/50"

                  if (dayLogsForGrid.length > 0) {
                    const statuses = Array.from(new Set(dayLogsForGrid.map((l) => l.status)))
                    if (statuses.length > 1) {
                      cellClasses = "bg-amber-500/10 border-amber-500/20"
                      textClasses = "text-amber-600"
                      tagClasses = "text-amber-600/70"
                    } else if (statuses[0] === "present") {
                      cellClasses = "bg-green-500/10 border-green-500/20"
                      textClasses = "text-green-600"
                      tagClasses = "text-green-600/70"
                    } else if (statuses[0] === "absent") {
                      cellClasses = "bg-destructive/10 border-destructive/20"
                      textClasses = "text-destructive"
                      tagClasses = "text-destructive/70"
                    } else {
                      cellClasses = "bg-blue-500/10 border-blue-500/20"
                      textClasses = "text-blue-600"
                      tagClasses = "text-blue-600/70"
                    }
                  }

                  return (
                    <m.button
                      key={dateStr}
                      onClick={() => {
                        haptic()
                        setSelectedDay(day)
                      }}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all duration-300 ${cellClasses} ${isTodayDate ? "ring-primary ring-offset-background z-20 ring-2 ring-offset-2" : ""} `}
                    >
                      <div className="flex flex-col items-center">
                        <span className={`text-xl font-bold ${textClasses}`}>{format(day, "d")}</span>
                        <span className="text-muted-foreground/50 -mt-1 text-[8px] font-bold tracking-widest uppercase">
                          {format(day, "EEE")}
                        </span>
                      </div>

                      {dayLogsForGrid.length > 0 && (
                        <p className={`mt-1 text-[9px] font-bold tracking-widest uppercase ${tagClasses}`}>
                          #L{dayLogsForGrid.length}
                        </p>
                      )}

                      {isTodayDate && (
                        <div className="absolute top-1.5 right-2 flex items-center gap-1">
                          <span className="relative flex h-1 w-1">
                            <span className="bg-primary absolute inline-flex h-full w-full rounded-full opacity-20"></span>
                            <span className="bg-primary relative inline-flex h-1 w-1 rounded-full"></span>
                          </span>
                          <span className="text-primary text-[5px] font-bold tracking-[0.2em] uppercase">TODAY</span>
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
        <DialogContent className="overflow-hidden rounded-3xl border-none p-0 sm:max-w-md">
          <div className="bg-card p-6 pt-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">
                    {selectedDay ? format(selectedDay, "EEEE, MMM do") : ""}
                  </DialogTitle>
                  <DialogDescription className="font-medium">Manage lectures for this day</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="custom-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {dayLogs.length === 0 ? (
                  <div className="bg-card/60 border-border/50 rounded-3xl py-8 text-center shadow-sm backdrop-blur-2xl">
                    <p className="text-muted-foreground text-sm font-bold">No lectures logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayLogs.map((log, index) => (
                      <div
                        key={log.id}
                        className="bg-background border-border/50 group flex items-center justify-between rounded-2xl border p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground w-4 text-[10px] font-bold">#{index + 1}</span>
                          {(() => {
                            let badgeClass = "bg-blue-500/10 text-blue-600"
                            if (log.status === "present") badgeClass = "bg-green-500/10 text-green-600"
                            else if (log.status === "absent") badgeClass = "bg-destructive/10 text-destructive"
                            return (
                              <Badge
                                variant="secondary"
                                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase ${badgeClass}`}
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
                          className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-border/50 border-t pt-4">
                <p className="text-muted-foreground mb-3 text-center text-[10px] font-bold tracking-widest uppercase">
                  Add New Lecture
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Button
                    onClick={() => {
                      haptic()
                      addAttendanceLog("present")
                    }}
                    disabled={isUpdating}
                    className="flex h-16 flex-col gap-1 rounded-2xl bg-green-500 hover:bg-green-600"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">Present</span>
                  </Button>
                  <Button
                    onClick={() => {
                      haptic()
                      addAttendanceLog("absent")
                    }}
                    disabled={isUpdating}
                    className="bg-destructive flex h-16 flex-col gap-1 rounded-2xl transition-colors hover:bg-red-600"
                  >
                    <XCircle className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">Absent</span>
                  </Button>
                  <Button
                    onClick={() => {
                      haptic()
                      addAttendanceLog("deemed")
                    }}
                    disabled={isUpdating}
                    className="flex h-16 flex-col gap-1 rounded-2xl bg-blue-500 hover:bg-blue-600"
                  >
                    <Fingerprint className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">Deemed</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-card/60 border-border/50 rounded-3xl border-t p-4 shadow-sm backdrop-blur-2xl">
            <Button
              variant="ghost"
              onClick={() => {
                haptic()
                setSelectedDay(null)
              }}
              className="w-full font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- EDIT SUBJECT DETAILS DIALOG --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="border-border/50 overflow-hidden p-0 outline-none sm:max-w-md">
          <DialogHeader className="bg-muted/20 border-b px-6 pt-6 pb-2">
            <DialogTitle>Edit Subject details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 pt-4 pb-6">
            <div className="space-y-1.5">
              <Label>Subject Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-card rounded-xl shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Instructor Name</Label>
              <Input
                value={editInstructor}
                onChange={(e) => setEditInstructor(e.target.value)}
                placeholder="Instructor name"
                className="bg-card rounded-xl shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-bold">Expected Total Lectures</Label>
              <Input
                type="number"
                min="0"
                value={editExpectedLectures}
                onChange={(e) => setEditExpectedLectures(Number(e.target.value) || 0)}
                className="bg-card rounded-xl shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color Identity</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "#3b82f6",
                  "#ef4444",
                  "#22c55e",
                  "#f59e0b",
                  "#8b5cf6",
                  "#ec4899",
                  "#06b6d4",
                  "#f97316",
                  "#14b8a6",
                  "#6366f1",
                  "#84cc16",
                  "#a855f7",
                ].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setEditColorHex(hex)}
                    className={`h-8 w-8 shrink-0 rounded-full border-2 shadow-sm transition-all ${editColorHex === hex ? "ring-primary scale-110 ring-2 ring-offset-2" : "border-transparent hover:scale-110"}`}
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            <div className="flex w-full gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSubject}
                className="bg-primary text-primary-foreground hover:bg-primary/95 flex-1 rounded-xl font-bold tracking-wider"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- ADD EXAM DATE DIALOG --- */}
      <Dialog open={isAddExamModalOpen} onOpenChange={setIsAddExamModalOpen}>
        <DialogContent className="bg-background border-primary/20 overflow-hidden rounded-3xl p-0 sm:max-w-sm">
          <div className="bg-primary/50 h-1 w-full" />
          <div className="space-y-4 p-5">
            <DialogHeader className="border-border/50 flex flex-row items-center justify-between border-b pb-3">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <CalIcon className="text-primary h-5 w-5" /> Add Date / Exam
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Date Label</Label>
                <Input
                  value={examLabel}
                  onChange={(e) => setExamLabel(e.target.value)}
                  placeholder="e.g., Final Exam"
                  className="bg-muted/30 border-border/50 h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Select Date</Label>
                <DatePicker
                  date={examDate || undefined}
                  setDate={(d) => setExamDate(d as Date)}
                  className="border-border/50 h-11 w-full rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleAddExam}
                disabled={!examLabel.trim() || !examDate}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-xl font-bold transition-colors"
              >
                Save Exam Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
