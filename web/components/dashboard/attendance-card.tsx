"use client"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { getAccentGradient, getBarGradient } from '@/lib/gradient'

interface AttendanceCardProps {
  subjectId?: string
  subjectName: string
  present: number
  absent: number
  percentage: number
  accentColor?: string
  onLog?: (subjectId: string, action: 'present'|'absent'|'undo_present'|'undo_absent') => void
}

export function AttendanceCard({
  subjectId,
  subjectName,
  present,
  absent,
  percentage,
  accentColor,
  onLog,
}: AttendanceCardProps) {
  const pct = Number(percentage ?? 0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(pct)
  }, [pct])

  const healthClass =
    pct >= 85
      ? 'text-green-500 dark:text-green-400'
      : pct >= 75
        ? 'text-yellow-500 dark:text-yellow-400'
        : 'text-destructive'

  // Corner & progress bar: hex → gradient, or theme gradient fallback
  const corner = getAccentGradient(accentColor)
  const bar = getBarGradient(accentColor)

  return (
    <Card className="overflow-hidden">
      {/* Corner accent — hex gradient or theme gradient */}
      <div
        className={cn("h-10 w-25 -mt-15 -rotate-45 -translate-x-1/2 translate-y-1/2 rounded-full", corner.className)}
        style={corner.style}
      />

      <CardHeader className="pb-2 flex-row items-center space-y-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-bold leading-tight line-clamp-2">
            {subjectName}
          </CardTitle>
          <span className={cn('text-xl font-black', healthClass)}>
            {pct}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar — hex gradient or theme gradient */}
        <div className="h-2 w-full rounded-full overflow-hidden bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", bar.className)}
            style={{ ...bar.style, width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {present} present
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            {absent} absent
          </span>
        </div>

        {onLog && subjectId && (
          <div className="flex gap-2 pt-2 border-t mt-2">
            <div className="flex flex-1 rounded overflow-hidden">
              <button
                onClick={() => onLog(subjectId, 'present')}
                className="flex-1 py-1 text-[11px] uppercase tracking-wider font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                title="Mark Present"
              >
                + Present
              </button>
              <button
                onClick={() => onLog(subjectId, 'undo_present')}
                className="px-2 py-1 text-xs font-bold bg-green-500/20 text-green-600 hover:bg-green-500/30 transition-colors border-l border-green-500/10"
                title="Undo Present"
              >
                -
              </button>
            </div>
            <div className="flex flex-1 rounded overflow-hidden">
              <button
                onClick={() => onLog(subjectId, 'absent')}
                className="flex-1 py-1 text-[11px] uppercase tracking-wider font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                title="Mark Absent"
              >
                + Absent
              </button>
              <button
                onClick={() => onLog(subjectId, 'undo_absent')}
                className="px-2 py-1 text-xs font-bold bg-red-500/20 text-red-600 hover:bg-red-500/30 transition-colors border-l border-red-500/10"
                title="Undo Absent"
              >
                -
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
