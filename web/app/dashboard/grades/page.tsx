"use client"

import { useCallback, useEffect, useState } from "react"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { GradeSubjectCard } from "@/components/dashboard/grade-subject-card"
import { PageHeader } from "@/components/dashboard/page-header"
import { BookOpen, FolderOpen, Pencil, Check, Target } from "lucide-react"
import { useProfile } from "@/components/dashboard/profile-context"
import { m, Variants } from "motion/react"

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 15, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}

interface GradeRecord {
  id?: string
  subject_id: string
  grade_type: string
  marks: number
  max_marks: number
  assessed_date?: string
}

interface SubjectRecord {
  id: string
  name: string
  color_hex?: string
  type: string
  label?: string
  is_active?: boolean
  source_course_id?: { semester_id?: string; credits?: number } | Array<{ semester_id?: string; credits?: number }>
}

// Function to calculate Grade Point based on college system
function getGradePoint(marks: number, max: number, scale: number) {
  if (max === 0) return 0
  const pct = (marks / max) * 100

  if (pct >= 91) return scale
  if (pct >= 80) return scale - 1
  if (pct >= 71) return scale - 2
  if (pct >= 61) return scale - 3
  if (pct >= 51) return scale - 4
  if (pct >= 45) return scale - 5
  return 0
}

function getLetterGradeFromGPA(gpa: number, scale: number) {
  if (gpa >= scale) return "O"
  if (gpa >= scale - 1) return "A+"
  if (gpa >= scale - 2) return "A"
  if (gpa >= scale - 3) return "B+"
  if (gpa >= scale - 4) return "B"
  if (gpa >= scale - 5) return "C"
  return "F"
}

// Truncate to 2 decimal places instead of rounding up
const truncateDecimals = (num: number) => {
  return (Math.floor(num * 100) / 100).toFixed(2)
}

function getCredits(sub?: SubjectRecord): number {
  if (!sub?.source_course_id) return 1
  if (Array.isArray(sub.source_course_id)) {
    return sub.source_course_id[0]?.credits ? Number(sub.source_course_id[0].credits) : 1
  }
  return sub.source_course_id.credits ? Number(sub.source_course_id.credits) : 1
}

