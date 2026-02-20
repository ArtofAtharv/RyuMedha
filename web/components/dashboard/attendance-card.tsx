"use client"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'

interface AttendanceCardProps {
  subjectName: string
  present: number
  absent: number
  percentage: number
  accentColor?: string
}

export function AttendanceCard({
  subjectName,
  present,
  absent,
  percentage,
  accentColor,
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

  return (
    <Card className="overflow-hidden">
      {/* Thin top accent corner using the subject's hex color, falls back to primary */}
      <div
        className="h-10 w-25 -mt-15 -rotate-45 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary"
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
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <Progress
            value={progress}
            className="h-full bg-current"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {/* Stats row */}
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
      </CardContent>
    </Card>
  )
}
