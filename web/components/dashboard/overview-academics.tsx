"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, ChartColumn, Clock, ListTodo, GraduationCap } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { InteractiveAttendanceGrid } from "@/components/dashboard/interactive-attendance-grid"
import { StudyAnalyticsChart } from "@/components/dashboard/study-analytics-chart"
import { m, Variants } from "motion/react"
import type { AcademicOverviewData } from "@/app/dashboard/(overview)/overview-content"

const item: Variants = {
  hidden: { opacity: 0, y: 15, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}

export function AcademicOverviewSection({
  data,
  unmarkedSubjectsText,
  pendingTasksText,
}: {
  data: AcademicOverviewData
  unmarkedSubjectsText: string
  pendingTasksText: string
}) {
  return (
    <m.section
      key="academics"
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(4px)" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <m.div variants={item}>
          <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2">
              <span className="flex items-center space-x-2">
                <div className="bg-primary/10 text-primary rounded-xl p-2 transition-transform duration-500">
                  <ChartColumn className="h-4 w-4" />
                </div>
                <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Attendance
                </CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-4">
              <p className="mt-2 font-serif text-4xl font-bold">
                {data.overallAttendancePct === null ? (
                  <span className="text-primary">0%</span>
                ) : (
                  <span className="text-primary">{data.overallAttendancePct}%</span>
                )}
              </p>
              <p className="text-muted-foreground mt-1 text-xs font-medium">
                {data.totalPresent + (data.totalDeemed || 0)} /{" "}
                {data.totalPresent + data.totalAbsent + (data.totalDeemed || 0)} attended
              </p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2">
              <span className="flex items-center space-x-2">
                <div className="rounded-xl bg-purple-500/10 p-2 text-purple-500 transition-transform duration-500">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Grades
                </CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-4">
              <p className="mt-2 font-serif text-4xl font-bold">
                {data.academicGradePct === null ? "0%" : `${data.academicGradePct}%`}
              </p>
              <p className="text-muted-foreground mt-1 text-xs font-medium">cumulative average</p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2">
              <span className="flex items-center space-x-2">
                <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500 transition-transform duration-500">
                  <ListTodo className="h-4 w-4" />
                </div>
                <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Tasks
                </CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-4">
              <p className="mt-2 font-serif text-4xl font-bold">{data.academicPendingTasks}</p>
              <p className="text-muted-foreground mt-1 text-xs font-medium">academic to-dos</p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2">
              <span className="flex items-center space-x-2">
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500 transition-transform duration-500">
                  <Clock className="h-4 w-4" />
                </div>
                <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Study Time
                </CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-4">
              <p className="mt-2 font-serif text-4xl font-bold">
                {data.academicStudyTimeFormatted ? data.academicStudyTimeFormatted : "0m"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs font-medium">invested time</p>
            </CardContent>
          </Card>
        </m.div>
      </div>

      <m.div variants={item} className="col-span-2 h-87.5 md:col-span-4">
        {data.timersSessionData?.length > 0 ? (
          <StudyAnalyticsChart timersData={data.timersSessionData} />
        ) : (
          <Card className="bg-card/60 flex h-full flex-col items-center justify-center border-none p-6 text-center shadow-sm backdrop-blur-md">
            <Clock className="text-muted-foreground/30 mb-4 h-12 w-12" />
            <h3 className="text-muted-foreground text-lg font-bold">No Focus Data Yet</h3>
            <p className="text-muted-foreground/80 mt-2 max-w-sm text-sm">
              Start a stopwatch or pomodoro session to see your focus analysis.
            </p>
          </Card>
        )}
      </m.div>

      <div className="w-full">
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <m.div
            variants={item}
            className="from-card/80 to-card/40 border-border/40 hover:shadow-primary/5 group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-br p-6 shadow-sm backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl"
          >
            <div className="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${data.unmarkedSubjectsToday > 0 ? "bg-primary" : "bg-green-500"}`}
                  />{" "}
                  Attendance Quest
                </h3>
                <p className="text-muted-foreground mt-1 text-sm font-medium">{unmarkedSubjectsText}</p>
              </div>
              <div className="bg-primary/10 text-primary rounded-xl p-2 transition-transform group-hover:scale-110">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            {data.unmarkedSubjectsToday > 0 && (
              <div className="border-border/20 mt-4 border-t pt-4">
                <p className="text-muted-foreground mb-2 text-[10px] font-bold tracking-widest uppercase">
                  Pending Subjects
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.unmarkedAcademicSubjects.map((s: { id: string; name?: string }) => (
                    <span
                      key={s.id}
                      className="bg-muted text-muted-foreground border-border/50 rounded-md border px-2 py-1 text-[10px] font-bold"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </m.div>

          <div className="from-card/80 to-card/40 border-border/40 group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-br p-6 shadow-sm backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl hover:shadow-orange-500/5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${data.pendingTasksToday > 0 ? "bg-orange-500" : "bg-green-500"}`}
                  />{" "}
                  Task Quest
                </h3>
                <p className="text-muted-foreground mt-1 text-sm font-medium">{pendingTasksText}</p>
              </div>
              <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500 transition-transform duration-500">
                <ListTodo className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Link href="/dashboard/tasks">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] font-bold tracking-wider uppercase hover:bg-orange-500/10 hover:text-orange-500"
                >
                  View Tasks
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* The interactive component below should theoretically grant XP inside it when marked! we will mock that by context */}
        <div className="relative">
          <InteractiveAttendanceGrid
            initialData={data.attendanceData || []}
            subjectsInfo={data.academicSubjects}
            token={data.token}
            profileId={data.profileId}
            targetPct={data.targetPct}
          />
        </div>
      </div>
    </m.section>
  )
}
