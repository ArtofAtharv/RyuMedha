"use client"

import { UserProfile, useProfile } from "@/components/dashboard/profile-context"
import { useGamification } from "@/components/dashboard/gamification-context"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, CircleCheck, ChartColumn, Clock, ListTodo, GraduationCap, FolderOpen, Target, Sparkles, Trophy, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { InteractiveAttendanceGrid } from '@/components/dashboard/interactive-attendance-grid'
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { useState, useEffect } from 'react'
import { motion, Variants } from "motion/react"

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

export function OverviewContent({
  profile,
  academicOverviewData,
  personalOverviewData
}: {
  profile: UserProfile,
  academicOverviewData: any,
  personalOverviewData: any
}) {
  const { profile: contextProfile } = useProfile()
  const { xp, level, progress, combo } = useGamification()
  const activeProfile = contextProfile || profile
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* ─── GAMIFICATION HERO / PLAYER PROFILE ─── */}
      <motion.section variants={item}>
        <Card className="overflow-hidden border-2 border-primary/20 bg-background/50 backdrop-blur-xl shadow-2xl relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50 z-0"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-6">
              
              {/* Avatar / Level Badge */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent p-1 shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow duration-500">
                  <div className="w-full h-full bg-card rounded-xl flex items-center justify-center relative overflow-hidden">
                    <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
                  </div>
                </div>
                <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-lg font-black text-primary">
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
                  <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Novice Scholar</span>
                    <span>{xp} XP / {level * 100} XP</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
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

      {/* ─── ACADEMIC OVERVIEW ─── */}
      {activeProfile?.academics_enabled && (
        <motion.section variants={item} className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/50 pb-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Academic Overview</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm hover:shadow-primary/10">
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
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm hover:shadow-primary/10">
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
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm hover:shadow-primary/10">
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
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors shadow-sm hover:shadow-primary/10">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                      <Clock className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Time</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{academicOverviewData.academicStudyHours}h</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">invested time</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={item} className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 p-4 rounded-2xl bg-gradient-to-r from-card/80 to-transparent border border-border/50 backdrop-blur-md">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]"/>
                  Today's Quest: Attendance
                </h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium">
                  Mark your presence for {mounted ? format(new Date(), "EEEE, MMMM do") : "..."}
                </p>
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

      {/* ─── PERSONAL OVERVIEW ─── */}
      {activeProfile?.personal_enabled && (
        <motion.section variants={item} className="space-y-6 pt-6">
          <div className="flex items-center gap-3 border-b border-border/50 pb-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold tracking-tight">Personal Overview</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-accent/50 transition-colors shadow-sm hover:shadow-accent/10">
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
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-accent/50 transition-colors shadow-sm hover:shadow-accent/10">
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
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-accent/50 transition-colors shadow-sm hover:shadow-accent/10">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <span className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                      <Clock className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Time</CardTitle>
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-3xl font-black mt-2">{personalOverviewData.personalStudyHours}h</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">invested time</p>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div variants={item} whileHover={{ scale: 1.02, y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 hover:border-accent/50 transition-colors shadow-sm hover:shadow-accent/10">
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

          <motion.div variants={item} className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personalOverviewData.personalSubjects.map((sub: any, i: number) => {
                const subCategory = personalOverviewData.categories.find((c: any) => c.id === sub.category_id)
                return (
                  <motion.div key={sub.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
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
    </motion.div>
  )
}
