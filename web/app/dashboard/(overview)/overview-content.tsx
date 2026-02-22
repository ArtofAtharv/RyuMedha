"use client"

import { UserProfile, useProfile } from "@/components/dashboard/profile-context"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, CircleCheck, ChartColumn, Clock, ListTodo, GraduationCap, FolderOpen, Target } from 'lucide-react'
import { format } from 'date-fns'
import { InteractiveAttendanceGrid } from '@/components/dashboard/interactive-attendance-grid'
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'

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

  return (
    <>
      {/* ─── ACADEMIC OVERVIEW ─── */}
      {activeProfile?.academics_enabled && (
        <section className="space-y-6 pt-2">
          <div className="flex items-center gap-3 border-b pb-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Academic Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <ChartColumn className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">
                  {academicOverviewData.overallAttendancePct !== null ? <span className="gradient-accent-text">{academicOverviewData.overallAttendancePct}%</span> : '—'}
                </p>
                {academicOverviewData.overallAttendancePct !== null && (
                  <div className="w-full bg-muted h-1.5 rounded-full mt-2">
                    <div className="gradient-accent-bar h-1.5 rounded-full transition-all" style={{width: `${academicOverviewData.overallAttendancePct}%`}} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {academicOverviewData.totalPresent + (academicOverviewData.totalDeemed || 0)} out of {academicOverviewData.totalPresent + academicOverviewData.totalAbsent + (academicOverviewData.totalDeemed || 0)} attended
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Grades</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{academicOverviewData.academicGradePct !== null ? `${academicOverviewData.academicGradePct}%` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">cumulative average</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{academicOverviewData.academicPendingTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">academic to-dos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{academicOverviewData.academicStudyHours}h</p>
                <p className="text-xs text-muted-foreground mt-1">invested</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full gradient-accent animate-pulse"/>
                  Today's Attendance
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mark your presence for {format(new Date(), "EEEE, MMMM do")}
                </p>
              </div>
            </div>
            <InteractiveAttendanceGrid 
              initialData={academicOverviewData.attendanceData || []} 
              subjectsInfo={academicOverviewData.academicSubjects} 
              token={academicOverviewData.token}
              profileId={academicOverviewData.profileId}
            />
          </div>
        </section>
      )}

      {/* ─── PERSONAL OVERVIEW ─── */}
      {activeProfile?.personal_enabled && (
        <section className="space-y-6 pt-6">
          <div className="flex items-center gap-3 border-b pb-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Personal Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Score</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalOverviewData.personalScorePct !== null ? `${personalOverviewData.personalScorePct}%` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">skill points</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalOverviewData.personalPendingTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">personal to-dos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalOverviewData.personalStudyHours}h</p>
                <p className="text-xs text-muted-foreground mt-1">invested</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="flex items-center space-x-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">Focus Areas</CardTitle>
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black">{personalOverviewData.personalSubjects.length}</p>
                <p className="text-xs text-muted-foreground mt-1">active tracks</p>
              </CardContent>
            </Card>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personalOverviewData.personalSubjects.map((sub: any) => {
                const subCategory = personalOverviewData.categories.find((c: any) => c.id === sub.category_id)
                return (
                  <SubjectGridCard 
                    key={sub.id} 
                    subject={{...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex}} 
                    category={subCategory}
                  />
                )
              })}
            </div>
            {personalOverviewData.personalSubjects.length === 0 && (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/30">
                <p className="text-muted-foreground text-sm font-medium">No personal learning tracks defined yet.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
}
