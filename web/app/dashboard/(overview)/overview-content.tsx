"use client"

import { UserProfile, useProfile } from "@/components/dashboard/profile-context"
import { useGamification } from "@/components/dashboard/gamification-context"
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, FolderOpen, Sparkles, Flame } from 'lucide-react'
import { SegmentedControl } from '@/components/dashboard/segmented-control'
import { PageHeader } from '@/components/dashboard/page-header'
import { useState, useEffect } from 'react'
import { AnimatePresence, m, Variants } from "motion/react"
import { AcademicOverviewSection } from '@/components/dashboard/overview-academics'
import { PersonalOverviewSection } from '@/components/dashboard/overview-personal'
import type { AttendanceData, SubjectInfo } from '@/components/dashboard/interactive-attendance-grid'


const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 } }
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
  personalOverviewData
}: Readonly<{
  profile: UserProfile,
  academicOverviewData: AcademicOverviewData,
  personalOverviewData: PersonalOverviewData
}>) {
  const { profile: contextProfile, activeTrack } = useProfile()
  const { xp, level, progress, combo } = useGamification()
  const activeProfile = contextProfile || profile

  const unmarkedWord = academicOverviewData?.unmarkedSubjectsToday === 1 ? 'subject' : 'subjects'
  const unmarkedSubjectsText = academicOverviewData?.unmarkedSubjectsToday === 0
    ? "All set! You've marked attendance for all subjects today. 🎉"
    : `You have ${academicOverviewData?.unmarkedSubjectsToday} ${unmarkedWord} yet to mark today.`

  const pendingWord = academicOverviewData?.pendingTasksToday === 1 ? 'task' : 'tasks'
  const pendingTasksText = academicOverviewData?.pendingTasksToday === 0
    ? "No tasks due today. Use this time to relax or get ahead! 🚀"
    : `You have ${academicOverviewData?.pendingTasksToday} ${pendingWord} due today.`

  return (
    <m.div className="space-y-8">
      {/* ─── GAMIFICATION HERO / PLAYER PROFILE ─── */}
      <m.section variants={item} className="hidden">
        <Card className="overflow-hidden bg-card/60 backdrop-blur-2xl relative group border-none shadow-lg shadow-black/5 dark:shadow-black/20">
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-6">

              {/* Avatar / Level Badge */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-primary p-1 duration-500">
                  <div className="w-full h-full bg-card rounded-xl flex items-center justify-center relative overflow-hidden">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center font-bold text-primary">
                  {level}
                </div>
              </div>

              {/* Player Stats */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    {activeProfile?.display_name}
                  </h1>
                  {combo >= 3 && (
                    <span className="flex items-center gap-1 text-xs font-bold bg-orange-500/10 text-orange-500 px-2 py-1 rounded-full border border-orange-500/20">
                      <Flame className="w-3 h-3" /> {combo}x Combo
                    </span>
                  )}
                </div>

                <div className="space-y-1 max-w-md mx-auto md:mx-0">
                  <div className="flex gap-2 justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Novice Scholar</span>
                    <span>{xp} XP / {level * 100} XP</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                    <m.div
                      className="h-full bg-primary rounded-full"
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
      <PageHeader
        title="Overview"
        description="Your activity and progress across all tracks."
      />

      {/* ─── ACADEMIC OVERVIEW ─── */}
      <AnimatePresence initial={false} mode="sync">
        {activeProfile?.academics_enabled && activeTrack === "academics" && (
          <AcademicOverviewSection 
            data={academicOverviewData} 
            unmarkedSubjectsText={unmarkedSubjectsText} 
            pendingTasksText={pendingTasksText} 
          />
        )}
      </AnimatePresence>

      {/* ─── PERSONAL OVERVIEW ─── */}
      <AnimatePresence initial={false} mode="sync">
        {activeProfile?.personal_enabled && activeTrack === "personal" && (
          <PersonalOverviewSection data={personalOverviewData} />
        )}
      </AnimatePresence>
    </m.div>
  )
}
