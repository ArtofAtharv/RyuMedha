"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { m, AnimatePresence } from "motion/react"
import { Check, Loader2 } from "lucide-react"
import { getAccentGradient } from "@/lib/gradient"

// Define the shape of our input fields
type GradeScores = {
  [key: string]: { marks: string; max_marks: string }
}

// These MUST match the DB grade_type enum exactly:
// 'mid_sem' | 'end_sem' | 'viva' | 'project' | 'presentation' | 'assignment' | 'quiz'
const DEFAULT_SCORES: GradeScores = {
  mid_sem: { marks: "", max_marks: "" },
  end_sem: { marks: "", max_marks: "" },
  project: { marks: "", max_marks: "" },
  assignment: { marks: "", max_marks: "" },
  quiz: { marks: "", max_marks: "" },
  viva: { marks: "", max_marks: "" },
  presentation: { marks: "", max_marks: "" },
}

// Labels for personal subject cards — more generic wording
const PERSONAL_LABELS: Record<string, string> = {
  mid_sem: "Test 1",
  end_sem: "Test 2",
  project: "Project",
  assignment: "Assignment",
  quiz: "Quiz",
  viva: "Oral / Viva",
  presentation: "Presentation",
}

const ACADEMIC_LABELS: Record<string, string> = {
  mid_sem: "Mid Semester",
  end_sem: "End Semester",
  project: "Project",
  assignment: "Assignment",
  quiz: "Quiz / Unit Test",
  viva: "Viva",
  presentation: "Presentation",
}

// Logic derived from the sample project for Grade allocation
function getGradeDetails(percentage: number, maxGpa: number) {
  if (percentage >= 91) return { letter: "O", points: maxGpa, color: "text-green-500", bg: "bg-green-500/10" }
  if (percentage >= 80) return { letter: "A+", points: maxGpa - 1, color: "text-emerald-500", bg: "bg-emerald-500/10" }
  if (percentage >= 71) return { letter: "A", points: maxGpa - 2, color: "text-teal-500", bg: "bg-teal-500/10" }
  if (percentage >= 61) return { letter: "B+", points: maxGpa - 3, color: "text-blue-500", bg: "bg-blue-500/10" }
  if (percentage >= 51) return { letter: "B", points: maxGpa - 4, color: "text-indigo-500", bg: "bg-indigo-500/10" }
  if (percentage >= 45) return { letter: "C", points: maxGpa - 5, color: "text-orange-500", bg: "bg-orange-500/10" }
  return { letter: "F", points: 0, color: "text-red-500", bg: "bg-red-500/10" }
}

interface SubjectRecord {
  id: string
  name: string
  color_hex?: string
}

interface GradeRecord {
  grade_type: string
  marks: number
  max_marks: number
}

