"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { GradeSubjectCard } from "@/components/dashboard/grade-subject-card"
import { BookOpen, FolderOpen } from "lucide-react"


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

    // Subjects for dropdown & cards - Fetch BOTH types
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, name, color_hex, type, label')
      .eq('profile_id', pid)
      .eq('is_active', true)
      
    setSubjects(subs || [])
  }

  async function handleSaveGrades(subjectId: string, scores: ReturnType<typeof JSON.parse>) {
    if (!supabaseClient || !profileId) return
    setIsSyncing(true)

    // Prepare upserts for all grade types
    const upserts = Object.keys(scores).map(type => {
      const m = parseFloat(scores[type].marks)
      const mx = parseFloat(scores[type].max_marks)

      // Only upsert if valid numbers exist
      if (!isNaN(m) && !isNaN(mx)) {
        return {
          profile_id: profileId,
          subject_id: subjectId,
          grade_type: type,
          marks: m,
          max_marks: mx,
          assessed_date: new Date().toISOString().split('T')[0]
        }
      }
      return null
    }).filter(Boolean)

    if (upserts.length > 0) {
      // Delete existing grades for this subject then re-insert
      await supabaseClient.from('grades').delete().eq('subject_id', subjectId)
      
      // Insert one-by-one so a single invalid type doesn't wipe all grades
      for (const row of upserts) {
        const { error } = await supabaseClient.from('grades').insert([row])
        if (error) {
          console.error(`Failed to save grade type ${(row as any).grade_type}:`, error.message)
        }
      }
    }

    await fetchData(supabaseClient, profileId)
    setIsSyncing(false)
  }



  // Separate aggregate stats for academic vs personal
  const academicSubjectIds = new Set(subjects.filter(s => s.type === 'academic').map(s => s.id))
  const personalSubjectIds = new Set(subjects.filter(s => s.type === 'personal').map(s => s.id))

  let acadScore = 0, acadMax = 0, persScore = 0, persMax = 0

  grades.forEach(g => {
    const m = Number(g.marks) || 0
    const mx = Number(g.max_marks) || 0
    
    if (academicSubjectIds.has(g.subject_id)) {
      acadScore += m
      acadMax += mx
    } else if (personalSubjectIds.has(g.subject_id)) {
      persScore += m
      persMax += mx
    }
  })

  const acadPct = acadMax > 0 ? ((acadScore / acadMax) * 100).toFixed(1) : "—"
  const persPct = persMax > 0 ? ((persScore / persMax) * 100).toFixed(1) : "—"

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Grades & Scores</span></h1>
        <p className="text-muted-foreground mt-1">Track your scores and calculate overall percentages.</p>
      </div>

      {subjects.length === 0 ? (
        <div className="space-y-10 animate-in fade-in duration-500">
          <section className="space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
              <Card className="bg-primary/10 border-0 h-32 sm:col-span-2 lg:col-span-1 animate-pulse" />
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="h-48 border-2 border-dashed bg-muted/20 animate-pulse" />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
              <Card className="bg-primary/5 border-0 h-32 sm:col-span-2 lg:col-span-1 animate-pulse" />
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="h-48 border-2 border-dashed bg-muted/10 animate-pulse" />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Academic Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary"/> Academic Grades</h2>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
          {/* Academic Summary Card — first item in the grid */}
          <Card className="gradient-accent text-white border-0 shadow-lg sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary"/> Academic</CardTitle>
              <CardDescription className="text-white/80">Cumulative academic grade</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-black">{acadPct}%</p>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs font-bold opacity-90">Total Marks</p>
                <p className="font-mono text-base">{acadScore} <span className="opacity-70 text-sm">/ {acadMax}</span></p>
              </div>
            </CardContent>
          </Card>

          {subjects.filter(s => s.type === 'academic').map(sub => {
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
          
          {subjects.filter(s => s.type === 'academic').length === 0 && (
            <div className="col-span-1 sm:col-span-2 py-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
              No academic subjects found. Add one in the Subjects tab first.
            </div>
          )}
        </div>
      </section>

      {/* Personal Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><FolderOpen className="w-5 h-5 text-primary"/> Personal Track Scores</h2>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
          {/* Personal Summary Card — first item in the grid */}
          <Card className="gradient-accent text-white border-0 shadow-sm sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-primary"/> Personal</CardTitle>
              <CardDescription className="text-white/80">Cumulative personal score</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-black">{persPct}%</p>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs font-bold opacity-90">Total Marks</p>
                <p className="font-mono text-base">{persScore} <span className="opacity-70 text-sm">/ {persMax}</span></p>
              </div>
            </CardContent>
          </Card>

          {subjects.filter(s => s.type === 'personal').map(sub => {
            const subjectGrades = grades.filter(g => g.subject_id === sub.id)
            return (
              <GradeSubjectCard 
                key={sub.id}
                subject={{...sub, name: sub.label || sub.name}} 
                existingGrades={subjectGrades}
                onSave={handleSaveGrades}
                isPersonal
              />
            )
          })}
          
          {subjects.filter(s => s.type === 'personal').length === 0 && (
            <div className="col-span-1 sm:col-span-2 py-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
              No personal subjects found.
            </div>
          )}
        </div>
      </section>

      {isSyncing && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Syncing to database...
        </div>
      )}
      </>
      )}
    </div>
  )
}
