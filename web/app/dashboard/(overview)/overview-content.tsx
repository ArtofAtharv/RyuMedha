"use client"

import { UserProfile, useProfile } from "@/components/dashboard/profile-context"
import { useGamification } from "@/components/dashboard/gamification-context"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Flame, BookOpen, FolderOpen } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { SegmentedControl } from "@/components/dashboard/segmented-control"
import { haptic } from "@/lib/haptic"
import { AnimatePresence, m, Variants } from "motion/react"
import { AcademicOverviewSection } from "@/components/dashboard/overview-academics"
import { PersonalOverviewSection } from "@/components/dashboard/overview-personal"
import type { AttendanceData, SubjectInfo } from "@/components/dashboard/interactive-attendance-grid"

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
}

export interface CategoryInfo {
  id: string
  name: string
  color_hex?: string
}

export interface TimerEntry {
  started_at: string
  ended_at: string
  total_pause_seconds?: number
  timer_type?: string
  subject_id?: string
}

export interface AcademicOverviewData {
  overallAttendancePct: number | null
  totalPresent: number
  totalAbsent: number
  totalDeemed?: number
  academicGradePct: number | null
  academicPendingTasks: number
  academicStudyTimeFormatted: string | null
  attendanceData: AttendanceData[]
  academicSubjects: SubjectInfo[]
  unmarkedAcademicSubjects: SubjectInfo[]
  unmarkedSubjectsToday: number
  pendingTasksToday: number
  timersSessionData: TimerEntry[]
  token: string
  profileId: string
  targetPct: number
}

export interface PersonalOverviewData {
  personalScorePct: number | null
  personalPendingTasks: number
  personalPendingTasksToday: number
  personalStudyTimeFormatted: string | null
  personalSubjects: SubjectInfo[]
  timersSessionData: TimerEntry[]
  categories: CategoryInfo[]
}

export function OverviewContent({
  profile,
  academicOverviewData,
  personalOverviewData,
}: Readonly<{
  profile: UserProfile
  academicOverviewData: AcademicOverviewData
  personalOverviewData: PersonalOverviewData
}>) {
  const { profile: contextProfile, activeTrack, setActiveTrack } = useProfile()
  const { xp, level, progress, combo } = useGamification()
  const activeProfile = contextProfile || profile

  const unmarkedWord = academicOverviewData?.unmarkedSubjectsToday === 1 ? "subject" : "subjects"
  const unmarkedSubjectsText =
    academicOverviewData?.unmarkedSubjectsToday === 0
      ? "All set! You've marked attendance for all subjects today. 🎉"
      : `You have ${academicOverviewData?.unmarkedSubjectsToday} ${unmarkedWord} yet to mark today.`

  const pendingWord = academicOverviewData?.pendingTasksToday === 1 ? "task" : "tasks"
  const pendingTasksText =
    academicOverviewData?.pendingTasksToday === 0
      ? "No tasks due today. Use this time to relax or get ahead! 🚀"
      : `You have ${academicOverviewData?.pendingTasksToday} ${pendingWord} due today.`

  return (
    <m.div className="space-y-8">
      {/* ─── GAMIFICATION HERO / PLAYER PROFILE ─── */}
      <m.section variants={item} className="hidden">
        <Card className="bg-card/60 group relative overflow-hidden border-none shadow-lg shadow-black/5 backdrop-blur-2xl dark:shadow-black/20">
          <CardContent className="relative z-10 p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row">
              {/* Avatar / Level Badge */}
              <div className="relative">
                <div className="bg-primary h-24 w-24 rounded-2xl p-1 duration-500">
                  <div className="bg-card relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
                    <Sparkles className="text-primary h-10 w-10" />
                  </div>
                </div>
                <div className="bg-background border-primary text-primary absolute -right-3 -bottom-3 flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold">
                  {level}
                </div>
              </div>

              {/* Player Stats */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight md:text-4xl">
                    {activeProfile?.display_name}
                  </h1>
                  {combo >= 3 && (
                    <span className="flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-500">
                      <Flame className="h-3 w-3" /> {combo}x Combo
                    </span>
                  )}
                </div>

                <div className="mx-auto max-w-md space-y-1 md:mx-0">
                  <div className="text-muted-foreground flex justify-between gap-2 text-xs font-bold tracking-wider uppercase">
                    <span>Novice Scholar</span>
                    <span>
                      {xp} XP / {level * 100} XP
                    </span>
                  </div>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full shadow-inner">
                    <m.div
                      className="bg-primary h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </m.section>
      {/* ─── HEADER ─── */}
      <PageHeader title="Overview" description="Your activity and progress across all tracks." />

      {/* Track Switcher */}
      {activeProfile?.academics_enabled && activeProfile?.personal_enabled && (
        <div className="mx-auto mb-8 flex max-w-md justify-center">
          <SegmentedControl
            fullWidth
            layoutIdPrefix="overview-mobile-track"
            activeSegment={activeTrack}
            onChange={(id) => {
              haptic()
              setActiveTrack(id as "academics" | "personal")
            }}
            segments={[
              { id: "academics", label: "Academics", icon: BookOpen },
              { id: "personal", label: "Personal", icon: FolderOpen },
            ]}
          />
        </div>
      )}

      {/* ─── OVERVIEW CONTENT ─── */}
      <AnimatePresence mode="wait">
        {activeProfile?.academics_enabled && activeTrack === "academics" && (
          <AcademicOverviewSection
            key="academic-overview"
            data={academicOverviewData}
            unmarkedSubjectsText={unmarkedSubjectsText}
            pendingTasksText={pendingTasksText}
          />
        )}
        {activeProfile?.personal_enabled && activeTrack === "personal" && (
          <PersonalOverviewSection key="personal-overview" data={personalOverviewData} />
        )}
      </AnimatePresence>
    </m.div>
  )
}
