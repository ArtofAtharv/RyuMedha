"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, ListTodo, FolderOpen, Target } from 'lucide-react'
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { StudyAnalyticsChart } from '@/components/dashboard/study-analytics-chart'
import { m, Variants } from "motion/react"
import type { PersonalOverviewData } from '@/app/dashboard/(overview)/overview-content'
import type { SubjectInfo } from '@/components/dashboard/interactive-attendance-grid'

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 } }
}

export function PersonalOverviewSection({
  data
}: {
  data: PersonalOverviewData
}) {
  return (
    <m.section
      key="personal"
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
                <div className="p-1.5 rounded-md bg-accent/10 text-accent">
                  <Target className="h-4 w-4" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-3xl font-bold mt-2">{data.personalScorePct === null ? '—' : `${data.personalScorePct}%`}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">skill points</p>
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
              <p className="text-3xl font-bold mt-2">{data.personalPendingTasks}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">personal to-dos</p>
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
              <p className="text-3xl font-bold mt-2">{data.personalStudyTimeFormatted ? data.personalStudyTimeFormatted : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">invested time</p>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={item}>
          <Card className="h-full bg-card/80 backdrop-blur-2xl hover:border-primary/50 transition-colors">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <span className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-zinc-500/10 text-zinc-500">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Areas</CardTitle>
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-3xl font-bold mt-2">{data.personalSubjects.length}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">active tracks</p>
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

      <m.div variants={item} className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.personalSubjects.map((sub: SubjectInfo) => {
            const subCategory = data.categories.find((c: { id: string; color_hex?: string }) => c.id === sub.category_id)
            return (
              <m.div key={sub.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                <SubjectGridCard
                  subject={{ ...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex }}
                  category={subCategory}
                />
              </m.div>
            )
          })}
        </div>
        {data.personalSubjects.length === 0 && (
          <div className="p-8 text-center border-none bg-card/60 backdrop-blur-2xl shadow-sm border-border/50 rounded-2xl bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl backdrop-blur-sm">
            <p className="text-muted-foreground text-sm font-medium">No personal learning tracks defined yet.</p>
          </div>
        )}
      </m.div>
    </m.section>
  )
}
