"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, FolderOpen, Pencil, Trash2, User, Target } from "lucide-react"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { m } from "motion/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar as CalIcon } from "lucide-react"
import { getSourceCourse } from "@/lib/source-course"
function hexToAccentStyle(hex: string) {
  if (!hex) return {}
  return {
    background: hex
  }
}

interface SubjectRecord {
  id: string
  name: string
  type: string
  color_hex?: string
  label?: string
  instructor_name?: string
  source_course_id?:
    | {
        instructor_name?: string
        exam_dates?: Record<string, string>
      }
    | Array<{
        instructor_name?: string
        exam_dates?: Record<string, string>
      }>
    | null
}

interface CategoryRecord {
  id: string
  name: string
}

export function SubjectGridCard({ subject, category, onEdit, onDelete, onAddExamDate }: { subject: SubjectRecord, category?: CategoryRecord, onEdit?: () => void, onDelete?: () => void, onAddExamDate?: (label: string, date: Date) => void }) {
  const [isExamModalOpen, setIsExamModalOpen] = useState(false)
  const [examLabel, setExamLabel] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)
  const router = useRouter()
  const sourceCourse = getSourceCourse(subject.source_course_id)

  const handleCardClick = () => {
    router.push(`/dashboard/subjects/${subject.id}`)
  }

  const handleAddExam = () => {
    if (examLabel.trim() && examDate && onAddExamDate) {
      onAddExamDate(examLabel.trim(), examDate)
      setExamLabel("")
      setExamDate(null)
      setIsExamModalOpen(false)
    }
  }

  return (
    <m.div 
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card 
        onClick={handleCardClick}
        className="relative overflow-hidden group transition-all duration-500 border-border/50 bg-card/60 backdrop-blur-xl flex flex-col h-full rounded-2xl cursor-pointer"
      >
        {/* Top accent bar */}
        <div className="h-2 w-full absolute top-0 left-0 transition-all duration-500 group-hover:opacity-100 opacity-80 bg-sidebar-primary" style={hexToAccentStyle(subject.color_hex || '#8b5cf6')} />

        <CardContent className="p-5 pt-8 flex flex-col flex-1 relative z-10">
        <div className="flex justify-between items-start mb-4">
          {/* Badge / Code */}
          <div>
            <div 
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-wider uppercase inline-flex items-center gap-1.5"
              style={{
                backgroundColor: `${subject.color_hex || '#8b5cf6'}1A`, 
                color: subject.color_hex || '#8b5cf6',
                border: `1px solid ${subject.color_hex || '#8b5cf6'}33`
              }}
            >
              {subject.type === 'academic' ? (
                <><BookOpen className="w-3 h-3" /> {(subject.source_course_id && 'Academic') || "Academic"}</>
              ) : (
                <>
                  <FolderOpen className="w-3 h-3" /> 
                  {category ? category.name : (subject.label || "Personal")}
                </>
              )}
            </div>
          </div>

          {/* Options */}
          {(onEdit || onDelete || onAddExamDate) && (
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 -translate-y-1" onClick={(e) => e.stopPropagation()}>
              {onAddExamDate && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExamModalOpen(true); }} className="h-7 w-7 text-muted-foreground hover:text-green-500 rounded-md" title="Add Custom Exam/Important Date">
                  <CalIcon className="w-3.5 h-3.5"/>
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 text-muted-foreground hover:text-primary rounded-md" title="Edit Subject">
                  <Pencil className="w-3.5 h-3.5"/>
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-md" title="Delete Subject">
                  <Trash2 className="w-3.5 h-3.5"/>
                </Button>
              )}
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold text-foreground mb-1 leading-tight tracking-tight">
          {subject.name}
        </h3>
        
        {/* Meta Row */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-5 flex-1">
          {subject.type === 'academic' ? (
            <>
              <User className="w-4 h-4 opacity-70 shrink-0" />
              <span className="truncate">
                {sourceCourse?.instructor_name || subject.instructor_name || "No Instructor set"}
              </span>
            </>
          ) : (
            <>
              <span className="truncate opacity-70">{subject.label || "Personal Track"}</span>
            </>
          )}
        </div>

        {/* Exam Dates Section */}
        {subject.type === 'academic' && sourceCourse?.exam_dates && (
          <div className="mb-4 space-y-1.5 ">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Upcoming Exams</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(sourceCourse.exam_dates).map(([label, date]) => (
                <div key={label} className="bg-primary/5 border border-primary/20 rounded-md px-2 py-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-primary">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Button */}
        <Link href={`/dashboard/subjects/${subject.id}`} passHref className="mt-auto" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-10 bg-muted/40 hover:bg-muted text-sm font-bold transition-all group/btn rounded-xl">
            <CalIcon className="w-4 h-4 group-hover/btn:text-primary transition-colors" />
            Open Calendar
          </Button>
        </Link>
        </CardContent>
      </Card>

      {/* --- ADD EXAM DATE MODAL (Dialog) --- */}
      <Dialog open={isExamModalOpen} onOpenChange={setIsExamModalOpen}>
        <DialogContent 
          className="sm:max-w-sm p-0 bg-background/80 backdrop-blur-xl border-primary/20 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1 w-full bg-primary/50" />
          <div className="p-5 space-y-4">
            <DialogHeader className="flex flex-row justify-between items-center pb-3 border-b border-border/50">
              <DialogTitle className="font-bold text-lg flex items-center gap-2"><CalIcon className="w-5 h-5 text-primary"/> Add Date</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Label</Label>
                <Input value={examLabel} onChange={(e) => setExamLabel(e.target.value)} placeholder="e.g., Final Exam" className="bg-muted/30 border-border/50 h-11 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Date</Label>
                <DatePicker
                  date={examDate || undefined}
                  setDate={(d) => setExamDate(d as Date)}
                  className="w-full h-11 border-border/50 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleAddExam} disabled={!examLabel.trim() || !examDate} className="w-full font-bold h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Save Mission
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </m.div>
  )
}
