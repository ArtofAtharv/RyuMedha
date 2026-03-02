"use client"

import { UserProfile, useProfile } from "@/components/dashboard/profile-context"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, CircleCheck, ChartColumn, Clock, ListTodo, GraduationCap, FolderOpen, Target, Sparkles, Trophy, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { InteractiveAttendanceGrid } from '@/components/dashboard/interactive-attendance-grid'
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'

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
  const activeProfile = contextProfile || profile
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Gamification Logic
  const attendanceXP = (academicOverviewData.overallAttendancePct || 0) * 10;
  const gradesXP = (academicOverviewData.academicGradePct || 0) * 5;
  const studyXP = Math.floor(parseFloat(academicOverviewData.academicStudyHours || 0) * 50);
  const totalXP = attendanceXP + gradesXP + studyXP;
  const currentLevel = Math.floor(totalXP / 1000) + 1;
  const xpForNextLevel = currentLevel * 1000;
  const currentLevelXP = totalXP % 1000;
  const xpProgress = Math.min((currentLevelXP / 1000) * 100, 100);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  return (
    <div className="font-sans text-white">
      {/* Premium Gradient Background Layer for Dashboard */}
      <div className="fixed inset-0 bg-[#070714] -z-20" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay -z-10" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full" />
      </div>

      {/* ─── GAMIFIED HEADER PANEL ─── */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 relative rounded-3xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500 to-cyan-400 opacity-20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-yellow-400 border-[3px] border-[#070714] flex items-center justify-center text-xs font-black text-yellow-900 shadow-sm shadow-yellow-400/50">
                {currentLevel}
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Level {currentLevel} Scholar
              </h2>
              <p className="text-indigo-200/70 font-medium flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                {totalXP} Total XP Earned
              </p>
            </div>
          </div>

          <div className="w-full md:w-1/3 space-y-2">
            <div className="flex justify-between text-xs font-bold text-indigo-200">
              <span>{currentLevelXP} XP</span>
              <span>1000 XP to Lvl {currentLevel + 1}</span>
            </div>
            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ─── ACADEMIC OVERVIEW ─── */}
        {activeProfile?.academics_enabled && (
          <section className="space-y-6 pt-2">
            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold tracking-tight text-white">Academic Quests</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <motion.div variants={cardVariants} whileHover={{ y: -5, scale: 1.02 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 blur-2xl rounded-full group-hover:bg-yellow-500/20 transition-all" />
                <div className="flex items-center space-x-2 pb-2">
                  <ChartColumn className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Attendance</span>
                </div>
                <div>
                  <p className="text-4xl font-black text-white">
                    {academicOverviewData.overallAttendancePct !== null ? <span className="bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 to-orange-500">{academicOverviewData.overallAttendancePct}%</span> : '—'}
                  </p>
                  {academicOverviewData.overallAttendancePct !== null && (
                    <div className="w-full bg-black/30 h-1.5 rounded-full mt-3 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${academicOverviewData.overallAttendancePct}%` }} transition={{ duration: 1 }} className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1.5 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                    </div>
                  )}
                  <p className="text-xs text-indigo-200/60 mt-2 font-medium">
                    {academicOverviewData.totalPresent + (academicOverviewData.totalDeemed || 0)} / {academicOverviewData.totalPresent + academicOverviewData.totalAbsent + (academicOverviewData.totalDeemed || 0)} attended
                  </p>
                </div>
              </motion.div>

              <motion.div variants={cardVariants} whileHover={{ y: -5, scale: 1.02 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-2xl rounded-full group-hover:bg-cyan-500/20 transition-all" />
                <div className="flex items-center space-x-2 pb-2">
                  <GraduationCap className="h-5 w-5 text-cyan-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Grades</span>
                </div>
                <div>
                  <p className="text-4xl font-black text-white">{academicOverviewData.academicGradePct !== null ? `${academicOverviewData.academicGradePct}%` : '—'}</p>
                  <p className="text-xs text-indigo-200/60 mt-2 font-medium">cumulative average</p>
                </div>
              </motion.div>
              
              <motion.div variants={cardVariants} whileHover={{ y: -5, scale: 1.02 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 blur-2xl rounded-full group-hover:bg-rose-500/20 transition-all" />
                <div className="flex items-center space-x-2 pb-2">
                  <Flame className="h-5 w-5 text-rose-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Active Quests</span>
                </div>
                <div>
                  <p className="text-4xl font-black text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]">{academicOverviewData.academicPendingTasks}</p>
                  <p className="text-xs text-indigo-200/60 mt-2 font-medium">pending to-dos</p>
                </div>
              </motion.div>

              <motion.div variants={cardVariants} whileHover={{ y: -5, scale: 1.02 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full group-hover:bg-purple-500/20 transition-all" />
                <div className="flex items-center space-x-2 pb-2">
                  <Clock className="h-5 w-5 text-purple-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Study Time</span>
                </div>
                <div>
                  <p className="text-4xl font-black text-white">{academicOverviewData.academicStudyHours}<span className="text-2xl text-purple-300">h</span></p>
                  <p className="text-xs text-indigo-200/60 mt-2 font-medium">time invested</p>
                </div>
              </motion.div>
            </div>

            <motion.div variants={cardVariants} className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg backdrop-blur-md">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-3 text-white">
                    <span className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-pulse"/>
                    Daily Login Quest
                  </h3>
                  <p className="text-sm text-indigo-200/70 mt-1 font-medium">
                    Mark your presence for {mounted ? format(new Date(), "EEEE, MMMM do") : "..."}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20 p-4">
                <InteractiveAttendanceGrid 
                  initialData={academicOverviewData.attendanceData || []} 
                  subjectsInfo={academicOverviewData.academicSubjects} 
                  token={academicOverviewData.token}
                  profileId={academicOverviewData.profileId}
                  targetPct={academicOverviewData.targetPct}
                />
              </div>
            </motion.div>
          </section>
        )}

        {/* ─── PERSONAL OVERVIEW ─── */}
        {activeProfile?.personal_enabled && (
          <section className="space-y-6 pt-10">
            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-bold tracking-tight text-white">Skill Trees</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <motion.div variants={cardVariants} whileHover={{ y: -5 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
                <div className="flex items-center space-x-2 pb-2">
                  <Target className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Score</span>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{personalOverviewData.personalScorePct !== null ? `${personalOverviewData.personalScorePct}%` : '—'}</p>
                  <p className="text-xs text-indigo-200/60 mt-1">skill points</p>
                </div>
              </motion.div>

              <motion.div variants={cardVariants} whileHover={{ y: -5 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
                <div className="flex items-center space-x-2 pb-2">
                  <ListTodo className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Side Quests</span>
                </div>
                <div>
                  <p className="text-3xl font-black">{personalOverviewData.personalPendingTasks}</p>
                  <p className="text-xs text-indigo-200/60 mt-1">pending to-dos</p>
                </div>
              </motion.div>

              <motion.div variants={cardVariants} whileHover={{ y: -5 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
                <div className="flex items-center space-x-2 pb-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Training Time</span>
                </div>
                <div>
                  <p className="text-3xl font-black">{personalOverviewData.personalStudyHours}h</p>
                  <p className="text-xs text-indigo-200/60 mt-1">invested</p>
                </div>
              </motion.div>
              
              <motion.div variants={cardVariants} whileHover={{ y: -5 }} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
                <div className="flex items-center space-x-2 pb-2">
                  <FolderOpen className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider">Focus Areas</span>
                </div>
                <div>
                  <p className="text-3xl font-black">{personalOverviewData.personalSubjects.length}</p>
                  <p className="text-xs text-indigo-200/60 mt-1">active tracks</p>
                </div>
              </motion.div>
            </div>

            <motion.div variants={cardVariants} className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personalOverviewData.personalSubjects.map((sub: any) => {
                  const subCategory = personalOverviewData.categories.find((c: any) => c.id === sub.category_id)
                  return (
                    <div key={sub.id} className="rounded-2xl border border-white/10 overflow-hidden bg-white/5 hover:bg-white/10 transition-colors">
                      <SubjectGridCard 
                        subject={{...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex}} 
                        category={subCategory}
                      />
                    </div>
                  )
                })}
              </div>
              {personalOverviewData.personalSubjects.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5 backdrop-blur-md">
                  <p className="text-indigo-200/60 text-sm font-medium">No personal learning tracks defined yet. Start a new skill quest!</p>
                </div>
              )}
            </motion.div>
          </section>
        )}
      </motion.div>
    </div>
  )
}
