"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  format,
  isToday,
} from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  defaultMonth?: Date
  className?: string
  classNames?: Record<string, string>
  mode?: "single" // for compatibility
  captionLayout?: string // for compatibility
  initialFocus?: boolean // for compatibility
}

function Calendar({
  selected,
  onSelect,
  defaultMonth,
  className,
  classNames: _classNames,
  mode: _mode,
  captionLayout: _captionLayout,
  initialFocus: _initialFocus,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(defaultMonth || selected || new Date())

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  // Generate calendar grid days
  const startDate = startOfWeek(startOfMonth(currentMonth))
  const endDate = endOfWeek(endOfMonth(currentMonth))

  const days = []
  let day = startDate
  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  return (
    <div className={cn("p-3", className)} {...props}>
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="space-y-4">
          <div className="relative flex items-center justify-center pt-1">
            <button
              onClick={prevMonth}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
              )}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</div>
            <button
              onClick={nextMonth}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
              )}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="w-full border-collapse space-y-1">
            <div className="flex">
              {weekDays.map((wd, i) => (
                <div key={i} className="text-muted-foreground w-9 rounded-md text-center text-[0.8rem] font-normal">
                  {wd}
                </div>
              ))}
            </div>
            <div className="flex w-[252px] flex-wrap">
              {" "}
              {/* 7 cols * 36px/col = 252px */}
              {days.map((d, i) => {
                const isSelected = selected && isSameDay(d, selected)
                const isCurrentMonth = isSameMonth(d, currentMonth)
                const isDayToday = isToday(d)

                return (
                  <div key={i} className="relative m-0 p-0 text-center text-sm">
                    <button
                      onClick={() => onSelect?.(d)}
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "h-9 w-9 p-0 font-normal transition-colors",
                        isSelected &&
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground opacity-100",
                        !isSelected && isDayToday && "bg-accent text-accent-foreground",
                        !isSelected && !isCurrentMonth && "text-muted-foreground opacity-50 aria-selected:opacity-30",
                        !isSelected && isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {format(d, "d")}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
