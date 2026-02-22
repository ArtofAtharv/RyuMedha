"use client";
import { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, isToday } from "date-fns";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

// Renamed and modified from sample to act as a proper single/range picker
export function DateRangePicker({ onSelect, mode = 'single' }: { onSelect: (dates: Date | Date[]) => void, mode?: 'single' | 'range' }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selection, setSelection] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const handleDateClick = (date: Date) => {
    if (mode === 'single') {
      setSelection({ start: date, end: null });
      onSelect(date);
      return;
    }

    // Range logic
    if (!selection.start || (selection.start && selection.end)) {
      setSelection({ start: date, end: null });
    } else {
      const start = selection.start < date ? selection.start : date;
      const end = selection.start < date ? date : selection.start;
      setSelection({ start, end });
      onSelect(eachDayOfInterval({ start, end }));
    }
  };

  const isInRange = (date: Date) => {
    if (mode === 'single') return false;
    if (!selection.start || !selection.end) return false;
    return isWithinInterval(date, { start: selection.start, end: selection.end });
  };

  return (
    <div className="p-3 w-full text-foreground rounded-xl">
      <div className="flex justify-between items-center mb-4 px-2">
        <h4 className="font-bold text-sm">{format(currentMonth, "MMMM yyyy")}</h4>
        <div className="flex gap-1">
          <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><HiChevronLeft /></button>
          <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><HiChevronRight /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-[10px] font-bold text-muted-foreground text-center py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          const isSelected = (selection.start && isSameDay(day, selection.start)) || (selection.end && isSameDay(day, selection.end));
          const rangeActive = isInRange(day);
          const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentMonth));

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDateClick(day)}
              className={`
                aspect-square text-xs transition-all relative
                ${!isCurrentMonth ? "opacity-30" : "opacity-100"}
                ${rangeActive ? "bg-primary/20 text-primary" : ""}
                ${isSelected ? "bg-primary text-primary-foreground! rounded-lg! z-10 shadow-md font-bold" : "hover:bg-muted hover:rounded-lg"}
                ${isToday(day) && !isSelected ? "bg-primary text-primary-foreground rounded-full font-bold shadow-sm" : (!isSelected && !rangeActive ? "rounded-lg" : "")}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
      
      {mode === 'range' && selection.start && !selection.end && (
        <p className="text-[10px] text-primary mt-3 text-center animate-pulse font-medium">Select end date...</p>
      )}
    </div>
  );
}