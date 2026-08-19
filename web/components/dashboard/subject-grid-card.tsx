"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar as CalIcon } from "lucide-react"
import { getSourceCourse } from "@/lib/source-course"

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

export function SubjectGridCard({
  subject,
  onEdit,
  onDelete,
  onAddExamDate,
}: {
  subject: SubjectRecord
  onEdit?: () => void
  onDelete?: () => void
  onAddExamDate?: (label: string, date: Date) => void
}) {
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
    <div className="h-full">
      <Card
        onClick={handleCardClick}
        className="group hover:shadow-primary/10 border-border/40 hover:border-primary/30 from-card/80 to-card/30 relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl bg-gradient-to-b backdrop-blur-3xl transition-all duration-500 ease-out hover:shadow-2xl"
      >
        {/* Subtle premium inner glow on the top edge */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />

        <CardContent className="relative z-10 flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-start justify-between gap-4">
            <h3 className="truncate text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{subject.name}</h3>

            {/* Horizontal Options - Premium Glassy Buttons */}
            {(onEdit || onDelete || onAddExamDate) && (
              <div
                className="flex shrink-0 items-center gap-1.5 opacity-100 transition-all group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                {onAddExamDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExamModalOpen(true)
                    }}
                    className="bg-background/50 hover:bg-background/80 border-border/50 text-muted-foreground h-7 w-7 rounded-lg border shadow-sm backdrop-blur-md transition-all hover:text-green-500"
                    title="Add Custom Exam/Important Date"
                  >
                    <CalIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                    className="bg-background/50 hover:bg-background/80 border-border/50 text-muted-foreground hover:text-primary h-7 w-7 rounded-lg border shadow-sm backdrop-blur-md transition-all"
                    title="Edit Subject"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                    className="bg-background/50 hover:bg-background/80 border-border/50 text-muted-foreground hover:text-destructive h-7 w-7 rounded-lg border shadow-sm backdrop-blur-md transition-all"
                    title="Delete Subject"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span>
                  {subject.type === "academic"
                    ? sourceCourse?.instructor_name || subject.instructor_name || "No Instructor set"
                    : subject.instructor_name || "No Instructor set"}
                </span>
              </div>
            </div>
          </div>
          {subject.type === "academic" && sourceCourse?.exam_dates && (
            <div className="mb-4 space-y-1.5">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Upcoming Exams</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(sourceCourse.exam_dates).map(([label, date]) => (
                  <div
                    key={label}
                    className="bg-primary/5 border-primary/20 flex items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm"
                  >
                    <span className="text-primary text-[10px] font-bold">{label}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rich Bottom Button */}
          <Link
            href={`/dashboard/subjects/${subject.id}`}
            passHref
            className="mt-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="secondary"
              className="bg-primary/5 hover:bg-primary/10 border-primary/10 hover:border-primary/20 text-primary hover:text-primary group/btn flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold shadow-sm transition-all"
            >
              <CalIcon className="h-4 w-4 transition-transform group-hover/btn:scale-110" />
              Open Calendar
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* --- ADD EXAM DATE MODAL (Dialog) --- */}
      <Dialog open={isExamModalOpen} onOpenChange={setIsExamModalOpen}>
        <DialogContent
          className="bg-background/80 border-primary/20 overflow-hidden p-0 backdrop-blur-xl sm:max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-primary/50 h-1 w-full" />
          <div className="space-y-4 p-5">
            <DialogHeader className="border-border/50 flex flex-row items-center justify-between border-b pb-3">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <CalIcon className="text-primary h-5 w-5" /> Add Date
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Date Label</Label>
                <Input
                  value={examLabel}
                  onChange={(e) => setExamLabel(e.target.value)}
                  placeholder="e.g., Final Exam"
                  className="bg-muted/30 border-border/50 h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Select Date</Label>
                <DatePicker
                  date={examDate || undefined}
                  setDate={(d) => setExamDate(d as Date)}
                  className="border-border/50 h-11 w-full rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleAddExam}
                disabled={!examLabel.trim() || !examDate}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-xl font-bold transition-colors"
              >
                Save Mission
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
