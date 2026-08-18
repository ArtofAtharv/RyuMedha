import React from "react"
import { m } from "motion/react"
import { LucideIcon } from "lucide-react"

export interface Segment {
  id: string
  label: string
  icon?: LucideIcon
}

interface SegmentedControlProps {
  segments: Segment[]
  activeSegment: string
  onChange: (id: string) => void
  fullWidth?: boolean
  layoutIdPrefix?: string
}

export function SegmentedControl({
  segments,
  activeSegment,
  onChange,
  fullWidth,
  layoutIdPrefix = "global-segmented",
}: Readonly<SegmentedControlProps>) {
  return (
    <div
      className={`relative flex shrink-0 rounded-full border border-black/5 bg-black/5 p-1 shadow-inner backdrop-blur-md dark:border-white/5 dark:bg-white/5 ${fullWidth ? "w-full" : ""}`}
    >
      {segments.map((segment) => {
        const isActive = activeSegment === segment.id
        return (
          <button
            key={segment.id}
            onClick={() => onChange(segment.id)}
            className={`relative flex shrink-0 items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-sm transition-colors focus:outline-none ${fullWidth ? "flex-1" : ""}`}
          >
            {isActive && (
              <m.div
                layoutId={`${layoutIdPrefix}-bg`}
                layout
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="bg-primary absolute inset-0 rounded-full shadow-md"
              />
            )}
            <span
              className={`relative z-10 flex items-center gap-1.5 ${isActive ? "text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground/80 font-medium"}`}
            >
              {segment.icon && <segment.icon className="h-3.5 w-3.5" />}
              {segment.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
