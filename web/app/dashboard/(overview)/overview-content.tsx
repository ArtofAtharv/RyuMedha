"use client"

import { UserProfile, useProfile } from "@/components/dashboard/profile-context"
import { useGamification } from "@/components/dashboard/gamification-context"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, CircleCheck, ChartColumn, Clock, ListTodo, GraduationCap, FolderOpen, Target, Sparkles, Trophy, Flame } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InteractiveAttendanceGrid, type AttendanceData, type SubjectInfo } from '@/components/dashboard/interactive-attendance-grid'
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { StudyAnalyticsChart } from '@/components/dashboard/study-analytics-chart'
import { motion, Variants } from "motion/react"
import { useState, useEffect } from 'react'
import { AnimatePresence, motion, Variants } from "motion/react"

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 }
}

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

interface CategoryInfo {
  id: string
  name: string
  color_hex?: string
}

interface TimerEntry {
  started_at: string
  ended_at: string
  total_pause_seconds?: number
  timer_type?: string
  subject_id?: string
}

interface AcademicOverviewData {
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

interface PersonalOverviewData {
  personalScorePct: number | null
  personalPendingTasks: number
  personalStudyTimeFormatted: string | null
  personalSubjects: SubjectInfo[]
  timersSessionData: TimerEntry[]
  categories: CategoryInfo[]
}

export function OverviewContent({
  profile,
  academicOverviewData,
  personalOverviewData
}: {
  profile: UserProfile,
  academicOverviewData: AcademicOverviewData,
  personalOverviewData: PersonalOverviewData
}) {
  const { profile: contextProfile } = useProfile()
  const { xp, level, progress, combo } = useGamification()
  const activeProfile = contextProfile || profile

  const [tab, setTab] = useState<'academics' | 'personal'>('academics')

  useEffect(() => {
    if (!activeProfile) return
    if (activeProfile.academics_enabled && activeProfile.personal_enabled) return

    if (activeProfile.academics_enabled) {
      setTab('academics')
    } else if (activeProfile.personal_enabled) {
      setTab('personal')
    }
  }, [activeProfile?.academics_enabled, activeProfile?.personal_enabled])

  return (
    <motion.div className="space-y-8">
      {/* ─── GAMIFICATION HERO / PLAYER PROFILE ─── */}
      <motion.section variants={item} className="hidden">
        <Card className="overflow-hidden border-2 border-primary/20 bg-background/50 backdrop-blur-xl relative group">
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-6">
              
              {/* Avatar / Level Badge */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-primary p-1 duration-500">
                  <div className="w-full h-full bg-card rounded-xl flex items-center justify-center relative overflow-hidden">
                    <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center font-black text-primary">
                  {level}
                </div>
              </div>

              {/* Player Stats */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
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
                    <motion.div 
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, type: "spring" }}
                    />
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </motion.section>
      {/* ─── TABS ─── */}
        {activeProfile?.academics_enabled && activeProfile?.personal_enabled && (
          <div className="relative flex gap-2 bg-accent/50 rounded-full p-1 w-max mx-auto md:mx-0">
            <Button
              variant="ghost"
              onClick={() => setTab("academics")}
              className="relative gap-2 px-3 py-1 rounded-full"
            >
              {tab === "academics" && (
                <motion.span
                  layoutId="subjects-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-0 m-0.1 rounded-full bg-white dark:bg-black/50 z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <BookOpen className={`w-4 h-4 ${tab === "academics" ? 'text-foreground' : 'text-muted-foreground'}`} />
                <span className={`${tab === "academics" ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>Academics</span>
              </span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => setTab("personal")}
              className="relative gap-2 px-3 py-1 rounded-full"
            >
              {tab === "personal" && (
                <motion.span
                  layoutId="subjects-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-0 m-0.1 rounded-full bg-white dark:bg-black/50 z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <FolderOpen className={`w-4 h-4 ${tab === "personal" ? 'text-foreground' : 'text-muted-foreground'}`} />
                <span className={`${tab === "personal" ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>Personal</span>
              </span>
            </Button>
          </div>
        )}

      {/* ─── ACADEMIC OVERVIEW ─── */}
      <AnimatePresence initial={false} mode="sync">
        {activeProfile?.academics_enabled && tab === "academics" && (
          <motion.section
            key="academics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 border-b border-border/50 pb-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Academic Overview</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <ChartColumn className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">
                    {academicOverviewData.overallAttendancePct !== null ? <span className="text-primary">{academicOverviewData.overallAttendancePct}%</span> : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {academicOverviewData.totalPresent + (academicOverviewData.totalDeemed || 0)} / {academicOverviewData.totalPresent + academicOverviewData.totalAbsent + (academicOverviewData.totalDeemed || 0)} attended
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-accent/10 text-accent">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grades</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{academicOverviewData.academicGradePct !== null ? `${academicOverviewData.academicGradePct}%` : '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">cumulative average</p>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500">
                      <ListTodo className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{academicOverviewData.academicPendingTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">academic to-dos</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                      <Clock className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Time</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{academicOverviewData.academicStudyTimeFormatted ? academicOverviewData.academicStudyTimeFormatted : '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">invested time</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={item} className="col-span-2 md:col-span-4 h-87.5">
            {academicOverviewData.timersSessionData?.length > 0 ? (
              <StudyAnalyticsChart timersData={academicOverviewData.timersSessionData} />
            ) : (
              <Card className="h-full flex flex-col items-center justify-center p-6 text-center bg-card/60 backdrop-blur-md border border-border/50 border-dashed">
                <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-muted-foreground">No Focus Data Yet</h3>
                <p className="text-sm text-muted-foreground/80 mt-2 max-w-sm">Start a stopwatch or pomodoro session to see your focus analysis.</p>
              </Card>
            )}
          </motion.div>

          <motion.div variants={item} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md flex flex-col justify-between group hover:border-primary/40 transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${academicOverviewData.unmarkedSubjectsToday > 0 ? 'bg-primary animate-pulse' : 'bg-green-500'}`}/>
                      Attendance Quest
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                      {academicOverviewData.unmarkedSubjectsToday > 0 
                        ? `You have ${academicOverviewData.unmarkedSubjectsToday} subject${academicOverviewData.unmarkedSubjectsToday !== 1 ? 's' : ''} yet to mark today.` 
                        : "All set! You've marked attendance for all subjects today. 🎉"}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                {academicOverviewData.unmarkedSubjectsToday > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/20">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Pending Subjects</p>
                    <div className="flex flex-wrap gap-2">
                      {academicOverviewData.unmarkedAcademicSubjects.map((s) => (
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
                      <span className={`w-2.5 h-2.5 rounded-full ${academicOverviewData.pendingTasksToday > 0 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}/>
                      Task Quest
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                      {academicOverviewData.pendingTasksToday > 0 
                        ? `You have ${academicOverviewData.pendingTasksToday} task${academicOverviewData.pendingTasksToday !== 1 ? 's' : ''} due today.` 
                        : "No tasks due today. Use this time to relax or get ahead! 🚀"}
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
                initialData={academicOverviewData.attendanceData || []} 
                subjectsInfo={academicOverviewData.academicSubjects} 
                token={academicOverviewData.token}
                profileId={academicOverviewData.profileId}
                targetPct={academicOverviewData.targetPct}
              />
            </div>
          </motion.div>
        </motion.section>
      )}
      </AnimatePresence>

      {/* ─── PERSONAL OVERVIEW ─── */}
      <AnimatePresence initial={false} mode="sync">
        {activeProfile?.personal_enabled && tab === "personal" && (
          <motion.section
            key="personal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 pt-6"
          >
            <div className="flex items-center gap-3 border-b border-border/50 pb-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold tracking-tight">Personal Overview</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-accent/10 text-accent">
                      <Target className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{personalOverviewData.personalScorePct !== null ? `${personalOverviewData.personalScorePct}%` : '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">skill points</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500">
                      <ListTodo className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{personalOverviewData.personalPendingTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">personal to-dos</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                      <Clock className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Time</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{personalOverviewData.personalStudyTimeFormatted ? personalOverviewData.personalStudyTimeFormatted : '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">invested time</p>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-zinc-500/10 text-zinc-500">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Areas</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{personalOverviewData.personalSubjects.length}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">active tracks</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={item} className="col-span-2 md:col-span-4 h-87.5">
            {personalOverviewData.timersSessionData?.length > 0 ? (
              <StudyAnalyticsChart timersData={personalOverviewData.timersSessionData} />
            ) : (
              <Card className="h-full flex flex-col items-center justify-center p-6 text-center bg-card/60 backdrop-blur-md border border-border/50 border-dashed">
                <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-muted-foreground">No Focus Data Yet</h3>
                <p className="text-sm text-muted-foreground/80 mt-2 max-w-sm">Start a stopwatch or pomodoro session to see your focus analysis.</p>
              </Card>
            )}
          </motion.div>

          <motion.div variants={item} className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personalOverviewData.personalSubjects.map((sub, i) => {
                const subCategory = personalOverviewData.categories.find((c) => c.id === sub.category_id)
                return (
                  <motion.div key={sub.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                    <SubjectGridCard 
                      subject={{...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex}} 
                      category={subCategory}
                    />
                  </motion.div>
                )
              })}
            </div>
            {personalOverviewData.personalSubjects.length === 0 && (
              <div className="p-8 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/10 backdrop-blur-sm">
                <p className="text-muted-foreground text-sm font-medium">No personal learning tracks defined yet.</p>
              </div>
            )}
          </motion.div>
        </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
