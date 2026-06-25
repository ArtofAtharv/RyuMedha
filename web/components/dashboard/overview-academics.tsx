"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, ChartColumn, Clock, ListTodo, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InteractiveAttendanceGrid } from '@/components/dashboard/interactive-attendance-grid'
import { StudyAnalyticsChart } from '@/components/dashboard/study-analytics-chart'
import { m, Variants } from "motion/react"
import type { AcademicOverviewData } from '@/app/dashboard/(overview)/overview-content'

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 } }
}

export function AcademicOverviewSection({
  data,
  unmarkedSubjectsText,
  pendingTasksText
}: {
  data: AcademicOverviewData,
  unmarkedSubjectsText: string,
  pendingTasksText: string
}) {
  return (
    <m.section
      key="academics"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <m.div variants={item}>
          <Card className="h-full bg-card/80 backdrop-blur-2xl hover:border-primary/50 transition-colors">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <span className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <ChartColumn className="h-4 w-4" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-3xl font-bold mt-2">
                {data.overallAttendancePct === null ? '—' : <span className="text-primary">{data.overallAttendancePct}%</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {data.totalPresent + (data.totalDeemed || 0)} / {data.totalPresent + data.totalAbsent + (data.totalDeemed || 0)} attended
              </p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="h-full bg-card/80 backdrop-blur-2xl hover:border-primary/50 transition-colors">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <span className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-accent/10 text-accent">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grades</CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-3xl font-bold mt-2">{data.academicGradePct === null ? '—' : `${data.academicGradePct}%`}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">cumulative average</p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="h-full bg-card/80 backdrop-blur-2xl hover:border-primary/50 transition-colors">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <span className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500">
                  <ListTodo className="h-4 w-4" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks</CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-3xl font-bold mt-2">{data.academicPendingTasks}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">academic to-dos</p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="h-full bg-card/80 backdrop-blur-2xl hover:border-primary/50 transition-colors">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <span className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                  <Clock className="h-4 w-4" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Time</CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-3xl font-bold mt-2">{data.academicStudyTimeFormatted ? data.academicStudyTimeFormatted : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">invested time</p>
            </CardContent>
          </Card>
        </m.div>
      </div>

      <m.div variants={item} className="col-span-2 md:col-span-4 h-87.5">
        {data.timersSessionData?.length > 0 ? (
          <StudyAnalyticsChart timersData={data.timersSessionData} />
        ) : (
          <Card className="h-full flex flex-col items-center justify-center p-6 text-center bg-card/60 backdrop-blur-md border-none shadow-sm">
            <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground">No Focus Data Yet</h3>
            <p className="text-sm text-muted-foreground/80 mt-2 max-w-sm">Start a stopwatch or pomodoro session to see your focus analysis.</p>
          </Card>
        )}
      </m.div>

      <m.div variants={item} className="space-y-4 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div className="p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md flex flex-col justify-between group hover:border-primary/40 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${data.unmarkedSubjectsToday > 0 ? 'bg-primary' : 'bg-green-500'}`} />
                  {" "}Attendance Quest
                </h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium">
                  {unmarkedSubjectsText}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            {data.unmarkedSubjectsToday > 0 && (
              <div className="mt-4 pt-4 border-t border-border/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Pending Subjects</p>
                <div className="flex flex-wrap gap-2">
                  {data.unmarkedAcademicSubjects.map((s: { id: string; name?: string }) => (
                    <span key={s.id} className="text-[10px] font-bold px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border/50">
                      {s.name}
                    </span>
                  ))
                  }
                </div>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md flex flex-col justify-between group hover:border-orange-500/40 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${data.pendingTasksToday > 0 ? 'bg-orange-500' : 'bg-green-500'}`} />
                  {" "}Task Quest
                </h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium">
                  {pendingTasksText}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                <ListTodo className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Link href="/dashboard/tasks">
                <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-wider hover:bg-orange-500/10 hover:text-orange-500">
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
      </m.div>
    </m.section>
  )
}
