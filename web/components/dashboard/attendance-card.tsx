"use client"
import { CheckCircle2, XCircle, User, Fingerprint, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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
  onLog?: (
    subjectId: string,
    action: "present" | "absent" | "deemed" | "undo_present" | "undo_absent" | "undo_deemed"
  ) => void
}

function hexToAccentStyle(hex: string) {
  if (!hex) return {}
  return {
    background: hex,
  }
}

function getHealthData(
  present: number,
  absent: number,
  deemed: number,
  bunksRemaining?: number,
  skipPct?: number,
  pct?: number,
  targetPct?: number
) {
  if (present === 0 && absent === 0 && deemed === 0) {
    return { colorClass: "text-muted-foreground", glowClass: "from-muted-foreground/20" }
  }

  if (bunksRemaining !== undefined) {
    if (bunksRemaining <= 0) return { colorClass: "text-destructive", glowClass: "from-destructive/20" }
    if (skipPct !== undefined && skipPct >= 0.6)
      return { colorClass: "text-amber-600 dark:text-amber-400", glowClass: "from-amber-500/20" }
    return { colorClass: "text-green-600 dark:text-green-400/90", glowClass: "from-green-500/20" }
  }

  if (pct !== undefined && targetPct !== undefined) {
    if (pct < targetPct) return { colorClass: "text-destructive", glowClass: "from-destructive/20" }
    if (pct < targetPct + 10)
      return { colorClass: "text-amber-600 dark:text-amber-400", glowClass: "from-amber-500/20" }
    return { colorClass: "text-green-600 dark:text-green-400/90", glowClass: "from-green-500/20" }
  }

  return { colorClass: "text-green-600 dark:text-green-400/90", glowClass: "from-green-500/20" }
}