export function GradeSubjectCard({
  subject,
  existingGrades,
  onSave,
  isPersonal = false,
  maxGpa = 10,
}: {
  readonly subject: SubjectRecord
  readonly existingGrades: GradeRecord[]
  readonly onSave: (subjectId: string, scoresToSave: GradeScores) => Promise<void>
  readonly isPersonal?: boolean
  readonly maxGpa?: number
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [activeType, setActiveType] = useState("mid_sem")

  const labels = isPersonal ? PERSONAL_LABELS : ACADEMIC_LABELS

  // Initialize state with existing grades from the DB
  const [scores, setScores] = useState<GradeScores>(() => {
    const s = structuredClone(DEFAULT_SCORES)
    existingGrades.forEach((g) => {
      if (s[g.grade_type]) {
        s[g.grade_type].marks = g.marks.toString()
        s[g.grade_type].max_marks = g.max_marks.toString()
      }
    })
    return s
  })

  // Has anything changed from what's currently saved?
  const hasChanges = useMemo(() => {
    let changed = false
    Object.keys(DEFAULT_SCORES).forEach((type) => {
      const existing = existingGrades.find((g) => g.grade_type === type)
      const currentMarks = scores[type].marks
      const currentMax = scores[type].max_marks

      if (existing) {
        if (currentMarks !== existing.marks.toString() || currentMax !== existing.max_marks.toString()) {
          changed = true
        }
      } else if (currentMarks !== "" || currentMax !== "") {
        changed = true
      }
    })
    return changed
  }, [scores, existingGrades])

  // Calculate live totals
  const { totalObtained, totalMax, gradeInfo } = useMemo(() => {
    let obtained = 0
    let max = 0

    Object.values(scores).forEach((s) => {
      const m = Number.parseFloat(s.marks)
      const mx = Number.parseFloat(s.max_marks)
      if (!Number.isNaN(m) && !Number.isNaN(mx) && mx > 0) {
        obtained += m
        max += mx
      }
    })

    const pct = max > 0 ? (obtained / max) * 100 : 0
    return {
      totalObtained: obtained,
      totalMax: max,
      percentage: pct,
      gradeInfo: getGradeDetails(pct, maxGpa),
    }
  }, [scores, maxGpa])

  const handleScoreChange = (type: string, field: "marks" | "max_marks", value: string) => {
    setScores((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
    setSuccess(false)
  }

  const handleSaveClick = async () => {
    if (!hasChanges) return
    setIsSaving(true)
    await onSave(subject.id, scores)
    setIsSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <Card className="border-border/40 bg-card/40 hover:border-border/60 group relative flex h-full flex-col overflow-hidden shadow-sm backdrop-blur-3xl transition-all duration-500 hover:shadow-lg">
      {/* Premium Glow effect */}
      {(() => {
        const g = getAccentGradient(subject.color_hex)
        return (
          <>
            <div
              className={`pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full opacity-[0.08] blur-[60px] transition-opacity duration-500 group-hover:opacity-[0.12] dark:opacity-[0.05] ${g.className}`}
              style={g.style}
            />
            <div
              className={`pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full opacity-[0.15] blur-[40px] transition-opacity duration-500 group-hover:opacity-[0.25] dark:opacity-[0.1] ${g.className}`}
              style={g.style}
            />
            <div className={`absolute top-0 left-0 h-[1px] w-full opacity-30 ${g.className}`} style={g.style} />
          </>
        )
      })()}

      {/* Header */}
      <div className="border-border/30 relative z-10 flex items-center justify-between border-b p-5">
        <h3 className="truncate pr-4 text-lg font-bold">{subject.name}</h3>
        {/* Animated Save Button */}
        <AnimatePresence mode="popLayout">
          {hasChanges && !success && (
            <m.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleSaveClick}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Marks"}
            </m.button>
          )}
          {success && (
            <m.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-600 shadow-sm"
            >
              <Check className="h-3 w-3" /> Saved
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <CardContent className="p-0">
        {/* Live Summary Bar */}
        <div
          className={`flex items-center justify-between border-b p-4 ${totalMax > 0 ? gradeInfo.bg : "bg-muted/30"}`}
        >
          <div>
            <p className="text-muted-foreground mb-0.5 text-xs font-bold tracking-wider uppercase">Total Score</p>
            <p className="font-mono text-lg font-bold">
              {totalObtained} <span className="text-muted-foreground text-sm">/ {totalMax || 0}</span>
            </p>
          </div>
          {totalMax > 0 && (
            <div className="text-right">
              <p className={`mb-0.5 text-xs font-bold tracking-wider uppercase ${gradeInfo.color}`}>Grade</p>
              <div className="flex items-center justify-end gap-2">
                <span className={`text-2xl leading-none font-bold ${gradeInfo.color}`}>{gradeInfo.letter}</span>
                <span className="bg-background/50 rounded border px-1.5 py-0.5 font-mono text-xs backdrop-blur-sm">
                  {gradeInfo.points} pts
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dropdown & Input */}
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Assessment Type</Label>
            <Select value={activeType} onValueChange={setActiveType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(labels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="flex-[1] space-y-1.5">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Marks</Label>
              <Input
                type="number"
                placeholder="Score"
                className="h-9 font-mono text-sm"
                value={scores[activeType].marks}
                onChange={(e) => handleScoreChange(activeType, "marks", e.target.value)}
              />
            </div>
            <div className="flex-[1] space-y-1.5">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Max Marks</Label>
              <Input
                type="number"
                placeholder="Max"
                className="h-9 font-mono text-sm"
                value={scores[activeType].max_marks}
                onChange={(e) => handleScoreChange(activeType, "max_marks", e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