export default function GradesPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [grades, setGrades] = useState<GradeRecord[]>([])
  const [subjects, setSubjects] = useState<SubjectRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  const [allAcademicSubjects, setAllAcademicSubjects] = useState<SubjectRecord[]>([])
  const [maxGpa, setMaxGpa] = useState<number>(10)
  const [isEditingGpa, setIsEditingGpa] = useState(false)
  const [editGpaValue, setEditGpaValue] = useState("10")

  useEffect(() => {
    // Initial fetch from DB happens in init() now
  }, [])

  async function saveGpaScale() {
    const val = Number(editGpaValue)
    if (!Number.isNaN(val) && val > 0) {
      setMaxGpa(val)
      if (profileId && supabaseClient) {
        await supabaseClient.from("profiles").update({ max_gpa: val }).eq("id", profileId)
      }
    }
    setIsEditingGpa(false)
  }

  const fetchData = useCallback(
    async (supabase: AppSupabaseClient, pid: string | null) => {
      if (!pid) return

      const { data: g } = await supabase
        .from("grades")
        .select("*, subjects(name)")
        .eq("profile_id", pid)
        .order("assessed_date", { ascending: false })

      setGrades(g || [])

      const { data: rawSubs } = await supabase
        .from("subjects")
        .select("id, name, color_hex, type, label, is_active, source_course_id")
        .eq("profile_id", pid)

      const acadSubsAll = rawSubs?.filter((s: SubjectRecord) => s.type === "academic") || []
      setAllAcademicSubjects(acadSubsAll)

      const subs =
        rawSubs?.filter((s: SubjectRecord) => {
          if (s.type === "personal") return s.is_active
          const semId = Array.isArray(s.source_course_id)
            ? s.source_course_id[0]?.semester_id
            : (s.source_course_id as { semester_id?: string })?.semester_id
          return semId === profile?.current_semester_id
        }) || []
      setSubjects(subs)

      const validSubjectIds = new Set(rawSubs?.map((s: SubjectRecord) => s.id) || [])
      setGrades((g || []).filter((entry: GradeRecord) => validSubjectIds.has(entry.subject_id)))
    },
    [profile?.current_semester_id]
  )

  useEffect(() => {
    async function init() {
      const supabase = getAppClient()
      setSupabaseClient(supabase)

      const { data: profile } = await supabase.from("profiles").select("id, max_gpa").single()

      if (profile) {
        setProfileId(profile.id)
        if (profile.max_gpa) {
          setMaxGpa(profile.max_gpa)
          setEditGpaValue(profile.max_gpa.toString())
        }
      }

      await fetchData(supabase, profile?.id)
      setIsLoading(false)
    }
    init()
  }, [fetchData])

  async function handleSaveGrades(subjectId: string, scores: ReturnType<typeof JSON.parse>) {
    if (!supabaseClient || !profileId) return
    setIsSyncing(true)

    // Prepare upserts for all grade types
    const upserts = Object.keys(scores)
      .map((type) => {
        const m = Number.parseFloat(scores[type].marks)
        const mx = Number.parseFloat(scores[type].max_marks)

        // Only upsert if valid numbers exist
        if (!Number.isNaN(m) && !Number.isNaN(mx)) {
          return {
            profile_id: profileId,
            subject_id: subjectId,
            grade_type: type,
            marks: m,
            max_marks: mx,
            assessed_date: new Date().toISOString().split("T")[0],
          }
        }
        return null
      })
      .filter(
        (
          row
        ): row is {
          profile_id: string
          subject_id: string
          grade_type: string
          marks: number
          max_marks: number
          assessed_date: string
        } => row !== null
      )

    if (upserts.length > 0) {
      // Delete existing grades for this subject then re-insert
      await supabaseClient.from("grades").delete().eq("subject_id", subjectId)

      // Insert one-by-one so a single invalid type doesn't wipe all grades
      for (const row of upserts) {
        const { error } = await supabaseClient.from("grades").insert([row])
        if (error) {
          console.error(`Failed to save grade type ${(row as GradeRecord).grade_type}:`, error.message)
        }
      }
    }

    await fetchData(supabaseClient, profileId)
    setIsSyncing(false)
  }

  // Separate aggregate stats for academic vs personal
  const currentAcademicSubjectIds = new Set(subjects.filter((s) => s.type === "academic").map((s) => s.id))
  const allAcademicSubjectIds = new Set(allAcademicSubjects.map((s) => s.id))
  const personalSubjectIds = new Set(subjects.filter((s) => s.type === "personal").map((s) => s.id))

  let acadScoreCurrent = 0,
    acadMaxCurrent = 0
  let acadScoreAll = 0,
    acadMaxAll = 0
  let persScore = 0,
    persMax = 0
  let sumCPCurrent = 0,
    sumCreditsCurrent = 0
  let sumCPAll = 0,
    sumCreditsAll = 0

  // Group grades by subject to compute GP per subject
  const subjectTotals: Record<string, { marks: number; max: number }> = {}
  grades.forEach((g) => {
    if (!subjectTotals[g.subject_id]) subjectTotals[g.subject_id] = { marks: 0, max: 0 }
    subjectTotals[g.subject_id].marks += Number(g.marks) || 0
    subjectTotals[g.subject_id].max += Number(g.max_marks) || 0
  })

  Object.entries(subjectTotals).forEach(([subjectId, totals]) => {
    if (totals.max > 0) {
      const subjectGP = getGradePoint(totals.marks, totals.max, maxGpa)

      if (allAcademicSubjectIds.has(subjectId)) {
        const sub = allAcademicSubjects.find((s) => s.id === subjectId)
        const creds = getCredits(sub)

        acadScoreAll += totals.marks
        acadMaxAll += totals.max
        sumCPAll += subjectGP * creds
        sumCreditsAll += creds

        if (currentAcademicSubjectIds.has(subjectId)) {
          acadScoreCurrent += totals.marks
          acadMaxCurrent += totals.max
          sumCPCurrent += subjectGP * creds
          sumCreditsCurrent += creds
        }
      } else if (personalSubjectIds.has(subjectId)) {
        persScore += totals.marks
        persMax += totals.max
      }
    }
  })

  const acadPct = acadMaxCurrent > 0 ? truncateDecimals((acadScoreCurrent / acadMaxCurrent) * 100) : "0"
  const sgpaValue = sumCreditsCurrent > 0 ? truncateDecimals(sumCPCurrent / sumCreditsCurrent) : "0"
  const cgpaValue = sumCreditsAll > 0 ? truncateDecimals(sumCPAll / sumCreditsAll) : "0"
  const persPct = persMax > 0 ? truncateDecimals((persScore / persMax) * 100) : "0"

  const hasNoTracks = !profile?.academics_enabled && !profile?.personal_enabled

  if (hasNoTracks) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 md:px-6 lg:px-8">
        <PageHeader title="Grades & Scores" description="Track your scores and calculate overall percentages." />
        <Card className="bg-card/60 rounded-3xl border-none shadow-lg backdrop-blur-2xl">
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-20 text-center">
            <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
              <FolderOpen className="text-muted-foreground/60 h-10 w-10" />
            </div>
            <div className="max-w-sm space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">Tracks Disabled</CardTitle>
              <CardDescription className="text-muted-foreground/80 text-base leading-relaxed font-medium">
                Both Academic and Personal tracking are currently disabled. Enable at least one track in Settings to
                start tracking grades.
              </CardDescription>
            </div>
            <Button
              onClick={() => router.push("/dashboard/profile")}
              className="h-12 cursor-pointer rounded-2xl px-8 text-base font-semibold"
            >
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 md:px-6 lg:px-8">
      <PageHeader title="Grades & Scores" description="Track your scores and calculate overall percentages." />

      {isLoading ? (
        <div className="animate-in fade-in space-y-10 duration-500">
          <section className="space-y-4">
            <div className="bg-muted h-6 w-48 animate-pulse rounded-md" />
            <div className="grid auto-rows-max gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
              <Card className="bg-primary/10 h-32 animate-pulse border-0 sm:col-span-2 lg:col-span-1" />
              {["acad-skel-1", "acad-skel-2"].map((key) => (
                <Card
                  key={key}
                  className="bg-card/60 h-48 animate-pulse rounded-3xl border-none shadow-sm backdrop-blur-2xl"
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="bg-muted h-6 w-48 animate-pulse rounded-md" />
            <div className="grid auto-rows-max gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
              <Card className="bg-primary/5 h-32 animate-pulse border-0 sm:col-span-2 lg:col-span-1" />
              {["pers-skel-1", "pers-skel-2"].map((key) => (
                <Card
                  key={key}
                  className="bg-card/60 h-48 animate-pulse rounded-3xl border-none shadow-sm backdrop-blur-2xl"
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <m.div variants={container} initial="hidden" animate="show" className="space-y-6">
          {/* Academic Section */}
          {profile?.academics_enabled && (
            <m.section variants={item} className="space-y-4">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <BookOpen className="text-primary h-5 w-5" /> Academic Grades
              </h2>

              <div className="grid auto-rows-max gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
                {/* SGPA Summary Card */}
                <m.div variants={item}>
                  <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
                    <CardHeader className="relative z-10 pb-2">
                      <CardTitle className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="text-primary h-5 w-5" /> SGPA
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingGpa(!isEditingGpa)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </CardTitle>
                      <CardDescription>Semester Grade Point Average</CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      {isEditingGpa ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            value={editGpaValue}
                            onChange={(e) => setEditGpaValue(e.target.value)}
                            className="bg-background border-border text-foreground focus:ring-primary h-8 w-16 rounded-md border px-2 text-center text-sm font-bold focus:ring-1 focus:outline-none"
                          />
                          <span className="text-sm font-medium">Max GPA</span>
                          <button
                            type="button"
                            onClick={saveGpaScale}
                            className="bg-primary/20 hover:bg-primary/30 text-primary flex h-8 w-8 items-center justify-center rounded-md"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-primary text-5xl font-bold">
                            {sgpaValue}{" "}
                            <span className="text-muted-foreground font-sans text-2xl font-bold">/ {maxGpa}</span>
                          </p>
                          {Number(sgpaValue) > 0 && (
                            <div className="flex flex-col items-end pr-2">
                              <span className="text-muted-foreground mb-1 text-xs font-bold tracking-wider uppercase">
                                Grade
                              </span>
                              <span className="text-primary text-4xl leading-none font-bold">
                                {getLetterGradeFromGPA(Number(sgpaValue), maxGpa)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="border-border/50 mt-3 border-t pt-3">
                        <p className="text-muted-foreground text-xs font-bold">Semester Marks</p>
                        <p className="font-mono text-base">
                          {Math.round(acadScoreCurrent * 100) / 100}{" "}
                          <span className="text-muted-foreground text-sm">/ {acadMaxCurrent}</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {/* CGPA Summary Card */}
                <m.div variants={item}>
                  <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
                    <CardHeader className="relative z-10 pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="text-primary h-5 w-5" /> CGPA
                      </CardTitle>
                      <CardDescription>Cumulative Grade Point Average</CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="flex items-center justify-between">
                        <p className="text-primary text-5xl font-bold">
                          {cgpaValue}{" "}
                          <span className="text-muted-foreground font-sans text-2xl font-bold">/ {maxGpa}</span>
                        </p>
                      </div>
                      <div className="border-border/50 mt-3 border-t pt-3">
                        <p className="text-muted-foreground text-xs font-bold">All Academic Marks</p>
                        <p className="font-mono text-base">
                          {Math.round(acadScoreAll * 100) / 100}{" "}
                          <span className="text-muted-foreground text-sm">/ {acadMaxAll}</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {/* Academic Percentage Card */}
                <m.div variants={item}>
                  <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
                    <CardHeader className="relative z-10 pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="text-primary h-5 w-5" /> Percentage
                      </CardTitle>
                      <CardDescription>Semester academic grade</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-primary text-5xl font-bold">
                        {acadPct}
                        <span className="text-muted-foreground font-sans text-2xl font-bold">%</span>
                      </p>
                      <div className="border-border/50 mt-3 border-t pt-3">
                        <p className="text-xs font-bold opacity-90">Total Marks</p>
                        <p className="text-muted-foreground font-mono text-base">
                          {Math.round(acadScoreCurrent * 100) / 100}{" "}
                          <span className="text-sm opacity-70">/ {acadMaxCurrent}</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {subjects
                  .filter((s) => s.type === "academic")
                  .map((sub) => {
                    const subjectGrades = grades.filter((g) => g.subject_id === sub.id)
                    return (
                      <m.div key={sub.id} variants={item}>
                        <GradeSubjectCard
                          subject={sub}
                          existingGrades={subjectGrades}
                          onSave={handleSaveGrades}
                          maxGpa={maxGpa}
                        />
                      </m.div>
                    )
                  })}

                {subjects.filter((s) => s.type === "academic").length === 0 && (
                  <div className="bg-card/40 border-border/40 hover:border-border/60 col-span-full flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border text-center backdrop-blur-3xl transition-colors">
                    <BookOpen className="text-muted-foreground/50 h-8 w-8" />
                    <p className="text-muted-foreground text-sm font-medium">
                      No academic subjects found. Add one in the Subjects tab first.
                    </p>
                  </div>
                )}
              </div>
            </m.section>
          )}

          {/* Personal Section */}
          {profile?.personal_enabled && (
            <m.section variants={item} className="space-y-4">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <FolderOpen className="text-primary h-5 w-5" /> Personal Track Scores
              </h2>

              <div className="grid auto-rows-max gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
                {/* Personal Summary Card — first item in the grid */}
                <m.div variants={item}>
                  <Card className="bg-card/60 border-border/40 hover:bg-card hover:border-primary/30 hover:shadow-primary/5 group relative h-full overflow-hidden backdrop-blur-2xl transition-all duration-500 ease-out hover:shadow-xl">
                    <CardHeader className="relative z-10 pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <FolderOpen className="text-primary h-5 w-5" /> Personal
                      </CardTitle>
                      <CardDescription>Cumulative personal score</CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <p className="text-primary text-5xl font-bold">
                        {persPct}
                        <span className="text-muted-foreground font-sans text-2xl font-bold">%</span>
                      </p>
                      <div className="border-border/50 mt-3 border-t pt-3">
                        <p className="text-muted-foreground text-xs font-bold">Total Marks</p>
                        <p className="font-mono text-base">
                          {Math.round(persScore * 100) / 100}{" "}
                          <span className="text-muted-foreground text-sm">/ {persMax}</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {subjects
                  .filter((s) => s.type === "personal")
                  .map((sub) => {
                    const subjectGrades = grades.filter((g) => g.subject_id === sub.id)
                    return (
                      <m.div key={sub.id} variants={item}>
                        <GradeSubjectCard
                          subject={{ ...sub, name: sub.label || sub.name }}
                          existingGrades={subjectGrades}
                          onSave={handleSaveGrades}
                          isPersonal
                          maxGpa={maxGpa}
                        />
                      </m.div>
                    )
                  })}

                {subjects.filter((s) => s.type === "personal").length === 0 && (
                  <div className="bg-card/40 border-border/40 hover:border-border/60 flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border text-center backdrop-blur-3xl transition-colors sm:col-span-1 lg:col-span-1 xl:col-span-2 2xl:col-span-2">
                    <FolderOpen className="text-muted-foreground/50 h-8 w-8" />
                    <p className="text-muted-foreground text-sm font-medium">No personal subjects found.</p>
                  </div>
                )}
              </div>
            </m.section>
          )}

          {isSyncing && (
            <div className="text-muted-foreground text-center text-sm font-medium">Syncing to database...</div>
          )}
        </m.div>
      )}
    </div>
  )
}