export function AttendanceCard(props: Readonly<AttendanceCardProps>) {
  const {
    subjectId,
    subjectName,
    present,
    absent,
    deemed,
    percentage,
    accentColor,
    instructorName,
    bunksRemaining,
    maxAllowedSkips,
    currentSkips,
    neededToRecover,
    maxPossiblePct,
    isPossibleToRecover,
    targetPct = 70,
    onLog,
  } = props

  const pct = Number(percentage ?? 0)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => setProgress(pct), 50)
    return () => clearTimeout(timer)
  }, [pct])

  const handleCardClick = () => {
    if (subjectId) {
      router.push(`/dashboard/subjects/${subjectId}`)
    }
  }

  const skipPct = maxAllowedSkips && maxAllowedSkips > 0 ? (currentSkips || 0) / maxAllowedSkips : 0
  const health = getHealthData(present, absent, deemed, bunksRemaining, skipPct, pct, targetPct)

  return (
    <div className="h-full">
      <div
        onClick={handleCardClick}
        className="group hover:shadow-primary/10 border-border/40 hover:border-primary/30 bg-card/60 relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.75rem] border backdrop-blur-3xl transition-all duration-500 ease-out hover:shadow-xl"
      >
        <div className="relative z-10 flex flex-1 flex-col p-4 sm:p-5">
          {/* Top Section: Title & Percentage */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-bold tracking-[0.2em] uppercase">
                  <User className="h-3 w-3" />
                  {instructorName || "No Instructor"}
                </span>
              </div>
              <h3 className="text-foreground truncate text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                {subjectName}
              </h3>
            </div>

            <div className="flex flex-col items-end">
              <span className={`text-4xl font-black tracking-tighter tabular-nums sm:text-5xl ${health.colorClass}`}>
                {Math.round(pct)}%
              </span>
            </div>
          </div>

          <div className="mt-auto space-y-3.5">
            {/* Elegant Progress Line */}
            <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full border border-white/5 shadow-inner">
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${progress}%`,
                  ...hexToAccentStyle(accentColor || "#8b5cf6"),
                }}
              />
            </div>

            {/* Warning / Status Message */}
            {(present > 0 || absent > 0 || deemed > 0) &&
              (bunksRemaining !== undefined || neededToRecover !== undefined) && (
                <div className="flex">
                  {bunksRemaining !== undefined && bunksRemaining >= 0 ? (
                    <>
                      {(() => {
                        const spct = maxAllowedSkips && maxAllowedSkips > 0 ? (currentSkips || 0) / maxAllowedSkips : 0
                        if (bunksRemaining === 0) {
                          return (
                            <div className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight">
                              High risk: Zero skips left
                            </div>
                          )
                        }
                        if (spct >= 0.6) {
                          return (
                            <div className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-tight text-amber-600 dark:text-amber-400">
                              Warning: Only {bunksRemaining} skips left
                            </div>
                          )
                        }
                        return (
                          <div className="rounded-full bg-green-500/5 px-2 py-0.5 text-[10px] font-semibold tracking-tight text-green-600 dark:text-green-400/90">
                            Safe to skip {bunksRemaining} more
                          </div>
                        )
                      })()}
                    </>
                  ) : (
                    <>
                      {isPossibleToRecover ? (
                        <div className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight">
                          Deficit: Attend {neededToRecover} to recover
                        </div>
                      ) : (
                        <div className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight">
                          Critical: Max possible is {Math.round(maxPossiblePct || 0)}%
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            {/* Apple Health Style Rounded Squares */}
            {onLog ? (
              <div className="grid grid-cols-3 gap-2 pt-1 sm:gap-2.5">
                {/* Present Block */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onLog(subjectId!, "present")
                  }}
                  className="group/btn relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-2 shadow-sm transition-all hover:border-emerald-500/30 hover:bg-emerald-500/15 hover:shadow-md sm:py-2.5"
                  title="Mark Present (+1)"
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
                    <span className="text-[10px] font-bold tracking-wider text-emerald-700/80 uppercase dark:text-emerald-400/80">
                      Present
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-600 transition-transform group-hover/btn:scale-105 sm:text-3xl dark:text-emerald-400">
                    {present ?? 0}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onLog(subjectId!, "undo_present")
                    }}
                    className="absolute top-1 right-1 rounded-full p-1 text-emerald-600/0 transition-all outline-none group-hover/btn:text-emerald-600/50 hover:bg-emerald-500/20 active:scale-95 dark:group-hover/btn:text-emerald-400/50"
                    title="Undo Present"
                  >
                    <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>

                {/* Absent Block */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onLog(subjectId!, "absent")
                  }}
                  className="group/btn relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 py-2 shadow-sm transition-all hover:border-rose-500/30 hover:bg-rose-500/15 hover:shadow-md sm:py-2.5"
                  title="Mark Absent (+1)"
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-rose-500/80" />
                    <span className="text-[10px] font-bold tracking-wider text-rose-700/80 uppercase dark:text-rose-400/80">
                      Absent
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-rose-600 transition-transform group-hover/btn:scale-105 sm:text-3xl dark:text-rose-400">
                    {absent ?? 0}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onLog(subjectId!, "undo_absent")
                    }}
                    className="absolute top-1 right-1 rounded-full p-1 text-rose-600/0 transition-all outline-none group-hover/btn:text-rose-600/50 hover:bg-rose-500/20 active:scale-95 dark:group-hover/btn:text-rose-400/50"
                    title="Undo Absent"
                  >
                    <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>

                {/* Deemed Block */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onLog(subjectId!, "deemed")
                  }}
                  className="group/btn relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 py-2 shadow-sm transition-all hover:border-blue-500/30 hover:bg-blue-500/15 hover:shadow-md sm:py-2.5"
                  title="Mark Deemed (+1)"
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <Fingerprint className="h-3.5 w-3.5 text-blue-500/80" />
                    <span className="text-[10px] font-bold tracking-wider text-blue-700/80 uppercase dark:text-blue-400/80">
                      Deemed
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 transition-transform group-hover/btn:scale-105 sm:text-3xl dark:text-blue-400">
                    {deemed ?? 0}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onLog(subjectId!, "undo_deemed")
                    }}
                    className="absolute top-1 right-1 rounded-full p-1 text-blue-600/0 transition-all outline-none group-hover/btn:text-blue-600/50 hover:bg-blue-500/20 active:scale-95 dark:group-hover/btn:text-blue-400/50"
                    title="Undo Deemed"
                  >
                    <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 pt-1 sm:gap-2.5">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-2 shadow-sm sm:py-2.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
                    <span className="text-[10px] font-bold tracking-wider text-emerald-700/80 uppercase dark:text-emerald-400/80">
                      Present
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-600 sm:text-3xl dark:text-emerald-400">
                    {present ?? 0}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 py-2 shadow-sm sm:py-2.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-rose-500/80" />
                    <span className="text-[10px] font-bold tracking-wider text-rose-700/80 uppercase dark:text-rose-400/80">
                      Absent
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-rose-600 sm:text-3xl dark:text-rose-400">{absent ?? 0}</span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 py-2 shadow-sm sm:py-2.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <Fingerprint className="h-3.5 w-3.5 text-blue-500/80" />
                    <span className="text-[10px] font-bold tracking-wider text-blue-700/80 uppercase dark:text-blue-400/80">
                      Deemed
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 sm:text-3xl dark:text-blue-400">{deemed ?? 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
