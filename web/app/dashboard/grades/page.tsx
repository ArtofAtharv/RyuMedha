"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { GradeSubjectCard } from "@/components/dashboard/grade-subject-card"
import { motion } from "motion/react"

export default function GradesPage() {
  const [grades, setGrades] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)

  useEffect(() => {
    async function init() {
      const session = await getSession()
      if (!session) return
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
      )
      
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', session.user.phone)
        .single()
        
      if (profile) setProfileId(profile.id)

      await fetchData(supabase, profile?.id)
    }
    init()
  }, [])

  async function fetchData(supabase: any, pid: string | null) {
    if (!pid) return
    
    // Fetch grades with subject names
    const { data: g } = await supabase
      .from('grades')
      .select('*, subjects(name)')
      .eq('profile_id', pid)
      .order('assessed_date', { ascending: false })
      
    setGrades(g || [])

    // Subjects for dropdown (Only Academic usually handles grades)
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, name, color_hex, type')
      .eq('profile_id', pid)
      .eq('is_active', true)
      .eq('type', 'academic')
      
    setSubjects(subs || [])
  }

  async function handleSaveGrades(subjectId: string, scores: ReturnType<typeof JSON.parse>) {
    if (!supabaseClient || !profileId) return
    setIsSyncing(true)

    // Prepare upserts for all 5 grade types
    const upserts = Object.keys(scores).map(type => {
      const m = parseFloat(scores[type].marks)
      const mx = parseFloat(scores[type].max_marks)

      // Only upsert if valid numbers exist (or intentionally clear them if 0/NaN but we'll just skip empty strings)
      if (!isNaN(m) && !isNaN(mx)) {
        return {
          profile_id: profileId,
          subject_id: subjectId,
          grade_type: type,
          marks: m,
          max_marks: mx,
          assessed_date: new Date().toISOString()
        }
      }
      return null
    }).filter(Boolean)

    if (upserts.length > 0) {
      // Supabase lacks an easy "upsert by 3 compound keys" without a unique constraint,
      // so we delete existing grades for this subject and re-insert the valid ones.
      await supabaseClient.from('grades').delete().eq('subject_id', subjectId)
      await supabaseClient.from('grades').insert(upserts)
    }

    await fetchData(supabaseClient, profileId)
    setIsSyncing(false)
  }



  // Aggregate stats
  let totalScore = 0
  let totalMax = 0
  const subjectMap: any = {}

  grades.forEach(g => {
    const sName = g.subjects?.name || "Unknown"
    const m = Number(g.marks) || 0
    const mx = Number(g.max_marks) || 0
    
    totalScore += m
    totalMax += mx

    if (!subjectMap[sName]) subjectMap[sName] = { score: 0, max: 0 }
    subjectMap[sName].score += m
    subjectMap[sName].max += mx
  })

  const overallPct = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : "—"

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight">Academic Grades</h1>
        <p className="text-muted-foreground mt-1">Track your scores and calculate overall percentages.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Overall Summary Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-primary text-primary-foreground border-0 shadow-lg shadow-primary/20">
            <CardHeader className="pb-2">
              <CardTitle>Cumulative Grade</CardTitle>
              <CardDescription className="text-primary-foreground/80">Across all academic subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-6xl font-black">{overallPct}%</p>
              <div className="mt-4 pt-4 border-t border-primary-foreground/20">
                <p className="text-sm font-bold opacity-90">Total Marks Achieved</p>
                <p className="font-mono text-lg">{totalScore} <span className="opacity-70 text-sm">/ {totalMax}</span></p>
              </div>
            </CardContent>
          </Card>
          
          {isSyncing && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              Syncing to database...
            </div>
          )}
        </div>

        {/* Live Subject Cards Grid */}
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4 auto-rows-max">
          {subjects.map(sub => {
            const subjectGrades = grades.filter(g => g.subject_id === sub.id)
            return (
              <GradeSubjectCard 
                key={sub.id}
                subject={sub}
                existingGrades={subjectGrades}
                onSave={handleSaveGrades}
              />
            )
          })}
          
          {subjects.length === 0 && (
            <div className="col-span-1 sm:col-span-2 py-12 text-center text-muted-foreground border border-dashed rounded-xl">
              No academic subjects found. Add one in the Subjects tab first.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
