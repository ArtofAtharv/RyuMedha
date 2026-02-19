import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle } from 'lucide-react'
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

  const healthClass =
    pct >= 85
      ? 'text-green-500 dark:text-green-400'
      : pct >= 75
      ? 'text-yellow-500 dark:text-yellow-400'
      : 'text-destructive'

  const barClass =
    pct >= 75
      ? 'bg-primary'
      : 'bg-destructive'

  return (
    <Card className="overflow-hidden">
      {/* Thin top accent bar using the subject's hex color, falls back to primary */}
      <div
        className="h-1 w-full bg-primary"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold leading-tight line-clamp-2">
            {subjectName}
          </CardTitle>
          <span className={cn('text-2xl font-black shrink-0', healthClass)}>
            {pct}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barClass)}
            style={{ width: `${Math.min(pct, 100)}%` }}
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
