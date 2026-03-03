"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, FolderOpen, Pencil, Trash2, User, Target } from "lucide-react"
import Link from 'next/link'
import { useState } from 'react'
import { motion } from "motion/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar as CalIcon, X, Plus } from "lucide-react"
// Helper function locally re-implemented since we're pulling this out of the main page
function hexToGradient(hex: string) {
  if (!hex) return {}
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return {
    background: `linear-gradient(135deg, ${hex}, rgba(${r},${g},${b},0.6))`
  }
}

export function SubjectGridCard({ subject, category, onEdit, onDelete, onAddExamDate }: { subject: any, category?: any, onEdit?: () => void, onDelete?: () => void, onAddExamDate?: (label: string, date: Date) => void }) {
  const [isExamModalOpen, setIsExamModalOpen] = useState(false)
  const [examLabel, setExamLabel] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  const handleAddExam = () => {
    if (examLabel.trim() && examDate && onAddExamDate) {
      onAddExamDate(examLabel.trim(), examDate)
      setExamLabel("")
      setExamDate(null)
      setIsExamModalOpen(false)
    }
  }

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden group hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.12)] transition-all duration-500 border-border/50 bg-card/60 backdrop-blur-xl flex flex-col h-full rounded-2xl">
        {/* Top Subtle Gradient Bar */}
        <div className="h-2 w-full absolute top-0 left-0 transition-all duration-500 group-hover:opacity-100 opacity-80" style={hexToGradient(subject.color_hex || '#8b5cf6')} />

        <CardContent className="p-5 pt-8 flex flex-col flex-1 relative z-10 bg-background text-foreground">
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
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 -translate-y-1">
              {onAddExamDate && (
                <Button variant="ghost" size="icon" onClick={() => setIsExamModalOpen(true)} className="h-7 w-7 text-muted-foreground hover:text-green-500 rounded-md" title="Add Custom Exam/Important Date">
                  <CalIcon className="w-3.5 h-3.5"/>
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7 text-muted-foreground hover:text-primary rounded-md" title="Edit Subject">
                  <Pencil className="w-3.5 h-3.5"/>
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-md" title="Delete Subject">
                  <Trash2 className="w-3.5 h-3.5"/>
                </Button>
              )}
            </div>
          )}
        </div>

        <h3 className="text-xl font-black text-foreground mb-1 leading-tight tracking-tight">
          {subject.name}
        </h3>
        
        {/* Meta Row */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-5 flex-1">
          {subject.type === 'academic' ? (
            <>
              <User className="w-4 h-4 opacity-70 shrink-0" />
              <span className="truncate">
                {subject.source_course_id?.instructor_name || subject.instructor_name || "No Instructor set"}
              </span>
            </>
          ) : (
            <>
              <span className="truncate opacity-70">{subject.label || "Personal Track"}</span>
            </>
          )}
        </div>

        {/* Exam Dates Section */}
        {subject.type === 'academic' && subject.source_course_id?.exam_dates && (
          <div className="mb-4 space-y-1.5 ">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Upcoming Exams</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(subject.source_course_id.exam_dates).map(([label, date]: [string, any]) => (
                <div key={label} className="bg-primary/5 border border-primary/20 rounded-md px-2 py-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-primary">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Button */}
        <Link href={`/dashboard/grades?subject=${subject.id}`} passHref className="mt-auto">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-10 bg-muted/40 hover:bg-muted text-sm font-bold transition-all group/btn rounded-xl">
            <Target className="w-4 h-4 group-hover/btn:text-primary transition-colors" />
            View Performance
          </Button>
          </Link>
        </CardContent>

        {/* --- ADD EXAM DATE MODAL (Dialog) --- */}
        <Dialog open={isExamModalOpen} onOpenChange={setIsExamModalOpen}>
          <DialogContent className="sm:max-w-sm p-0 bg-background/80 backdrop-blur-xl border-primary/20 overflow-hidden">
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
                <Button onClick={handleAddExam} disabled={!examLabel.trim() || !examDate} className="w-full font-bold h-11 rounded-xl gradient-accent shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                  Save Mission
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </Card>
    </motion.div>
  )
}
