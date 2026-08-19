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
  isSameDay,
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
  Clock,
  Trash2,
  CalendarDays,
  Pencil,
  Plus,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
      {/* Header Section */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard/subjects" className="bg-muted/50 hover:bg-muted group rounded-2xl p-3 transition-colors">
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{localSubject.name}</h1>
        </div>
      </div>

      {/* Goal Banner */}
      <Card className="border-border/50 from-card/60 to-muted/20 relative w-full overflow-hidden rounded-[2.5rem] bg-gradient-to-r p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Attendance Status</h2>
            <p className="text-muted-foreground text-sm font-medium">
              Keep your attendance above your target to stay safe.
            </p>
          </div>

          <div className="bg-background/50 border-border/50 flex w-full flex-wrap items-center justify-between gap-2 rounded-3xl border p-4 sm:w-auto sm:justify-start sm:gap-6 sm:px-6">
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Goal</span>
              <span className="text-primary text-xl font-bold">{profile.target_attendance_pct}%</span>
            </div>

            <div className="bg-border/50 h-8 w-px" />

            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Current</span>
              <span
                className={`text-xl font-bold ${stats.pct >= profile.target_attendance_pct ? "text-green-500 dark:text-green-400" : "text-destructive"}`}
              >
                {stats.pct}%
              </span>
            </div>

            <div className="bg-border/50 h-8 w-px" />

            <Badge
              variant="outline"
              className={`rounded-xl px-4 py-1.5 text-xs font-bold uppercase shadow-sm ${stats.pct >= profile.target_attendance_pct ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400" : "border-destructive/20 bg-destructive/10 text-destructive"}`}
            >
              {stats.pct >= profile.target_attendance_pct ? "Safe" : "Action Required"}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Stats & Meta */}
        <div className="space-y-6 lg:col-span-7">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Trophy className="text-primary h-5 w-5" />
                <h2 className="text-lg font-bold">Subject Mastery</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditModalOpen(true)}
                className="text-muted-foreground hover:text-foreground h-8 w-8 cursor-pointer rounded-lg"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl backdrop-blur-xl">
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-2 text-center sm:p-3">
                    <p className="text-xl font-bold text-green-600 sm:text-2xl dark:text-green-400">{stats.present}</p>
                    <p className="text-[8px] font-bold text-green-600/70 uppercase sm:text-[10px]">Present</p>
                  </div>
                  <div className="border-destructive/20 bg-destructive/10 rounded-2xl border p-2 text-center sm:p-3">
                    <p className="text-destructive text-xl font-bold sm:text-2xl">{stats.absent}</p>
                    <p className="text-destructive/70 text-[8px] font-bold uppercase sm:text-[10px]">Absent</p>
                  </div>
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2 text-center sm:p-3">
                    <p className="text-xl font-bold text-blue-600 sm:text-2xl dark:text-blue-400">{stats.deemed}</p>
                    <p className="text-[8px] font-bold text-blue-600/70 uppercase sm:text-[10px]">Deemed</p>
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
                        {localSubject.source_course_id?.instructor_name ||
                          localSubject.instructor_name ||
                          "Not assigned"}
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
          </div>

          {/* Exams & Milestones Card */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <CalIcon className="text-primary h-5 w-5" />
                <h2 className="text-lg font-bold">Exams & Dates</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddExamModalOpen(true)}
                className="h-8 cursor-pointer rounded-xl text-xs font-bold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl backdrop-blur-xl">
              <CardContent className="space-y-3 p-6">
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
          </div>
        </div>

        {/* Right Column: Calendar */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center gap-2 px-2">
            <CalendarDays className="text-primary h-5 w-5" />
            <h2 className="text-lg font-bold">Attendance History</h2>
          </div>
          <Card className="border-border/50 bg-card/40 w-full overflow-hidden rounded-[2rem] backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between p-5 pb-4 sm:p-6 sm:pb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={prevMonth}
                className="border-border/50 hover:bg-muted/20 h-8 w-8 rounded-full bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-base font-bold tracking-tight sm:text-lg">{format(currentDate, "MMMM yyyy")}</h3>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="border-border/50 hover:bg-muted/20 h-8 w-8 rounded-full bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
              {/* Calendar Grid */}
              <div className="block">
                <div className="mb-6 grid grid-cols-7 gap-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <div key={day} className="text-muted-foreground text-center text-[10px] font-medium sm:text-xs">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-x-1 gap-y-4">
                  {calendarDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd")
                    const dayLogsForGrid = logs.filter((l) => l.lecture_date === dateStr)
                    const isCurrentMonth = isSameMonth(day, monthStart)
                    const isTodayDate = isToday(day)

                    let cellClasses = "bg-transparent"
                    let textClasses = isCurrentMonth
                      ? "text-foreground font-bold"
                      : "text-muted-foreground/30 font-bold"

                    if (isTodayDate || (selectedDay && isSameDay(day, selectedDay))) {
                      cellClasses = "bg-muted/50"
                    }

                    if (dayLogsForGrid.length > 0 && isCurrentMonth) {
                      const statuses = Array.from(new Set(dayLogsForGrid.map((l) => l.status)))
                      if (statuses.length > 1) {
                        textClasses = "text-amber-500 font-bold"
                      } else if (statuses[0] === "present") {
                        textClasses = "text-green-500 font-bold"
                      } else if (statuses[0] === "absent") {
                        textClasses = "text-destructive font-bold"
                      } else {
                        textClasses = "text-blue-500 font-bold"
                      }
                    }

                    return (
                      <div key={dateStr} className="relative aspect-square w-full">
                        <m.button
                          onClick={() => {
                            haptic()
                            setSelectedDay(day)
                          }}
                          className={`hover:bg-muted/30 absolute inset-0 flex items-center justify-center rounded-2xl transition-all duration-300 sm:rounded-[1.25rem] ${cellClasses}`}
                        >
                          <span className={`text-sm leading-none sm:text-base ${textClasses}`}>{format(day, "d")}</span>
                        </m.button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="px-2 py-2 sm:px-4">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 sm:text-xs dark:text-green-400">
                <div className="h-3 w-3 rounded-full border border-green-500/30 bg-green-500/20" /> Present
              </div>
              <div className="text-destructive flex items-center gap-2 text-[10px] font-bold sm:text-xs">
                <div className="bg-destructive/20 border-destructive/30 h-3 w-3 rounded-full border" /> Absent
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 sm:text-xs dark:text-blue-400">
                <div className="h-3 w-3 rounded-full border border-blue-500/30 bg-blue-500/20" /> Deemed
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 sm:text-xs dark:text-amber-400">
                <div className="h-3 w-3 rounded-full border border-amber-500/30 bg-amber-500/20" /> Mixed Day
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent showCloseButton={false} className="overflow-hidden rounded-3xl border-none p-0 sm:max-w-md">
          <div className="bg-card p-6 pt-8">
            <DialogHeader className="mb-6 flex flex-col items-center text-center">
              <DialogTitle className="text-xl font-bold">
                {selectedDay ? format(selectedDay, "EEEE, MMM do") : ""}
              </DialogTitle>
              <DialogDescription className="font-medium">Manage lectures for this day</DialogDescription>
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
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => {
                      haptic()
                      addAttendanceLog("present")
                    }}
                    disabled={isUpdating}
                    className="flex h-16 flex-col gap-1 rounded-2xl bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
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
                    className="bg-destructive/10 text-destructive hover:bg-destructive/20 flex h-16 flex-col gap-1 rounded-2xl"
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
                    className="flex h-16 flex-col gap-1 rounded-2xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
                  >
                    <Fingerprint className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">Deemed</span>
                  </Button>
                </div>
              </div>

              <div className="border-border/50 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    haptic()
                    setSelectedDay(null)
                  }}
                  className="bg-muted/50 hover:bg-muted w-full font-bold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
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
