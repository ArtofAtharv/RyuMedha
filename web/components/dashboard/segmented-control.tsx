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
}

export function SegmentedControl({ segments, activeSegment, onChange }: Readonly<SegmentedControlProps>) {
  return (
    <div className="relative flex gap-1 bg-muted/40 rounded-full border border-border/50 shrink-0">
      {segments.map((segment) => {
        const isActive = activeSegment === segment.id
        return (
          <button
            key={segment.id}
            onClick={() => onChange(segment.id)}
            className="relative flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none shrink-0"
          >
            {isActive && (
              <m.div
                layoutId="global-segmented-control"
                transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.3 }}
                className="absolute inset-0 bg-background shadow-sm rounded-full border border-border/50"
              />
            )}
            <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
              {segment.icon && <segment.icon className="w-3.5 h-3.5" />}
              {segment.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
