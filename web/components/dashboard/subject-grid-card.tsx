"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, FolderOpen, Pencil, Trash2, User, Target } from "lucide-react"
import Link from 'next/link'
import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
    <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-300 border-border/50 shadow-sm bg-card flex flex-col h-full">
      {/* Top Subtle Gradient Bar */}
      <div className="h-1.5 w-full absolute top-0 left-0" style={hexToGradient(subject.color_hex || '#8b5cf6')} />
      
      <CardContent className="p-5 pt-6 flex flex-col flex-1">
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
              <span className="truncate">{subject.instructor_name || "No Instructor set"}</span>
            </>
          ) : (
            <>
              <span className="truncate opacity-70">{subject.label || "Personal Track"}</span>
            </>
          )}
        </div>

        {/* Bottom Button */}
        <Link href={`/dashboard/grades?subject=${subject.id}`} passHref className="mt-auto">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-10 bg-muted/40 hover:bg-muted text-sm font-bold transition-all group/btn rounded-xl">
            <Target className="w-4 h-4 group-hover/btn:text-primary transition-colors" />
            View Performance
          </Button>
        </Link>
      </CardContent>

      {/* --- ADD EXAM DATE MODAL (Inline) --- */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm bg-background shadow-xl border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="font-bold text-lg">Add Important Date</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-muted-foreground hover:text-foreground" onClick={() => setIsExamModalOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Date Label</Label>
                  <Input value={examLabel} onChange={(e) => setExamLabel(e.target.value)} placeholder="e.g., Mid Sem 1" className="bg-muted/30 h-10" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Select Date</Label>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal ${!examDate && "text-muted-foreground"}`}>
                        <CalIcon className="mr-2 h-4 w-4" />
                        {examDate ? examDate.toLocaleDateString() : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[110]" align="start">
                      <DateRangePicker 
                        mode="single" 
                        onSelect={(date) => { 
                          setExamDate(date as Date)
                          setIsDatePickerOpen(false) 
                        }} 
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleAddExam} disabled={!examLabel.trim() || !examDate} className="w-full font-bold">
                  Save Date as Task
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </Card>
  )
}
