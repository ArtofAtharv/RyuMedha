"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { motion, AnimatePresence } from "motion/react"
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

export function GradeSubjectCard({ 
  subject, 
  existingGrades, 
  onSave,
  isPersonal = false,
  maxGpa = 10
}: { 
  subject: any; 
  existingGrades: any[]; 
  onSave: (subjectId: string, scoresToSave: GradeScores) => Promise<void>;
  isPersonal?: boolean;
  maxGpa?: number;
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [activeType, setActiveType] = useState('mid_sem')

  const labels = isPersonal ? PERSONAL_LABELS : ACADEMIC_LABELS

  // Initialize state with existing grades from the DB
  const [scores, setScores] = useState<GradeScores>(() => {
    const s = JSON.parse(JSON.stringify(DEFAULT_SCORES))
    existingGrades.forEach(g => {
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
    Object.keys(DEFAULT_SCORES).forEach(type => {
      const existing = existingGrades.find(g => g.grade_type === type)
      const currentMarks = scores[type].marks
      const currentMax = scores[type].max_marks
      
      if (existing) {
        if (currentMarks !== existing.marks.toString() || currentMax !== existing.max_marks.toString()) {
          changed = true
        }
      } else {
        if (currentMarks !== "" || currentMax !== "") {
          changed = true
        }
      }
    })
    return changed
  }, [scores, existingGrades])

  // Calculate live totals
  const { totalObtained, totalMax, percentage, gradeInfo } = useMemo(() => {
    let obtained = 0
    let max = 0
    
    Object.values(scores).forEach(s => {
      const m = parseFloat(s.marks)
      const mx = parseFloat(s.max_marks)
      if (!isNaN(m) && !isNaN(mx) && mx > 0) {
        obtained += m
        max += mx
      }
    })

    const pct = max > 0 ? (obtained / max) * 100 : 0
    return {
      totalObtained: obtained,
      totalMax: max,
      percentage: pct,
      gradeInfo: getGradeDetails(pct, maxGpa)
    }
  }, [scores, maxGpa])

  const handleScoreChange = (type: string, field: 'marks' | 'max_marks', value: string) => {
    setScores(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
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
    <Card className="overflow-hidden border-2 shadow-sm transition-all hover:shadow-md">
      {/* Corner accent — hex gradient or theme gradient */}
      {(() => { const g = getAccentGradient(subject.color_hex); return (
        <div
          className={`h-10 w-25 -mt-15 -rotate-45 -translate-x-1/2 translate-y-1/2 rounded-full ${g.className}`}
          style={g.style}
        />
      )})()}

      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-bold text-lg truncate pr-4">{subject.name}</h3>
        {/* Animated Save Button */}
        <AnimatePresence mode="popLayout">
          {hasChanges && !success && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleSaveClick}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Marks"}
            </motion.button>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-emerald-600 bg-emerald-100 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3 h-3" /> Saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CardContent className="p-0">
        {/* Live Summary Bar */}
        <div className={`flex items-center justify-between p-4 border-b ${totalMax > 0 ? gradeInfo.bg : 'bg-muted/30'}`}>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Total Score</p>
            <p className="font-mono font-bold text-lg">
              {totalObtained} <span className="text-muted-foreground text-sm">/ {totalMax || '-'}</span>
            </p>
          </div>
          {totalMax > 0 && (
            <div className="text-right">
              <p className={`text-xs uppercase tracking-wider font-bold mb-0.5 ${gradeInfo.color}`}>Grade</p>
              <div className="flex items-center gap-2 justify-end">
                <span className={`text-2xl font-black leading-none ${gradeInfo.color}`}>{gradeInfo.letter}</span>
                <span className="text-xs bg-background/50 backdrop-blur-sm px-1.5 py-0.5 rounded font-mono border">
                  {gradeInfo.points} pts
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dropdown & Input */}
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Assessment Type</Label>
            <Select value={activeType} onValueChange={setActiveType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(labels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-3">
            <div className="space-y-1.5 flex-[1]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Marks</Label>
              <Input 
                type="number" 
                placeholder="Score" 
                className="h-9 font-mono text-sm"
                value={scores[activeType].marks}
                onChange={(e) => handleScoreChange(activeType, 'marks', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex-[1]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Max Marks</Label>
              <Input 
                type="number" 
                placeholder="Max" 
                className="h-9 font-mono text-sm"
                value={scores[activeType].max_marks}
                onChange={(e) => handleScoreChange(activeType, 'max_marks', e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
