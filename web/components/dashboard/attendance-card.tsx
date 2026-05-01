"use client"
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, User, FolderOpen, BookOpen, Fingerprint } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from "motion/react"

interface AttendanceCardProps {
  subjectId?: string
  subjectName: string
  present: number
  absent: number
  deemed: number
  percentage: number
  accentColor?: string
  instructorName?: string
  label?: string
  bunksRemaining?: number
  maxAllowedSkips?: number
  currentSkips?: number
  neededToRecover?: number
  maxPossiblePct?: number
  isPossibleToRecover?: boolean
  remainingLectures?: number
  targetPct?: number
  onLog?: (subjectId: string, action: 'present'|'absent'|'deemed'|'undo_present'|'undo_absent'|'undo_deemed') => void
}

function hexToGradient(hex: string) {
  if (!hex) return {}
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return {
    background: `linear-gradient(135deg, ${hex}, rgba(${r},${g},${b},0.6))`
  }
}

export function AttendanceCard({
  subjectId,
  subjectName,
  present,
  absent,
  deemed,
  percentage,
  accentColor,
  instructorName,
  label,
  bunksRemaining,
  maxAllowedSkips,
  currentSkips,
  neededToRecover,
  maxPossiblePct,
  isPossibleToRecover,
  remainingLectures,
  targetPct = 75,
  onLog,
}: AttendanceCardProps) {
  const pct = Number(percentage ?? 0)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  useEffect(() => {
    setProgress(pct)
  }, [pct])

  const handleCardClick = () => {
    if (subjectId) {
      router.push(`/dashboard/subjects/${subjectId}`)
    }
  }

  const skipPct = maxAllowedSkips && maxAllowedSkips > 0 ? (currentSkips || 0) / maxAllowedSkips : 0;
  
  let healthClass = 'text-muted-foreground';
  if (present > 0 || absent > 0 || deemed > 0) {
    if (bunksRemaining !== undefined) {
      if (bunksRemaining <= 0) {
        healthClass = 'text-destructive';
      } else if (skipPct >= 0.6) {
        healthClass = 'text-amber-600 dark:text-amber-400';
      } else {
        healthClass = 'text-green-600 dark:text-green-400/90';
      }
    } else {
      // Fallback if bunk logic is unavailable
      if (pct < targetPct) {
        healthClass = 'text-destructive';
      } else if (pct < targetPct + 10) {
        healthClass = 'text-amber-600 dark:text-amber-400';
      } else {
        healthClass = 'text-green-600 dark:text-green-400/90';
      }
    }
  }

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card 
        onClick={handleCardClick}
        className="relative overflow-hidden group hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.12)] transition-all duration-500 border-border/50 bg-card/60 backdrop-blur-xl flex flex-col h-full rounded-2xl cursor-pointer"
      >
        {/* Top Subtle Gradient Bar */}
        <div className="h-2 w-full absolute top-0 left-0 transition-all duration-500 group-hover:opacity-100 opacity-80 bg-sidebar-primary" style={hexToGradient(accentColor || '#8b5cf6')} />

        <CardContent className="p-5 pt-8 flex flex-col flex-1 relative z-10">
        <div className="flex justify-between items-start mb-4">
          {/* Badge / Code */}
          <div>
            <div 
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-wider uppercase inline-flex items-center gap-1.5"
              style={{
                backgroundColor: `${accentColor || '#8b5cf6'}1A`, 
                color: accentColor || '#8b5cf6',
                border: `1px solid ${accentColor || '#8b5cf6'}33`
              }}
            >
              <BookOpen className="w-3 h-3" /> Academic
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2 w-full mb-1">
          <h3 className="text-xl font-black text-foreground leading-tight tracking-tight line-clamp-2">
            {subjectName}
          </h3>
          <span className={`text-2xl font-black shrink-0 ${healthClass}`}>
            {Math.round(pct)}%
          </span>
        </div>
        
        {/* Meta Row */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-4 flex-1">
          {instructorName ? (
            <>
              <User className="w-4 h-4 opacity-70 shrink-0" />
              <span className="truncate">{instructorName}</span>
            </>
          ) : (
             <span className="truncate opacity-70">No Instructor set</span>
          )}
        </div>

        {/* Attendance Stats bar */}
        <div className="space-y-3 mt-auto">
          <div className="flex justify-between text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1 text-green-600/80 dark:text-green-400/80">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {present} Pres
            </span>
            <span className="flex items-center gap-1 text-destructive/80">
              <XCircle className="h-3.5 w-3.5" />
              {absent} Abs
            </span>
            <span className="flex items-center gap-1 text-blue-600/80 dark:text-blue-400/80">
              <Fingerprint className="h-3.5 w-3.5" />
              {deemed} Deem
            </span>
          </div>

          <div className="h-2 w-full rounded-full overflow-hidden bg-muted shadow-inner">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: 0.2, type: "spring" }}
              style={hexToGradient(accentColor || '#8b5cf6')}
            />
          </div>

          {(present > 0 || absent > 0 || deemed > 0) && (bunksRemaining !== undefined || neededToRecover !== undefined) && (
            <div className="pt-1">
              {bunksRemaining !== undefined && bunksRemaining >= 0 ? (
                <>
                  {(() => {
                    const skipPct = maxAllowedSkips && maxAllowedSkips > 0 ? (currentSkips || 0) / maxAllowedSkips : 0;
                    if (bunksRemaining === 0) {
                      return (
                        <p className="text-[10px] font-bold text-destructive uppercase tracking-tighter bg-destructive/5 px-2 py-1 rounded-md inline-block border border-destructive/10">
                          🛑 High risk: Can't afford to skip any lectures. Attend daily to meet {targetPct}%
                        </p>
                      );
                    }
                    if (skipPct >= 0.6) {
                      return (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter bg-amber-500/10 px-2 py-1 rounded-md inline-block border border-amber-500/20">
                          ⚠️ Warning: Only {bunksRemaining} skips left to maintain {targetPct}%
                        </p>
                      );
                    }
                    return (
                      <p className="text-[10px] font-bold text-green-600 dark:text-green-400/90 uppercase tracking-tighter bg-green-500/5 px-2 py-1 rounded-md inline-block border border-green-500/10">
                        ✨ You can skip {bunksRemaining} lectures and still maintain {targetPct}%
                      </p>
                    );
                  })()}
                </>
              ) : (
                <>
                  {isPossibleToRecover ? (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-destructive uppercase tracking-tighter bg-destructive/5 px-2 py-1 rounded-md inline-block border border-destructive/10">
                        🚨 Attend {neededToRecover} lectures to meet {targetPct}%
                      </p>
                      <p className="text-[9px] text-muted-foreground font-medium pl-1 italic">
                        No skips allowed! Focus on showing up daily.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-destructive uppercase tracking-tighter bg-destructive/5 px-2 py-1 rounded-md inline-block border border-destructive/10">
                        ⚠️ Goal: Attending daily will make your attendance {Math.round(maxPossiblePct || 0)}%. Don't skip anymore!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {onLog && subjectId && (
            <div className="flex gap-1.5 pt-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-1 rounded-lg overflow-hidden border border-green-500/20">
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(subjectId, 'present'); }}
                  className="flex-1 py-2 sm:py-2.5 lg:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                  title="Mark Present"
                >
                  Present
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(subjectId, 'undo_present'); }}
                  className="px-2 sm:px-3 py-2 sm:py-2.5 lg:py-3 text-[10px] sm:text-xs font-bold bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 transition-colors border-l border-green-500/20"
                  title="Undo Present"
                >
                  -
                </button>
              </div>
              <div className="flex flex-1 rounded-lg overflow-hidden border border-red-500/20">
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(subjectId, 'absent'); }}
                  className="flex-1 py-2 sm:py-2.5 lg:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                  title="Mark Absent"
                >
                  Absent
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(subjectId, 'undo_absent'); }}
                  className="px-2 sm:px-3 py-2 sm:py-2.5 lg:py-3 text-[10px] sm:text-xs font-bold bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 transition-colors border-l border-red-500/20"
                  title="Undo Absent"
                >
                  -
                </button>
              </div>
              <div className="flex flex-1 rounded-lg overflow-hidden border border-blue-500/20">
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(subjectId, 'deemed'); }}
                  className="flex-1 py-2 sm:py-2.5 lg:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                  title="Mark Deemed"
                >
                  Deemed
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(subjectId, 'undo_deemed'); }}
                  className="px-2 sm:px-3 py-2 sm:py-2.5 lg:py-3 text-[10px] sm:text-xs font-bold bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30 transition-colors border-l border-blue-500/20"
                  title="Undo Deemed"
                >
                  -
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </motion.div>
  )
}
